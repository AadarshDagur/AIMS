const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/database');
const nodemailer = require('nodemailer'); // npm install nodemailer

// FIXED: createTransport (not createTransporter)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // your@gmail.com
    pass: process.env.EMAIL_PASS  // your 16-char app password
  }
});

// POST /login - Password → Send OTP
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    const userQuery = `SELECT * FROM users WHERE email = $1 AND role = $2`;
    const userResult = await pool.query(userQuery, [email, role]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const userName= user.name;

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query('DELETE FROM login_otps WHERE user_id = $1', [user.id]);
    await pool.query(
      'INSERT INTO login_otps (user_id, otp, expires_at) VALUES ($1, $2, $3)',
      [user.id, otpHash, expiresAt]
    );

    await transporter.sendMail({
  from: process.env.EMAIL_USER,
  to: email,
  subject: 'AIMS Login OTP',
  text: `Dear ${userName},

Here is your AIMS Portal authentication code: ${otp}

This code is valid for 10 minutes and can only be used once.

If you did not request this code, please ignore this email.

Best regards,
AIMS Team`,
  html: `
  <div style="
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background-color: #f3f4f6;
    padding: 24px;
  ">
    <div style="
      max-width: 480px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 8px;
      padding: 24px 24px 20px;
      box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08);
      border: 1px solid #e5e7eb;
    ">
      <h2 style="margin: 0 0 12px; font-size: 20px; color: #111827;">
        AIMS Login Verification
      </h2>
      <p style="margin: 0 0 16px; font-size: 14px; color: #4b5563;">
        Dear ${userName},
      </p>
      <p style="margin: 0 0 12px; font-size: 14px; color: #4b5563;">
        Use the following one-time code to complete your sign-in to the AIMS portal:
      </p>

      <div style="
        margin: 16px 0 18px;
        padding: 12px 16px;
        background-color: #f9fafb;
        border-radius: 6px;
        border: 1px solid #e5e7eb;
        text-align: center;
      ">
        <span style="
          display: inline-block;
          font-size: 24px;
          letter-spacing: 4px;
          font-weight: 700;
          font-family: 'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
          color: #111827;
        ">
          ${otp}
        </span>
      </div>

      <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;">
        This code is valid for <strong>10 minutes</strong> and can only be used once.
      </p>
      <p style="margin: 0 0 16px; font-size: 13px; color: #6b7280;">
        If you did not request this code, you can safely ignore this email.
      </p>

      <p style="margin: 0; font-size: 13px; color: #4b5563;">
        Best regards,<br>
        <span style="font-weight: 600;">AIMS Team</span>
      </p>
    </div>
  </div>
  `
});


    req.session.pendingLogin = { userId: user.id, role: user.role };
    await req.session.save();

    res.json({ message: 'OTP sent' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /verify-otp
router.post('/verify-otp', async (req, res) => {
  try {
    const { otp } = req.body;

    if (!req.session.pendingLogin) {
      return res.status(401).json({ error: 'Session expired' });
    }

    const { userId } = req.session.pendingLogin;
    const otpResult = await pool.query(
      'SELECT * FROM login_otps WHERE user_id = $1 AND used = false AND expires_at > NOW()',
      [userId]
    );

    if (otpResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid/expired OTP' });
    }

    const dbOtp = otpResult.rows[0];
    const isValidOtp = await bcrypt.compare(otp, dbOtp.otp);
    if (!isValidOtp) {
      return res.status(401).json({ error: 'Wrong OTP' });
    }

    await pool.query('UPDATE login_otps SET used = true WHERE id = $1', [dbOtp.id]);
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);

    req.session.user = userResult.rows[0];
    req.session.role = req.session.pendingLogin.role;
    delete req.session.pendingLogin;
    await req.session.save();

    const rolePath = req.session.role === 'student' ? 'student' : req.session.role;
    res.json({ message: 'Success', redirect: `/${rolePath}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.json({ message: 'Logged out' });
  });
});

module.exports = router;
