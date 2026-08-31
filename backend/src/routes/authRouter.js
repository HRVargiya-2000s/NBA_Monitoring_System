const express = require('express');
const { login, getProfile, updateProfile, getMe, logout, changePassword, requestPasswordReset, verifyOTP, resetPassword} = require('../controllers/authController');
const authenticate = require('../middleware/auth');

const authRouter = express.Router();


authRouter.post('/login', login);
authRouter.get('/profile', authenticate,  getProfile);
authRouter.put('/profile', authenticate, updateProfile);
authRouter.get('/me', authenticate, getMe); 
authRouter.post('/logout', authenticate, logout);
authRouter.post('/change-password', authenticate, changePassword);
authRouter.post('/forgot-password', requestPasswordReset);
authRouter.post('/verify-otp', verifyOTP);
authRouter.post('/reset-password', resetPassword);

module.exports = authRouter;