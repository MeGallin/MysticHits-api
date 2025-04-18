const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const ContactMessage = require('../models/ContactMessage');
const { sendEmail } = require('../utils/emailSender');

// Mock emailSender
jest.mock('../utils/emailSender', () => ({
  sendEmail: jest.fn().mockResolvedValue({
    messageId: 'test-message-id',
  }),
}));

const TEST_CONTACT = {
  fullName: 'Test User',
  email: 'test@example.com',
  message: 'This is a test message',
};

beforeAll(async () => {
  // Connect to test DB (should be set via env)
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(
      process.env.MONGO_URI || 'mongodb://localhost:27017/mystichits_test',
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      },
    );
  }
});

afterAll(async () => {
  await ContactMessage.deleteMany({});
  await mongoose.disconnect();
});

beforeEach(async () => {
  await ContactMessage.deleteMany({});
  jest.clearAllMocks();
});

describe('Contact API', () => {
  it('should submit a contact form successfully', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send(TEST_CONTACT)
      .expect(201);

    // Check response
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty(
      'message',
      'Thank you - we will be in touch!',
    );

    // Verify contact was saved to database
    const contacts = await ContactMessage.find();
    expect(contacts).toHaveLength(1);
    expect(contacts[0].fullName).toBe(TEST_CONTACT.fullName);
    expect(contacts[0].email).toBe(TEST_CONTACT.email);
    expect(contacts[0].message).toBe(TEST_CONTACT.message);
    expect(contacts[0].ipAddress).toBeDefined();

    // Verify email was sent
    expect(sendEmail).toHaveBeenCalled();
    const emailCall = sendEmail.mock.calls[0][0];
    expect(emailCall.subject).toContain('Contact Form Submission');
    expect(emailCall.text).toContain(TEST_CONTACT.fullName);
    expect(emailCall.text).toContain(TEST_CONTACT.email);
    expect(emailCall.text).toContain(TEST_CONTACT.message);
  });

  it('should return 400 if required fields are missing', async () => {
    // Missing fullName
    let res = await request(app)
      .post('/api/contact')
      .send({ email: TEST_CONTACT.email, message: TEST_CONTACT.message })
      .expect(400);

    expect(res.body).toHaveProperty('error', 'All fields are required.');

    // Missing email
    res = await request(app)
      .post('/api/contact')
      .send({ fullName: TEST_CONTACT.fullName, message: TEST_CONTACT.message })
      .expect(400);

    expect(res.body).toHaveProperty('error', 'All fields are required.');

    // Missing message
    res = await request(app)
      .post('/api/contact')
      .send({ fullName: TEST_CONTACT.fullName, email: TEST_CONTACT.email })
      .expect(400);

    expect(res.body).toHaveProperty('error', 'All fields are required.');

    // Verify no contacts were saved
    const contacts = await ContactMessage.find();
    expect(contacts).toHaveLength(0);

    // Verify no emails were sent
    expect(sendEmail).not.toHaveBeenCalled();
  });

  // Note: Rate limiting tests are more complex and would require
  // mocking the rate limiter or making multiple requests
});
