
# API Backend Ticket Breakdown

## 🔒 Epic 3: JWT Authentication

### Story 3.1: User Model
**Description**: Define the User schema in MongoDB with necessary fields and helper methods for password reset.
- **Tasks**:
  1. Create `models/User.js` file.
  2. Define schema fields:
     - `username` (String, required)
     - `email` (String, required, unique)
     - `password` (String, required)
     - `resetPasswordToken` (String, optional)
     - `resetPasswordExpires` (Date, optional)
  3. Implement `createPasswordReset()` instance method to:
     - Generate a random token.
     - Hash it via SHA-256 and store in `resetPasswordToken`.
     - Set `resetPasswordExpires` based on `RESET_TOKEN_EXPIRES` env.
     - Return the plaintext token.
  4. Write unit tests to verify:
     - Schema validation rules.
     - `createPasswordReset()` results in token and expiry correctly set.
- **Acceptance Criteria**:
  - Mongoose model compiles without errors.
  - Fields enforce required/unique constraints.
  - `createPasswordReset()` sets hashed token and expiry date.

### Story 3.2: Signup & Login Endpoints
**Description**: Implement user registration and authentication routes using JWT.
- **Tasks**:
  1. Create `controllers/authController.js` with `signup` and `login` functions.
  2. In `signup`:
     - Validate request body (username, email, password).
     - Check for existing user by email.
     - Hash password with bcrypt (salt rounds = 12).
     - Save new user to database.
     - Generate JWT (`userId` payload, expiresIn 7d).
     - Return JSON `{ token, userId }` with status 201.
  3. In `login`:
     - Validate request body (email, password).
     - Find user by email.
     - Compare password via bcrypt.
     - On success, generate and return JWT.
     - On failure, return 401 with error message.
  4. Create `routes/auth.js` and map:
     - `POST /api/auth/signup` → `signup`
     - `POST /api/auth/login`  → `login`
  5. Write integration tests to verify:
     - Successful signup returns token and userId.
     - Duplicate email on signup returns 400.
     - Successful login returns token.
     - Invalid credentials return 401.
- **Acceptance Criteria**:
  - Endpoints return appropriate HTTP status codes.
  - JWT tokens are valid and include correct payload.
  - Passwords are stored hashed.

### Story 3.3: JWT Middleware
**Description**: Create middleware to protect routes by verifying JWT tokens.
- **Tasks**:
  1. Implement `middleware/auth.js`:
     - Extract token from `Authorization` header (`Bearer <token>`).
     - Verify token using `JWT_SECRET`.
     - Attach `req.userId` from decoded token.
     - On error, return 401 Unauthorized.
  2. Add unit tests or mock requests to ensure:
     - Requests with no token receive 401.
     - Invalid/expired tokens receive 401.
     - Valid tokens allow access and set `req.userId`.
- **Acceptance Criteria**:
  - Middleware correctly authorizes valid tokens.
  - Unauthorized requests handled with proper error response.

### Story 3.4: Protect Views Endpoint
**Description**: Ensure the `/api/views/register-view` route requires a valid JWT.
- **Tasks**:
  1. Import and apply `auth` middleware to views route in `server.js` or `routes/views.js`.
  2. Verify that unauthenticated requests to `/api/views/register-view` return 401.
  3. Verify that authenticated requests still function and return `uniqueViewCount`.
  4. Update `views.md` to note the authentication requirement.
- **Acceptance Criteria**:
  - Unauthorized requests are denied access.
  - Authorized requests continue to work.

### Task 3.5: Document Auth Flow
**Description**: Update `auth.md` to reflect implementation details and usage examples.
- **Tasks**:
  1. Ensure `auth.md` includes:
     - Environment variable definitions.
     - User model schema and helper method.
     - Controller code snippets for signup, login, forgot/reset password.
     - Route definitions.
     - JWT middleware usage.
     - Example Postman test steps.
  2. Review document for accuracy and clarity.
- **Acceptance Criteria**:
  - `auth.md` provides a comprehensive guide for developers.
  - Examples are copy-paste ready and validated against actual code.

