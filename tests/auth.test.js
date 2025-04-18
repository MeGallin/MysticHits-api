const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');
const nodemailer = require('nodemailer');

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({
      messageId: 'test-message-id',
    }),
  }),
}));

const TEST_USER = {
  username: 'testuser',
  email: 'testuser@example.com',
  password: 'TestPass123!',
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

describe('Reset Password', () => {
  let sendMailMock;
  let resetToken;
  let user;

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    sendMailMock = nodemailer.createTransport().sendMail;

    // Create a test user
    user = await User.create(TEST_USER);

    // Generate reset token
    resetToken = user.createPasswordReset();
    await user.save();
  });

  it('should reset password with valid token', async () => {
    const newPassword = 'NewSecurePass456!';

    const res = await request(app)
      .post(`/api/auth/reset-password/${resetToken}`)
      .send({ password: newPassword })
      .expect(200);

    // Check response
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toBe('Password has been reset successfully');

    // Verify user's password was updated and token fields cleared
    const updatedUser = await User.findById(user._id);
    expect(updatedUser.resetPasswordToken).toBeUndefined();
    expect(updatedUser.resetPasswordExpires).toBeUndefined();

    // Verify new password works for login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: newPassword })
      .expect(200);

    expect(loginRes.body).toHaveProperty('token');
  });

  it('should return 400 for invalid token', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password/invalidtoken')
      .send({ password: 'NewPassword123' })
      .expect(400);

    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toBe('Invalid or expired token');
  });

  it('should return 400 if password is not provided', async () => {
    const res = await request(app)
      .post(`/api/auth/reset-password/${resetToken}`)
      .send({})
      .expect(400);

    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toBe('Token and password are required');
  });

  it('should return 400 if token is expired', async () => {
    // Manually expire the token
    user.resetPasswordExpires = Date.now() - 3600000; // 1 hour ago
    await user.save();

    const res = await request(app)
      .post(`/api/auth/reset-password/${resetToken}`)
      .send({ password: 'NewPassword123' })
      .expect(400);

    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toBe('Invalid or expired token');
  });
});

afterAll(async () => {
  await User.deleteMany({});
  await mongoose.disconnect();
});

beforeEach(async () => {
  await User.deleteMany({});
});

describe('Forgot Password', () => {
  let sendMailMock;

  beforeEach(() => {
    // Reset the mock and get a reference to the sendMail mock function
    jest.clearAllMocks();
    sendMailMock = nodemailer.createTransport().sendMail;
  });

  it('should generate reset token and send email for existing user', async () => {
    // Create a test user first
    await User.create(TEST_USER);

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: TEST_USER.email })
      .expect(200);

    // Check response
    expect(res.body).toHaveProperty('message');
    expect(res.body.message).toBe('Reset email sent');

    // Verify user has reset token set
    const user = await User.findOne({ email: TEST_USER.email });
    expect(user.resetPasswordToken).toBeDefined();
    expect(user.resetPasswordExpires).toBeDefined();
    expect(user.resetPasswordExpires).toBeInstanceOf(Date);

    // Verify email was sent
    expect(sendMailMock).toHaveBeenCalled();
    const emailCall = sendMailMock.mock.calls[0][0];
    expect(emailCall.to).toBe(TEST_USER.email);
    expect(emailCall.subject).toContain('Mystichits');
    expect(emailCall.text).toContain('reset your password');
  });

  it('should return 404 for non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nonexistent@example.com' })
      .expect(404);

    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toBe('User not found');

    // Verify no email was sent
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('should return 400 if email is not provided', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({})
      .expect(400);

    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toBe('Email is required');

    // Verify no email was sent
    expect(sendMailMock).not.toHaveBeenCalled();
  });
});

describe('Auth API', () => {
  it('should signup a new user and return token and userId', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send(TEST_USER)
      .expect(201);

    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('userId');
  });

  it('should not allow signup with duplicate email', async () => {
    await User.create(TEST_USER);
    const res = await request(app)
      .post('/api/auth/signup')
      .send(TEST_USER)
      .expect(400);

    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/email/i);
  });

  it('should login with correct credentials and return token', async () => {
    // Signup first
    await request(app).post('/api/auth/signup').send(TEST_USER).expect(201);

    // Login
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: TEST_USER.password })
      .expect(200);

    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('userId');
  });

  it('should not login with invalid credentials', async () => {
    await request(app).post('/api/auth/signup').send(TEST_USER).expect(201);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_USER.email, password: 'WrongPass' })
      .expect(401);

    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/invalid/i);
  });
});
