# Contact Form API Documentation

This document outlines the Contact Form API endpoints, including rate limiting and MongoDB integration.

---

## 1. Submit Contact Form

**Endpoint:** `POST /api/contact`

**Rate Limit:** 5 requests per hour per IP address

**Request Body:**

```json
{
  "fullName": "John Doe",
  "email": "john@example.com",
  "message": "Hello, I have a question about your services."
}
```

**Success Response (201):**

```json
{
  "success": true,
  "message": "Thank you - we will be in touch!"
}
```

**Error Responses:**

- `400 Bad Request`: Missing required fields
  ```json
  {
    "error": "All fields are required."
  }
  ```
- `429 Too Many Requests`: Rate limit exceeded
  ```json
  {
    "error": "Too many contact requests, please try again later."
  }
  ```
- `500 Server Error`: Server-side error
  ```json
  {
    "error": "Server error, please try again later."
  }
  ```

---

## 2. Admin: Get All Contact Messages

**Endpoint:** `GET /api/contact`

**Authentication:** JWT token required in Authorization header

**Success Response (200):**

```json
[
  {
    "_id": "60f1a5b3e6b3f32d8c9d1234",
    "fullName": "John Doe",
    "email": "john@example.com",
    "message": "Hello, I have a question about your services.",
    "ipAddress": "192.168.1.1",
    "submittedAt": "2023-07-16T12:34:56.789Z"
  },
  {
    "_id": "60f1a5b3e6b3f32d8c9d5678",
    "fullName": "Jane Smith",
    "email": "jane@example.com",
    "message": "I'd like to learn more about your products.",
    "ipAddress": "192.168.1.2",
    "submittedAt": "2023-07-15T10:20:30.456Z"
  }
]
```

**Error Responses:**

- `401 Unauthorized`: Missing or invalid JWT token
  ```json
  {
    "error": "No token provided"
  }
  ```
  or
  ```json
  {
    "error": "Invalid or expired token"
  }
  ```
- `500 Server Error`: Server-side error
  ```json
  {
    "error": "Server error, please try again later."
  }
  ```

---

## 3. Email Notifications

When a contact form is submitted, an email notification is automatically sent to the admin email address configured in the `.env` file (`ADMIN_EMAIL`).

The email contains:

- Submitter's name
- Submitter's email
- Message content
- Submission timestamp
- IP address (for tracking/debugging)

---

## 4. Environment Variables

The following environment variables are used by the Contact Form API:

```
# Admin email to receive contact form notifications
ADMIN_EMAIL=admin@mystichits.com

# Email configuration for sending notifications
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=user@example.com
EMAIL_PASS=your_email_password
EMAIL_FROM=noreply@mystichits.com
```

---

## 5. Data Model

The contact form submissions are stored in the MongoDB database using the following schema:

```javascript
{
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  message: { type: String, required: true },
  ipAddress: { type: String },
  submittedAt: { type: Date, default: Date.now }
}
```
