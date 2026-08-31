const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  host: "smtp.gmail.com",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});
// console.log(JSON.stringify(process.env.EMAIL_PASS));
// console.log(JSON.stringify(process.env.EMAIL_USER));

/**
 * Generic Email Sender
 * @param {string} to - Receiver's email
 * @param {string} subject - Email subject line
 * @param {string} text - Plain text version of the body
 * @param {string} html - HTML version of the body
 */

const sendEmail = async (mailOptions) => {
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email sent: ${info.messageId}`);
    return info;
  } 
  catch (error) {
    console.error("Email Service Error:", error.message);
    throw new Error("We encountered an issue sending the email. Please try again later.");
  }
};

module.exports = sendEmail;