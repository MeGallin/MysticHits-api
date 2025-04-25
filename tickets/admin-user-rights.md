# 🛡️ Story: Admin – Grant or Revoke Admin Rights

Enable existing admins to promote a normal user to **admin** status (or demote back to user) via the dashboard.

---

## 🎯 Goal

Authenticated admins can toggle the `isAdmin` flag of any user account.

| Aspect            | Details                                         |
| ----------------- | ----------------------------------------------- |
| **Endpoint**      | `PATCH /api/admin/users/:id/role`               |
| **Payload**       | `{ "isAdmin": true }` or `{ "isAdmin": false }` |
| **Permissions**   | Requester must already be `isAdmin === true`    |
| **Frontend Path** | `/admin/users` table – role toggle switch       |

---

## 🔙 Backend Tasks

| #   | Task                                                                         | Unit Tests                                                                                    |
| --- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1   | **Add controller** `changeUserRole`                                          | • Invalid ID → 400<br>• Non-admin requester → 403<br>• Role updated → 200 & updated user JSON |
| 2   | **Route** `PATCH /api/admin/users/:id/role` protected with `adminMiddleware` | Supertest confirms protection                                                                 |
| 3   | **Validation** Ensure body contains boolean `isAdmin`                        | Test 422 when payload missing                                                                 |
| 4   | **Unit Tests** (Jest + Supertest)                                            | Cover all scenarios above                                                                     |

### Controller (pseudocode)

```js
exports.changeUserRole = async (req, res) => {
  const { id } = req.params;
  const { isAdmin } = req.body;
  if (typeof isAdmin !== 'boolean')
    return res.status(422).json({ error: 'isAdmin boolean required' });

  if (!mongoose.Types.ObjectId.isValid(id))
    return res.status(400).json({ error: 'Invalid user ID' });

  const user = await User.findByIdAndUpdate(
    id,
    { isAdmin },
    { new: true, select: '-password' },
  );
  if (!user) return res.status(404).json({ error: 'User not found' });

  res.json({ success: true, data: user });
};
```
