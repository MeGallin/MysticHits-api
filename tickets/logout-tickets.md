
# 🔒 Logout Functionality - Ticket Breakdown

This document includes tickets and pseudocode for implementing logout functionality in both the backend (Node/Express) and frontend (React + JWT).

---

## ✅ Ticket 1: Backend - Create Logout Endpoint

### Description
Create a logout endpoint that clears authentication state or provides a hook for future token revocation (if using cookies or refresh tokens).

### Tasks:
- [ ] Add `logoutUser` function in `authController.js`
- [ ] Create route `POST /api/auth/logout` and connect to controller
- [ ] Optionally clear secure cookie (`res.clearCookie("token")`)
- [ ] Send JSON confirmation message

### Pseudocode

```js
// authController.js
exports.logoutUser = (req, res) => {
  // If using cookies:
  // res.clearCookie("token");

  return res.status(200).json({
    success: true,
    message: "Logged out successfully.",
  });
};
```

```js
// routes/auth.js
router.post('/logout', authController.logoutUser);
```

---

## ✅ Ticket 2: Frontend - Implement Logout Handler

### Description
Allow users to log out by clearing stored authentication tokens and optionally redirecting to the login or home page.

### Tasks:
- [ ] Create utility function `logoutUser()` in `fetchService.js` or `auth.ts`
- [ ] Clear token from localStorage or session
- [ ] Redirect to login page
- [ ] Optionally call `POST /api/auth/logout` (for cookies or server tracking)

### Pseudocode

```ts
// fetchService.ts or utils/auth.ts
export function logoutUser() {
  localStorage.removeItem("token");
  // Optionally notify the backend:
  // fetch("/api/auth/logout", { method: "POST" });

  // Redirect logic (depends on router)
  window.location.href = "/login";
}
```

---

## ✅ Notes

- This basic logout is client-side only, which is fine for stateless JWT usage.
- If switching to refresh tokens in the future, add backend token blacklisting or cookie clearing.
