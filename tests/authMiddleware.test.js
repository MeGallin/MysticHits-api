const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const auth = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

function createApp() {
  const app = express();
  app.use(express.json());
  app.get('/protected', auth, (req, res) => {
    res.json({ userId: req.userId });
  });
  return app;
}

describe('JWT Auth Middleware', () => {
  let app;
  beforeAll(() => {
    app = createApp();
  });

  it('should return 401 if no token is provided', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 401 if token is invalid', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer invalidtoken');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('should return 401 if token is expired', async () => {
    const expiredToken = jwt.sign({ userId: '123' }, JWT_SECRET, {
      expiresIn: -1,
    });
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('should allow access and set req.userId for valid token', async () => {
    const validToken = jwt.sign({ userId: 'abc123' }, JWT_SECRET, {
      expiresIn: '1h',
    });
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${validToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('userId', 'abc123');
  });
});
