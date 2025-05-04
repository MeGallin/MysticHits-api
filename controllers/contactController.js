const ContactMessage = require('../models/ContactMessage');
const { sendEmail } = require('../utils/emailSender');

exports.submitContact = async (req, res) => {
  try {
    const { fullName, email, message, subject } = req.body;

    // Validate input
    if (!fullName || !email || !message) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    const ipAddress =
      req.headers['x-forwarded-for'] || req.connection.remoteAddress;

    const contact = new ContactMessage({
      fullName,
      email,
      subject: subject || 'No Subject',
      message,
      ipAddress,
    });
    await contact.save();

    // Send notification email to admin
    try {
      await sendEmail({
        to: process.env.ADMIN_EMAIL || 'admin@mystichits.com',
        subject: `New Contact Form Submission: ${subject || 'No Subject'}`,
        text: `
          New contact form submission:
          
          Name: ${fullName}
          Email: ${email}
          Subject: ${subject || 'No Subject'}
          Message: ${message}
          
          Submitted at: ${new Date().toLocaleString()}
          IP Address: ${ipAddress}
        `,
      });
    } catch (emailErr) {
      // Log email error but don't fail the request
      console.error('Failed to send notification email:', emailErr);
    }

    res
      .status(201)
      .json({ success: true, message: 'Thank you - we will be in touch!' });
  } catch (err) {
    console.error('Contact form error:', err);
    res.status(500).json({ error: 'Server error, please try again later.' });
  }
};

// Optional: Add admin routes to fetch and manage submissions
exports.getContactMessages = async (req, res) => {
  try {
    const messages = await ContactMessage.find().sort({ submittedAt: -1 });
    res.json(messages);
  } catch (err) {
    console.error('Error fetching contact messages:', err);
    res.status(500).json({ error: 'Server error, please try again later.' });
  }
};
