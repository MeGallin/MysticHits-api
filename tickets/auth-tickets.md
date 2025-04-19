
# API Backend Ticket Breakdown

## 🎯 Epic 1: Project & Infra Setup
1. **Task: Initialize API repo structure**
   - Create `API/` folder  
   - Add `config/`, `controllers/`, `models/`, `routes/`, `middleware/`  
   - Add `.env.example`, `.gitignore`  
2. **Task: Install and configure core dependencies**
   - `express`, `mongoose`, `dotenv`, `cors`  
   - Basic `server.js` that reads `.env` and starts on port 8000  
3. **Task: MongoDB connection module**
   - Write `config/db.js` with connect logic and error handling  
   - Add basic smoke test (logs “Connected”)

## 🔍 Epic 2: Unique-Views API
1. **Story: Define View model**
   - Schema with `ipAddress`, `viewCount`, `lastViewedAt`  
2. **Story: Implement registration controller**
   - `registerView(req, res)` logic to upsert by IP  
   - Return `{ uniqueViewCount }`  
3. **Story: Expose Views route**
   - Add `/api/views/register-view` GET endpoint  
4. **Task: Write unit tests (optional)**
   - Mock `View` model and assert correct increments  
5. **Story: Document Views endpoint**
   - Update `views.md` with usage and examples

## 🔒 Epic 3: JWT Authentication
1. **Story: User Model**
   - Schema with `username`, `email`, `password`, `resetPasswordToken`, `resetPasswordExpires`  
   - Add `createPasswordReset()` method  
2. **Story: Signup & Login Endpoints**
   - `POST /api/auth/signup` → create user + return JWT  
   - `POST /api/auth/login` → verify creds + return JWT  
3. **Story: JWT Middleware**
   - `middleware/auth.js` to validate `Authorization: Bearer <token>`  
   - Attach `req.userId`  
4. **Story: Protect Views Endpoint**
   - Only allow `/api/views/register-view` if JWT present  
5. **Task: Document Auth Flow**
   - Finalize `auth.md`

## 🔑 Epic 4: Password Reset Flow

### Story 4.1: Forgot Password Endpoint
**Description**: Allow users to request a password reset link via email.
- **Tasks**:
  1. In `controllers/authController.js`, implement `forgotPassword` function:
     - Validate `email` in request body.
     - Find user by email; if not found, return 404.
     - Call `user.createPasswordReset()` to generate and save reset token and expiry.
     - Construct reset URL:  
       ```js
       const resetUrl = `${req.protocol}://${req.get('host')}/api/auth/reset-password/${resetToken}`;
       ```
     - Send email with reset URL using nodemailer.
     - Return 200 with confirmation message.
  2. Add route `POST /api/auth/forgot-password` in `routes/auth.js`.
  3. Write tests to verify:
     - Existing email triggers token generation and email sending (mock transporter).
     - Non-existent email returns 404.
- **Acceptance Criteria**:
  - `resetPasswordToken` and `resetPasswordExpires` set on user.
  - Email transporter invoked with correct details.
  - Endpoint returns `{ message: 'Reset email sent' }`.

### Story 4.2: Reset Password Endpoint
**Description**: Allow users to reset their password using a valid reset token.
- **Tasks**:
  1. In `controllers/authController.js`, implement `resetPassword` function:
     - Extract `token` from URL params and `password` from body.
     - Hash token and find user with matching `resetPasswordToken` and unexpired `resetPasswordExpires`.
     - If not found, return 400.
     - Hash new password with bcrypt.
     - Update user's `password`, clear token fields.
     - Save user and return 200 with success message.
  2. Add route `POST /api/auth/reset-password/:token` in `routes/auth.js`.
  3. Write tests to verify:
     - Valid token allows password change.
     - Invalid/expired token returns 400.
- **Acceptance Criteria**:
  - User's password updated in DB.
  - `resetPasswordToken` and `resetPasswordExpires` cleared.
  - Appropriate status codes and messages.

### Task 4.3: Configure Email Transporter
**Description**: Set up `nodemailer` for sending reset emails.
- **Tasks**:
  1. Install and configure `nodemailer` in `controllers/authController.js`.
  2. Read SMTP configs from `.env` (`EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASS`).
  3. Write tests to mock `transporter.sendMail` and assert correct invocation.
- **Acceptance Criteria**:
  - Transporter connects with valid credentials.
  - `sendMail` invoked in `forgotPassword`.

### Task 4.4: Create Email Templates
**Description**: Define email templates for reset instructions.
- **Tasks**:
  1. Create plain-text template for password reset email.
  2. Optionally create HTML template.
  3. Store templates in `templates/` directory or inline.
  4. Test templates include reset link.
- **Acceptance Criteria**:
  - Email body contains correct reset URL.
  - Templates are clear and user-friendly.

### Task 4.5: Document Password Reset
**Description**: Update documentation for password reset flow.
- **Tasks**:
  1. Add “Forgot Password” and “Reset Password” sections to `auth.md`.
  2. Include example requests and responses.
  3. Provide instructions for setting up SMTP env variables.
- **Acceptance Criteria**:
  - `auth.md` reflects accurate instructions and examples.
  - Documentation validated against code.
