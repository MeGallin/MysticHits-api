const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const User = require('../models/User');

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

afterAll(async () => {
  await User.deleteMany({});
  await mongoose.disconnect();
});

beforeEach(async () => {
  await User.deleteMany({});
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
