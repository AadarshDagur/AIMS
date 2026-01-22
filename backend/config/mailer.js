const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail', // or SMTP config
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendOtpMail(to, otp) {
  const mailOptions = {
    from: `"AIMS Login" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Your AIMS Login OTP',
    html: `
      <p>Your one-time password (OTP) for AIMS login is:</p>
      <h2>${otp}</h2>
      <p>This code is valid for 5 minutes.</p>
    `
  };
  await transporter.sendMail(mailOptions);
}

module.exports = { sendOtpMail };
