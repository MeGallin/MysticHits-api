const mongoose = require('mongoose');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');

// Mock the database connection before importing app
jest.mock('../config/db', () => jest.fn().mockResolvedValue(true));

const app = require('../server');
const User = require('../models/User');
const Hit = require('../models/Hit');

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

let mongoServer;
let regularToken; // Define regularToken globally for the first describe block

// Setup MongoDB Memory Server before all tests in this file
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

// Disconnect and stop server after all tests in this file
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Admin Controller - View All Users', () => {
  let adminUser;
  let regularUser;
  let adminToken;

  beforeEach(async () => {
    // Clear users before each test
    await User.deleteMany({});

    // Create an admin user
    adminUser = new User({
      username: 'adminuser',
      email: 'admin@example.com',
      password: 'password123', // Note: Password should ideally be hashed
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
    adminToken = jwt.sign({ userId: adminUser._id.toString() }, JWT_SECRET); // Ensure ID is string
    regularToken = jwt.sign({ userId: regularUser._id.toString() }, JWT_SECRET); // Assign to the global var
  });

  // afterAll for this block is removed, handled by top-level afterAll

  test('GET /api/admin/users returns all users without password fields', async () => {
    const usersInDb = await User.countDocuments();

    const response = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(200); // Expect 200
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(usersInDb); // Should be 2

    response.body.forEach((user) => {
      expect(user.password).toBeUndefined();
      expect(user.resetPasswordToken).toBeUndefined();
      expect(user.resetPasswordExpires).toBeUndefined();
    });

    const foundAdmin = response.body.find(
      (user) => user.email === 'admin@example.com',
    );
    const foundRegular = response.body.find(
      (user) => user.email === 'regular@example.com',
    );

    expect(foundAdmin).toBeDefined();
    expect(foundAdmin.isAdmin).toBe(true);
    expect(foundRegular).toBeDefined();
    expect(foundRegular.isAdmin).toBe(false);
  });

  test('Regular users cannot access admin endpoints', async () => {
    const response = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${regularToken}`); // Use regular user token

    expect(response.statusCode).toBe(403); // Expect 403
    expect(response.body.error).toBe(
      'Access denied. Admin privileges required',
    );
  });

  test('Returns 500 if database query fails', async () => {
    const originalFind = User.find;
    User.find = jest.fn().mockImplementationOnce(() => {
      // Throw error directly
      throw new Error('Database error');
    });

    try {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.statusCode).toBe(500); // Expect 500
      expect(response.body.error).toBe('Failed to fetch users');
    } finally {
      User.find = originalFind; // Restore original method
    }
  });
});

describe('Admin Controller - Delete User', () => {
  let adminUser;
  let userToDelete;
  let adminToken;

  beforeEach(async () => {
    await User.deleteMany({});
    adminUser = new User({
      username: 'adminuser',
      email: 'admin@example.com',
      password: 'password123',
      isAdmin: true,
    });
    await adminUser.save();
    userToDelete = new User({
      username: 'userToBeDeleted',
      email: 'delete@example.com',
      password: 'password123',
      isAdmin: false,
    });
    await userToDelete.save();
    adminToken = jwt.sign({ userId: adminUser._id.toString() }, JWT_SECRET);
  });

  // afterEach is removed as beforeEach clears data

  test('DELETE /api/admin/users/:id should delete user with valid ID', async () => {
    const response = await request(app)
      .delete(`/api/admin/users/${userToDelete._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.message).toBe('User deleted successfully');
    const deletedUser = await User.findById(userToDelete._id);
    expect(deletedUser).toBeNull();
  });

  test('DELETE /api/admin/users/:id should return 404 if user not found', async () => {
    const nonExistentId = new mongoose.Types.ObjectId();
    const response = await request(app)
      .delete(`/api/admin/users/${nonExistentId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(404); // Expect 404
    expect(response.body.error).toBe('User not found');
  });

  test('DELETE /api/admin/users/:id should return 400 if ID format is invalid', async () => {
    const response = await request(app)
      .delete('/api/admin/users/invalid-id-format')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(400); // Expect 400
    expect(response.body.error).toBe('Invalid user ID format');
  });

  test('Cannot delete admin user', async () => {
    const response = await request(app)
      .delete(`/api/admin/users/${adminUser._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(403); // Expect 403
    expect(response.body.error).toBe('Admin users cannot be deleted');
    const adminStillExists = await User.findById(adminUser._id);
    expect(adminStillExists).not.toBeNull();
  });

  test('Returns 500 if database delete operation fails', async () => {
    // Mock findById to return a non-admin user
    const mockUser = {
      _id: userToDelete._id,
      isAdmin: false,
      toObject: () => ({ ...mockUser }),
    };

    // Mock both database operations
    jest.spyOn(User, 'findById').mockResolvedValueOnce(mockUser);
    jest
      .spyOn(User, 'findByIdAndDelete')
      .mockRejectedValueOnce(new Error('Database delete error'));

    const response = await request(app)
      .delete(`/api/admin/users/${userToDelete._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(500);
    expect(response.body.error).toBe('Failed to delete user');

    // Restore the mocks
    jest.restoreAllMocks();
  });
});

describe('Admin Controller - View Stats', () => {
  let adminUser;
  let adminToken;
  // Hit model is required globally

  beforeEach(async () => {
    await User.deleteMany({});
    await Hit.deleteMany({});

    adminUser = new User({
      username: 'adminuser',
      email: 'admin@example.com',
      password: 'password123',
      isAdmin: true,
    });
    await adminUser.save();
    const regularUser1 = new User({
      username: 'regularuser1',
      email: 'regular1@example.com',
      password: 'password123',
      isAdmin: false,
    });
    await regularUser1.save();
    const regularUser2 = new User({
      username: 'regularuser2',
      email: 'regular2@example.com',
      password: 'password123',
      isAdmin: false,
    });
    await regularUser2.save();

    const hit1 = new Hit({
      ipAddress: '192.168.1.1',
      hitCount: 5,
      lastHitAt: new Date(),
    });
    await hit1.save();
    const hit2 = new Hit({
      ipAddress: '192.168.1.2',
      hitCount: 10,
      lastHitAt: new Date(),
    });
    await hit2.save();

    adminToken = jwt.sign({ userId: adminUser._id.toString() }, JWT_SECRET);
  });

  // afterEach removed

  test('GET /api/admin/stats should return system statistics', async () => {
    const response = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.statusCode).toBe(200); // Expect 200
    expect(response.body).toHaveProperty('users');
    expect(response.body).toHaveProperty('pageViews');
    expect(response.body).toHaveProperty('lastUpdated');
    expect(response.body.users.total).toBe(3);
    expect(response.body.users.admins).toBe(1);
    expect(response.body.pageViews.total).toBe(15);
    expect(response.body.pageViews.uniqueVisitors).toBe(2);
  });

  test('Returns 500 if database aggregation fails', async () => {
    const originalAggregate = Hit.aggregate;
    Hit.aggregate = jest.fn().mockImplementationOnce(() => {
      throw new Error('Aggregation error');
    });

    try {
      const response = await request(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.statusCode).toBe(500); // Expect 500
      expect(response.body.error).toBe('Failed to fetch stats');
    } finally {
      Hit.aggregate = originalAggregate; // Restore original
    }
  });
});
