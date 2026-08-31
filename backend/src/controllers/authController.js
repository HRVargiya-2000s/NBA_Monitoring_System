const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const redisClient = require('../config/redis');
const sendEmail = require('../services/emailService');
const { findUserByIdentifier, findFacultyByIdentifier, getStudentProfile, getFacultyProfile, updateFacultyProfile,  updateStudentPassword, updateFacultyPassword } = require('../models/userModel');

const expiryTime = process.env.JWT_EXPIRES_IN || '24h';

const login = async (req, res) => {
    try {
        const { identifier, password, role } = req.body;
        const safeIdentifier = String(identifier || '').trim();

        if (!identifier || !password || !role) {
            console.warn('Login rejected: missing identifier/password/role', {
                hasIdentifier: Boolean(identifier),
                hasPassword: Boolean(password),
                role,
            });
            return res.status(400).json({ error: "All fields are required" });
        }

        const user = (role === 'student') ? await findUserByIdentifier(identifier) : await findFacultyByIdentifier(identifier);

        if (!user) {
            console.warn('Login rejected: active user not found', {
                identifier: safeIdentifier,
                role,
            });
            return res.status(401).json({
                error: process.env.NODE_ENV !== 'production'
                    ? `No active ${role} found for "${safeIdentifier}". Check that you inserted this user into the same database used by DATABASE_URL.`
                    : "Invalid Credentials"
            });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            console.warn('Login rejected: password mismatch', {
                identifier: safeIdentifier,
                role,
                userId: user.id,
            });
            return res.status(401).json({
                error: process.env.NODE_ENV !== 'production'
                    ? `Password mismatch for ${role} "${safeIdentifier}".`
                    : "Invalid Credentials"
            });
        }

        const isStudentLogin = role === 'student';
        const normalizedRole = isStudentLogin ? 'student' : user.role;

        if (!process.env.JWT_KEY || process.env.JWT_KEY.trim().length === 0) {
            throw new Error('Server configuration error: JWT secret is missing');
        }

        const isValidExpiryTime =
            (typeof expiryTime === 'number' && Number.isFinite(expiryTime) && expiryTime > 0) ||
            (typeof expiryTime === 'string' &&
                expiryTime.trim().length > 0 &&
                /^\d+(\.\d+)?\s*(ms|s|m|h|d|w|y|sec|secs|second|seconds|minute|minutes|hour|hours|day|days|week|weeks|year|years)?$/i.test(expiryTime.trim()));

        if (!isValidExpiryTime) {
            throw new Error('Server configuration error: Invalid JWT expiry');
        }

        if (!user.id) {
            throw new Error('JWT generation failed: Missing user id');
        }

        if (!isStudentLogin && !user.email) {
            throw new Error('JWT generation failed: Missing user email');
        }

        const normalizedEmail =
            user.email ||
            user.student_email ||
            user.institute_email ||
            null;

        const tokenPayload = isStudentLogin
            ? {
                id: user.id,
                role: normalizedRole,
                userType: role
            }
            : {
                id: user.id,
                email: user.email,
                role: normalizedRole
            };

        if (isStudentLogin && normalizedEmail) {
            tokenPayload.email = normalizedEmail;
        }

        if (isStudentLogin && user.enrollment_number) {
            tokenPayload.enrollment_number = user.enrollment_number;
        }

        const token = jwt.sign(
            tokenPayload,
            process.env.JWT_KEY,
            {
                expiresIn: expiryTime
            }
        );

        if (typeof token !== 'string' || token.length === 0) {
            throw new Error('JWT generation failed');
        }

        // Security: Use httpOnly so JavaScript can't steal the cookie (XSS protection)
        res.cookie('token', token, { 
            maxAge: parseInt(expiryTime) * 60 * 60 * 1000, 
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production' 
        });

        // Professional practice: Return user info (excluding password) so the frontend knows who logged in
        const responseUser = isStudentLogin
            ? {
                id: user.id,
                name: user.name,
                email: normalizedEmail,
                enrollment_number: user.enrollment_number || user.id,
                role: 'student'
            }
            : {
                id: user.id,
                name: user.name,
                email: user.email,
                role: normalizedRole,
                designation: user.role
            };

        res.status(200).json({ 
            message: "Login Successful",
            token,
            user: responseUser
        });
        
    } catch (err) {
        res.status(500).send("Server Error: " + err.message);
        console.error("Login Error:", err); // Log the error for debugging
    }
}

const getProfile = async (req, res) => {
    try {
        const { id, role } = req.user; // Data extracted from the JWT by the middleware
        let userData;

        if (role === 'student') {
            userData = await getStudentProfile(id);
        } 
        else {
            // This handles 'ASSISTANT', 'HOD', 'ASSOCIATE', 'ADMIN' 
            // since they all live in the faculty table
            userData = await getFacultyProfile(id);
        }

        if (!userData) {
            return res.status(404).json({ error: "User not found" });
        }

        res.status(200).json(userData);
    } catch (err) {
        res.status(500).send("Server Error: " + err.message);
    }
};

const updateProfile = async (req, res) => {
    try {
        const { id, role } = req.user;
        if (role === 'student') {
            return res.status(403).json({ error: "Student profile update not supported yet." });
        }
        await updateFacultyProfile(id, req.body);
        const updated = await getFacultyProfile(id);
        res.status(200).json(updated);
    } catch (err) {
        res.status(500).json({ error: "Server Error: " + err.message });
    }
};

const getMe = async (req, res) => {
    try {
        // req.user was already populated by your 'authenticate' middleware
        // It contains: { id, email, role }
        
        if (!req.user) {
            return res.status(401).json({ authenticated: false });
        }

        const currentUser = req.user.role === 'student'
            ? await findUserByIdentifier(req.user.id)
            : await findFacultyByIdentifier(req.user.id);

        res.status(200).json({
            authenticated: true,
            user: {
                id: req.user.id,
                email: req.user.email,
                role: req.user.role,
                name: currentUser?.name || ''
            }
        });
    } catch (err) {
        res.status(500).json({ error: "Internal Server Error" });
    }
};

const logout = async (req, res) => {
    try{
        //add token to redis blocklist with expiredate
        const {token} = req.cookies;
        const payload = jwt.decode(token);

        await redisClient.set(`token:${token}`, "blocked", {
            EX: payload.exp - Math.floor(Date.now() / 1000) // Set expiry to match token's expiry
        });        
        // 3. Clear the Cookie
        res.clearCookie('token');

        res.status(200).json({ message: "Logged out successfully" });
    }
    catch(err){
        res.status(503).send("Error: "+ err.message);
    }
}

const changePassword = async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const { id, role } = req.user; // From authenticate middleware

        if (!oldPassword || !newPassword) {
            return res.status(400).json({ error: "Both old and new passwords are required" });
        }

        // 1. Fetch user to get current hashed password
        const user = (role === 'student') ? await findUserByIdentifier(id) : await findFacultyByIdentifier(id);

        if (!user) return res.status(404).json({ error: "User not found" });

        // 2. Verify old password
        const isMatch = await bcrypt.compare(oldPassword, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: "Incorrect current password" });
        }

        // 3. Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // 4. Update in Database
        if (role === 'student') {
            await updateStudentPassword(id, hashedPassword);
        } else {
            await updateFacultyPassword(id, hashedPassword);
        }

        // 5. Security Best Practice: Force Logout after password change
        // (Optional: You can also choose to keep them logged in, but logout is safer)
        res.clearCookie('token');
        res.status(200).json({ message: "Password updated successfully. Please login again." });

    } catch (err) {
        res.status(500).json({ error: "Server Error: " + err.message });
    }
};

const requestPasswordReset = async (req, res) => {
    try {
        const { email, role } = req.body; // Need role to know which table to check
        
        // 1. Check if user exists
        const user = (role === 'student') ? await findUserByIdentifier(email) : await findFacultyByIdentifier(email);

        if (!user) return res.status(404).json({ error: "User not found" });

        const existingOtp = await redisClient.get(`reset:${email}`);

        //only allow new OTP after 60 seconds of previous OTP generation to prevent abuse
        if (existingOtp) {
            const ttl = await redisClient.ttl(`reset:${email}`);
            if (ttl > 540) { // 600 - 60 = 540
                return res.status(429).json({ error: "Please wait 60 seconds before requesting a new OTP." });
            }
        }

        // 2. Generate 6-digit OTP
        const otp = crypto.randomInt(100000, 999999).toString();

        // 3. Store in Redis (Key: reset:email, Value: OTP, Expire: 10 mins)
        await redisClient.set(`reset:${email}`, otp, { EX: 600 });

        const mailOptions = {
            from: {
                name: "LDCE Student Portal",
                address: process.env.EMAIL_USER
            },
            to: email,
            subject: "Password Reset OTP - LDCE",
            text: `Your OTP for password reset is ${otp}. It expires in 10 minutes.`,
            html: `
                <div style="font-family: Arial, sans-serif; border: 1px solid #ddd; padding: 20px; border-radius: 10px;">
                    <h2 style="color: #2c3e50;">LDCE Student Portal</h2>
                    <p>Hello <strong>${user.name}</strong>,</p>
                    <p>You requested a password reset. Use the following OTP to proceed:</p>
                    <div style="background: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #e74c3c;">
                        ${otp}
                    </div>
                    <p style="color: #7f8c8d; font-size: 12px; margin-top: 20px;">
                        This OTP is valid for 10 minutes. If you did not request this, please ignore this email.
                    </p>
                </div>
            `
        };

        await sendEmail(mailOptions);

        // 4. Send Email (For Hackathon: Console Log it, or use Nodemailer)
        console.log(`📧 [EMAIL SIMULATION] Sent OTP ${otp} to ${email}`);

        res.status(200).json({ message: "OTP sent to your registered email" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const verifyOTP = async (req, res) => {
    const { email, otp } = req.body;
    
    const storedOtp = await redisClient.get(`reset:${email}`);

    if (!storedOtp || storedOtp !== otp) {
        return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    // OTP is valid. Now, to prevent someone from skipping this step, 
    // we can set a "verified" flag in Redis for 5 minutes.
    await redisClient.set(`verified:${email}`, "true", { EX: 300 });

    res.status(200).json({ message: "OTP verified. You can now reset your password." });
};

const resetPassword = async (req, res) => {
    try {
        const { email, newPassword, role } = req.body;

        // 1. Check if they actually verified the OTP
        const isVerified = await redisClient.get(`verified:${email}`);
        if (!isVerified) {
            return res.status(403).json({ error: "Unauthorized. Please verify OTP first." });
        }

        // 2. Hash and Update
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        
        if (role === 'student') {
            const user = await findUserByIdentifier(email);
            await updateStudentPassword(user.id, hashedPassword);
        } else {
            const user = await findFacultyByIdentifier(email);
            await updateFacultyPassword(user.id, hashedPassword);
        }

        // 3. Cleanup Redis
        await redisClient.del(`verified:${email}`);
        await redisClient.del(`reset:${email}`);

        res.status(200).json({ message: "Password reset successful. Log in with your new password." });
    } catch (err) {
        res.status(500).json({ error: "Reset failed: " + err.message });
    }
};

module.exports = { login, getProfile, getMe, logout, changePassword, requestPasswordReset, verifyOTP, resetPassword, updateProfile };
