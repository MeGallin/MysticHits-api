
# 🛠️ Admin Dashboard - Backend & Frontend Stories (with Unit Tests)

This document outlines the stories and tasks for building a basic admin dashboard, including unit test requirements for each backend and frontend feature.

---

## 🔙 Backend Stories

### ✅ Story: Add Admin Role to User Schema
**Description:** Extend the user model to support role-based access by adding an `isAdmin` boolean field.

**Tasks:**
- [ ] Update MongoDB User schema to include `isAdmin: { type: Boolean, default: false }`
- [ ] Ensure new users default to non-admin
- [ ] Create an admin user manually (or seed if needed)

**Unit Tests:**
- [ ] Test default value of `isAdmin` on new user creation
- [ ] Test promotion of a user to admin

---

### ✅ Story: Create Admin Middleware
**Description:** Protect sensitive endpoints by checking if the JWT-authenticated user has admin privileges.

**Tasks:**
- [ ] Create `adminMiddleware.js`
- [ ] Extract user ID from JWT token
- [ ] Query DB to confirm `isAdmin: true`
- [ ] Send `403 Forbidden` if unauthorized

**Unit Tests:**
- [ ] Middleware returns 403 if user is not admin
- [ ] Middleware allows access for admin users

---

### ✅ Story: Admin - View All Users
**Endpoint:** `GET /api/admin/users`

**Tasks:**
- [ ] Implement route with adminMiddleware
- [ ] Fetch all users (filter: exclude passwords)
- [ ] Return as JSON

**Unit Tests:**
- [ ] Mock DB call and return full list of users
- [ ] Ensure passwords are not included in response

---

### ✅ Story: Admin - Delete User
**Endpoint:** `DELETE /api/admin/users/:id`

**Tasks:**
- [ ] Validate user ID
- [ ] Delete user from DB
- [ ] Return success or error message

**Unit Tests:**
- [ ] Return 404 if user not found
- [ ] Return success on valid deletion

---

### ✅ Story: Admin - View Stats
**Endpoint:** `GET /api/admin/stats`

**Tasks:**
- [ ] Return total users, total songs, page views
- [ ] Use existing counters or aggregation queries

**Unit Tests:**
- [ ] Mock DB aggregation and return expected data
- [ ] Return default values on error

---

## 🎨 Frontend Stories

### ✅ Story: Admin Route Protection
**Description:** Prevent non-admins from accessing the dashboard.

**Tasks:**
- [ ] On login, decode JWT and check `isAdmin` claim
- [ ] Protect `/admin` routes via route guard or useEffect check
- [ ] Redirect unauthorized users

**Unit Tests:**
- [ ] Component redirects if user is not admin
- [ ] Allows access to admin route if user is admin

---

### ✅ Story: Admin Dashboard Layout
**Description:** Create a sidebar layout with navigation links to different admin sections.

**Tasks:**
- [ ] Use shadcn NavigationMenu or Sidebar
- [ ] Add routes: Users, Music, Stats, Messages
- [ ] Highlight active route

**Unit Tests:**
- [ ] Renders sidebar and nav links
- [ ] Active route is highlighted correctly

---

### ✅ Story: Admin - View Users Page
**Path:** `/admin/users`

**Tasks:**
- [ ] Fetch users from `/api/admin/users`
- [ ] Display in a table with columns: Email, Role, Actions
- [ ] Style with Tailwind or shadcn table components

**Unit Tests:**
- [ ] Table displays correct number of users
- [ ] Each user row contains expected fields

---

### ✅ Story: Admin - Delete User (UI)
**Path:** `/admin/users`

**Tasks:**
- [ ] Add Delete button per row
- [ ] Confirm via dialog (shadcn)
- [ ] Call `DELETE /api/admin/users/:id` and refresh list

**Unit Tests:**
- [ ] Delete button triggers confirmation modal
- [ ] API call succeeds and row is removed from list

---

### ✅ Story: Admin - View Stats Page
**Path:** `/admin/stats`

**Tasks:**
- [ ] Call `/api/admin/stats`
- [ ] Display summary blocks: Total Users, Total Songs, Views
- [ ] Optionally use a chart (Recharts or shadcn Card with icons)

**Unit Tests:**
- [ ] Stats block renders with correct data
- [ ] Handles API failure gracefully

---
