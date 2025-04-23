const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../models/User');

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

describe('User Admin Role Tests', () => {
  afterEach(async () => {
    await User.deleteMany({});
  });

  test('New users should have isAdmin set to false by default', async () => {
    const userData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
    };

    const newUser = new User(userData);
    await newUser.save();

    const savedUser = await User.findOne({ email: 'test@example.com' });
    expect(savedUser.isAdmin).toBe(false);
  });

  test('User can be promoted to admin', async () => {
    // Create regular user
    const userData = {
      username: 'regularuser',
      email: 'regular@example.com',
      password: 'password123',
    };
    const user = new User(userData);
    await user.save();

    // Promote to admin
    await User.findOneAndUpdate(
      { email: 'regular@example.com' },
      { isAdmin: true },
    );

    // Verify promotion
    const updatedUser = await User.findOne({ email: 'regular@example.com' });
    expect(updatedUser.isAdmin).toBe(true);
  });
});
