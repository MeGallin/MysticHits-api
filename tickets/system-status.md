
# ⚡️ System Status – Low‑Hanging Fruit

Quick metrics that provide instant visibility into MysticHits without major infrastructure work.

| Metric | How retrieved | Why it helps |
|--------|---------------|--------------|
| **API heartbeat** | Static JSON `{ status:'ok' }` | Uptime/health check |
| **Process uptime** | `process.uptime()` | Detect container restarts |
| **Memory (RSS)** | `process.memoryUsage().rss` | Spot leaks early |
| **DB connected / ping** | `mongoose.connection.db.admin().ping()` | Detect Atlas outage & latency |

---

## 1  Backend Route – `/api/health`

```js
// routes/health.js
const router = require('express').Router();
const mongoose = require('mongoose');

router.get('/', async (req, res) => {
  const start = Date.now();
  let dbOK = false, latency = null;

  try {
    await mongoose.connection.db.admin().ping();
    dbOK   = true;
    latency = Date.now() - start;
  } catch {/* DB error */ }

  res.json({
    status: 'ok',
    uptimeSec: Math.floor(process.uptime()),
    memoryMB:  +(process.memoryUsage().rss / 1024 / 1024).toFixed(1),
    db: { connected: dbOK, latencyMs: latency },
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
```

```js
// server.js
app.use('/api/health', require('./routes/health'));
```

---

## 2  Admin Dashboard Widget

```tsx
// components/admin/HealthCard.tsx
import useSWR from 'swr';
import { Card } from '@/components/ui/card';

const fetcher = (url:string)=>fetch(url).then(r=>r.json());

export default function HealthCard() {
  const { data, error } = useSWR('/api/health', fetcher, { refreshInterval:60000 });

  if (error) return <Card className="border-red-600 p-4">API down</Card>;
  if (!data)  return <Card className="p-4">Checking API…</Card>;

  return (
    <Card className="p-4">
      <h3 className="font-semibold mb-2">System Status</h3>
      <p>Uptime: {data.uptimeSec}s</p>
      <p>Mem RSS: {data.memoryMB} MB</p>
      <p>DB: {data.db.connected ? 'online' : 'offline'} {data.db.latencyMs ? `(${data.db.latencyMs} ms)` : ''}</p>
    </Card>
  );
}
```

---

## 3  Unit‑Test Skeletons

### Backend (Jest + Supertest)

```js
it('health returns status ok', async () => {
  const res = await request(app).get('/api/health');
  expect(res.status).toBe(200);
  expect(res.body.status).toBe('ok');
});
```

### Frontend (React Testing Library)

```tsx
render(<HealthCard />);
await screen.findByText(/Uptime:/i);
expect(screen.getByText(/DB:/i)).toBeInTheDocument();
```

---

### 🚀 Deployment Steps
1. Add `routes/health.js`; mount in Express.
2. Deploy and configure Render health‑check URL to `/api/health`.
3. Drop `HealthCard` into `/admin/stats`.
4. Optional: Slack alert if `db.connected === false`.
