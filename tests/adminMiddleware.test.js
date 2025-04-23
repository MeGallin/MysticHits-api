const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const adminMiddleware = require('../middleware/adminMiddleware');

// Mock response and request objects
const mockRequest = (headers, userId) => ({
  headers,
  userId,
});

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn();

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

// MongoDB setup
let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Admin Middleware Tests', () => {
  let adminUser;
  let regularUser;
  let adminToken;
  let regularToken;

  beforeEach(async () => {
    // Clear users before each test
    await User.deleteMany({});

    // Create an admin user
    adminUser = new User({
      username: 'adminuser',
      email: 'admin@example.com',
      password: 'password123',
      isAdmin: true,
    });
    await adminUser.save();

    // Create a regular user
    regularUser = new User({
      username: 'regularuser',
      email: 'regular@example.com',
      password: 'password123',
      isAdmin: false,
    });
    await regularUser.save();

    // Create tokens
    adminToken = jwt.sign({ userId: adminUser._id }, JWT_SECRET);
    regularToken = jwt.sign({ userId: regularUser._id }, JWT_SECRET);

    // Reset mock function calls
    mockNext.mockClear();
  });

  test('Should return 401 if no token is provided', async () => {
    const req = mockRequest({}, null);
    const res = mockResponse();

    await adminMiddleware(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  test('Should return 403 if user is not an admin', async () => {
    const req = mockRequest({ authorization: `Bearer ${regularToken}` }, null);
    const res = mockResponse();

    await adminMiddleware(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Access denied. Admin privileges required',
    });
    expect(mockNext).not.toHaveBeenCalled();
  });

  test('Should call next() if user is an admin', async () => {
    const req = mockRequest({ authorization: `Bearer ${adminToken}` }, null);
    const res = mockResponse();

    await adminMiddleware(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(req.userId).toBeDefined();
    expect(req.userId.toString()).toBe(adminUser._id.toString());
  });

  test('Should return 401 if token is invalid', async () => {
    const req = mockRequest({ authorization: 'Bearer invalidtoken' }, null);
    const res = mockResponse();

    await adminMiddleware(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  test('Should return 404 if user does not exist', async () => {
    // Create a token with a non-existent user ID
    const nonExistentId = new mongoose.Types.ObjectId();
    const nonExistentToken = jwt.sign({ userId: nonExistentId }, JWT_SECRET);

    const req = mockRequest(
      { authorization: `Bearer ${nonExistentToken}` },
      null,
    );
    const res = mockResponse();

    await adminMiddleware(req, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
    expect(mockNext).not.toHaveBeenCalled();
  });
});
