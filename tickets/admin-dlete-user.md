
# 🗑️ Story: Admin – Delete User

A focused story that fits into the Admin Dashboard epics.

---

## 🎯 Goal  
Allow an authenticated **admin** to delete any user account.

| Aspect            | Details                                               |
|-------------------|-------------------------------------------------------|
| **Endpoint**      | `DELETE /api/admin/users/:id`                         |
| **Frontend Path** | `/admin/users` (Users table)                          |
| **Permissions**   | JWT token must include `isAdmin === true`             |

---

## 🔙 Backend Tasks

| # | Task | Unit Tests |
|---|------|------------|
| 1 | Add `deleteUser` controller method | • Non‑admin token → 403<br>• Invalid ID → 400<br>• Valid admin + ID → 200 and user removed |
| 2 | Create route in `routes/admin.js` with `adminMiddleware` | Covered by Supertest |
| 3 | Ensure `adminMiddleware` blocks non‑admins | Part of above tests |

**Controller pseudocode**

```js
exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id))
    return res.status(400).json({ error: 'Invalid user ID' });

  const user = await User.findByIdAndDelete(id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({ success: true, message: 'User deleted' });
};
```

---

## 🎨 Frontend Tasks

| # | Task | Unit Tests (RTL) |
|---|------|------------------|
| 1 | Add Delete button per row (shadcn button w/ icon) | Button opens dialog |
| 2 | Confirm dialog (`alert-dialog`) | Confirm triggers DELETE fetch |
| 3 | Update list on success & show toast | Row removed from DOM |
| 4 | Hide button for non‑admins | Render guard test |

**UI pseudocode**

```tsx
function DeleteUserButton({ id, email }) {
  const [open, setOpen] = useState(false);

  const handleDelete = async () => {
    await deleteUser(id); // DELETE /api/admin/users/:id
    mutateUsers();        // Refetch or remove locally
    setOpen(false);
  };

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
        <Trash className="h-4 w-4" />
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <p>Delete user <b>{email}</b>?</p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
```

---

### ✅ Definition of Done
* Backend route returns correct status codes; Jest + Supertest tests pass.  
* Users table updates immediately after deletion; React‑Testing‑Library tests pass.  
* Non‑admin users cannot see or trigger the delete feature.
