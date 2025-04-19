
# Contact Form API Ticket Breakdown

## 🎯 Epic: Contact Form API

### Story 1: Define Data Model
**Description:** Create the Mongoose schema for storing contact form submissions.
- **Tasks:**
  1. Create `models/ContactMessage.js`.
  2. Define schema fields:
     - `fullName` (String, required)
     - `email` (String, required)
     - `message` (String, required)
     - `ipAddress` (String, optional)
     - `submittedAt` (Date, default now)
  3. Add model export.
- **Acceptance Criteria:**
  - Schema fields enforce required constraints.
  - Default timestamp is set for new documents.

### Story 2: Implement Rate Limiting
**Description:** Prevent abuse by limiting submissions per IP.
- **Tasks:**
  1. Install `express-rate-limit`.
  2. Create `middleware/rateLimiter.js`.
  3. Configure limiter:
     - `windowMs`: 1 hour
     - `max`: 5 requests
     - Custom error message JSON.
  4. Write unit tests mocking excessive requests.
- **Acceptance Criteria:**
  - Rate limiter blocks after 5 requests per IP/hour.
  - Blocked requests receive correct status and JSON error.

### Story 3: Submit Contact Controller
**Description:** Handle incoming submissions and save to database.
- **Tasks:**
  1. Create `controllers/contactController.js`.
  2. Implement `submitContact(req, res)`:
     - Extract `fullName`, `email`, `message`.
     - Capture `ipAddress`.
     - Save new `ContactMessage`.
     - Return 201 with success JSON.
  3. Add error handling for server errors.
  4. Write integration tests for successful and failing saves.
- **Acceptance Criteria:**
  - Valid requests result in database document and 201 response.
  - Server errors return 500 with JSON error.

### Story 4: Route Setup
**Description:** Expose the contact submission endpoint.
- **Tasks:**
  1. Create `routes/contact.js`.
  2. Define `POST /api/contact` with `contactLimiter` and `submitContact`.
  3. Mount in `server.js`: `app.use('/api/contact', contactRoutes)`.
  4. Test endpoint via Postman or curl.
- **Acceptance Criteria:**
  - Endpoint accepts and processes submissions.
  - Rate limiting is applied.

### Task 5: Documentation
**Description:** Document the Contact Form API for developers.
- **Tasks:**
  1. Update `contactFormAPI.md` with:
     - Data model details.
     - Rate limiter setup.
     - Controller and route code snippets.
     - Example request/response.
  2. Verify documentation matches implementation.
- **Acceptance Criteria:**
  - Documentation is clear and accurate.
  - Developers can integrate front-end form based solely on docs.

### Task 6: Optional Enhancement — Email Notification
**Description:** Notify admin on new submissions.
- **Tasks:**
  1. Integrate `nodemailer` in `submitContact`.
  2. Read SMTP config from `.env`.
  3. Send plain-text email with submission details.
  4. Write tests mocking email transport.
- **Acceptance Criteria:**
  - Emails are sent for each submission.
  - Failures to send do not prevent saving the submission.
