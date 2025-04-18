const nodemailer = require('nodemailer');

// Configure nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT || 587,
  secure: process.env.EMAIL_SECURE === 'false', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Send an email using the configured transporter
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Plain text email content
 * @param {string} [options.html] - HTML email content (optional)
 * @param {string} [options.from] - Sender email address (defaults to EMAIL_FROM env var or noreply@mystichits.com)
 * @param {string} [options.bcc] - BCC recipients (defaults to MAILER_BCC env var)
 * @returns {Promise} - Resolves with the send result
 */
const sendEmail = async (options) => {
  const { to, subject, text, html, from, bcc } = options;

  const mailOptions = {
    from: from || process.env.EMAIL_FROM || 'noreply@mystichits.com',
    to,
    subject,
    text,
    bcc: bcc || process.env.MAILER_BCC,
  };

  // Add HTML content if provided
  if (html) {
    mailOptions.html = html;
  }

  return await transporter.sendMail(mailOptions);
};

/**
 * Send a password reset email
 * @param {Object} options - Password reset options
 * @param {string} options.email - Recipient email address
 * @param {string} options.resetUrl - Password reset URL
 * @returns {Promise} - Resolves with the send result
 */
const sendPasswordResetEmail = async ({ email, resetUrl }) => {
  const subject = 'Mystichits - Password Reset Request';

  const message = `
    Hello from Mystichits!
    
    You requested a password reset. Please click the link below to reset your password:
    
    ${resetUrl}
    
    If you didn't request this, please ignore this email.
    
    Thanks,
    The Mystichits Team
  `;

  return await sendEmail({
    to: email,
    subject,
    text: message,
  });
};

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
};
