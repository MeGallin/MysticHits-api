const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const ContactMessage = require('../models/ContactMessage');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Test data
const TEST_ADMIN = {
  username: 'testadmin',
  email: 'admin@example.com',
  password: 'Password123!',
  isAdmin: true,
};

const TEST_MESSAGES = [
  {
    fullName: 'John Smith',
    email: 'john@example.com',
    subject: 'Website Feedback',
    message: 'Love the new playlist feature! Great job with the latest update.',
    submittedAt: new Date('2025-04-23'),
    read: true,
    important: false,
  },
  {
    fullName: 'Sarah Wilson',
    email: 'sarah@example.com',
    subject: 'Technical Issue',
    message: 'I encountered an issue when trying to create a playlist. The page freezes after I click "Save".',
    submittedAt: new Date('2025-04-22'),
    read: false,
    important: true,
  },
  {
    fullName: 'Michael Brown',
    email: 'michael@example.com',
    subject: 'Music Suggestion',
    message: 'Would love to see more jazz music in the collection. Any plans to add more jazz artists?',
    submittedAt: new Date('2025-04-22'),
    read: false,
    important: false,
  }
];

// Setup and teardown
beforeAll(async () => {
  // Connect to test DB
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(
      process.env.MONGO_URI || 'mongodb://localhost:27017/mystichits_test',
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      },
    );
  }

  // Create admin user for testing
  await User.deleteMany({});
  const admin = new User(TEST_ADMIN);
  await admin.save();
});

beforeEach(async () => {
  // Clear messages before each test
  await ContactMessage.deleteMany({});
  // Insert test messages
  await ContactMessage.insertMany(TEST_MESSAGES);
});

afterAll(async () => {
  await ContactMessage.deleteMany({});
  await User.deleteMany({});
  await mongoose.disconnect();
});

// Helper function to get admin token
const getAdminToken = async () => {
  const admin = await User.findOne({ isAdmin: true });
  return jwt.sign(
    { id: admin._id, isAdmin: admin.isAdmin },
    process.env.JWT_SECRET || 'test-jwt-secret',
    { expiresIn: '1h' }
  );
};

describe('Admin Message API', () => {
  // GET all messages
  it('should get all messages', async () => {
    const token = await getAdminToken();
    
    const res = await request(app)
      .get('/api/admin/messages')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    
    expect(res.body).toHaveLength(3);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('name');
    expect(res.body[0]).toHaveProperty('email');
    expect(res.body[0]).toHaveProperty('subject');
    expect(res.body[0]).toHaveProperty('message');
    expect(res.body[0]).toHaveProperty('date');
    expect(res.body[0]).toHaveProperty('read');
    expect(res.body[0]).toHaveProperty('important');
  });

  // GET filtered messages (unread)
  it('should get unread messages with filter', async () => {
    const token = await getAdminToken();
    
    const res = await request(app)
      .get('/api/admin/messages?filter=unread')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    
    expect(res.body).toHaveLength(2);
    expect(res.body.every(msg => msg.read === false)).toBe(true);
  });

  // GET filtered messages (important)
  it('should get important messages with filter', async () => {
    const token = await getAdminToken();
    
    const res = await request(app)
      .get('/api/admin/messages?filter=important')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    
    expect(res.body).toHaveLength(1);
    expect(res.body.every(msg => msg.important === true)).toBe(true);
    expect(res.body[0].email).toBe('sarah@example.com');
  });

  // GET single message with valid ID
  it('should get a single message and mark it as read', async () => {
    const token = await getAdminToken();
    
    // Find an unread message
    const unreadMessage = await ContactMessage.findOne({ read: false });
    expect(unreadMessage.read).toBe(false);
    
    const res = await request(app)
      .get(`/api/admin/messages/${unreadMessage._id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    
    expect(res.body).toHaveProperty('id', unreadMessage._id.toString());
    expect(res.body).toHaveProperty('name', unreadMessage.fullName);
    expect(res.body).toHaveProperty('email', unreadMessage.email);
    expect(res.body).toHaveProperty('subject', unreadMessage.subject);
    expect(res.body).toHaveProperty('read', true);  // Should now be marked as read
    
    // Check it was updated in DB
    const updatedMessage = await ContactMessage.findById(unreadMessage._id);
    expect(updatedMessage.read).toBe(true);
  });

  // GET with invalid ID
  it('should return 400 for invalid message ID', async () => {
    const token = await getAdminToken();
    
    const res = await request(app)
      .get('/api/admin/messages/invalid-id')
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
    
    expect(res.body).toHaveProperty('error', 'Invalid message ID format');
  });

  // PATCH update message (mark as important)
  it('should update message important flag', async () => {
    const token = await getAdminToken();
    
    // Find a non-important message
    const message = await ContactMessage.findOne({ important: false });
    
    const res = await request(app)
      .patch(`/api/admin/messages/${message._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ important: true })
      .expect(200);
    
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('message', 'Message updated successfully');
    expect(res.body.data).toHaveProperty('important', true);
    
    // Check it was updated in DB
    const updatedMessage = await ContactMessage.findById(message._id);
    expect(updatedMessage.important).toBe(true);
  });

  // PATCH update message (mark as read)
  it('should update message read flag', async () => {
    const token = await getAdminToken();
    
    // Find an unread message
    const message = await ContactMessage.findOne({ read: false });
    
    const res = await request(app)
      .patch(`/api/admin/messages/${message._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ read: true })
      .expect(200);
    
    expect(res.body).toHaveProperty('success', true);
    expect(res.body.data).toHaveProperty('read', true);
    
    // Check it was updated in DB
    const updatedMessage = await ContactMessage.findById(message._id);
    expect(updatedMessage.read).toBe(true);
  });

  // PATCH with invalid data
  it('should return 400 for invalid update data', async () => {
    const token = await getAdminToken();
    
    const message = await ContactMessage.findOne();
    
    const res = await request(app)
      .patch(`/api/admin/messages/${message._id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({}) // No data provided
      .expect(400);
    
    expect(res.body).toHaveProperty('error', 'No properties to update');
  });

  // DELETE message
  it('should delete a message', async () => {
    const token = await getAdminToken();
    
    const message = await ContactMessage.findOne();
    const messageId = message._id;
    
    const res = await request(app)
      .delete(`/api/admin/messages/${messageId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('message', 'Message deleted successfully');
    
    // Check it was deleted from DB
    const deletedMessage = await ContactMessage.findById(messageId);
    expect(deletedMessage).toBeNull();
  });

  // DELETE with invalid ID
  it('should return 404 for deleting non-existent message', async () => {
    const token = await getAdminToken();
    
    // Create a valid ObjectId but one that doesn't exist
    const nonExistentId = new mongoose.Types.ObjectId();
    
    const res = await request(app)
      .delete(`/api/admin/messages/${nonExistentId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    
    expect(res.body).toHaveProperty('error', 'Message not found');
  });

  // Admin security test - should reject non-admin users
  it('should reject non-admin users', async () => {
    // Create non-admin user
    const regularUser = new User({
      username: 'regularuser',
      email: 'user@example.com',
      password: 'Password123!',
      isAdmin: false
    });
    await regularUser.save();
    
    // Generate token for regular user
    const regularToken = jwt.sign(
      { id: regularUser._id, isAdmin: regularUser.isAdmin },
      process.env.JWT_SECRET || 'test-jwt-secret',
      { expiresIn: '1h' }
    );
    
    // Try to access admin endpoint
    const res = await request(app)
      .get('/api/admin/messages')
      .set('Authorization', `Bearer ${regularToken}`)
      .expect(403);
    
    expect(res.body).toHaveProperty('error');
    
    // Clean up
    await User.findByIdAndDelete(regularUser._id);
  });
});