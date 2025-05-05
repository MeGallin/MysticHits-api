# 🎙️ Music News & Charts Feed – Project Brief

Deliver a new module that surfaces **current music headlines** and the **Apple Music “Most-Played” chart** in MysticHits.

---

## 🔑 Key Requirements

1. **Backend proxy endpoints**

   - `/api/news` → Music / entertainment headlines (Newsdata.io free tier).
   - `/api/charts/:storefront` → Apple RSS “most-played” songs.
   - Each endpoint caches results for 15 minutes (NodeCache or Redis).

2. **Frontend components**

   - `<NewsGrid>` – grid of headline cards with image, title, source.
   - `<ChartsList>` – ordered list of top tracks with cover art & artist.
   - Auto-refresh every 60 s (hits cached JSON, so cheap).

3. **Admin stats page** gains a new “Discover” tab that hosts these lists.

---

## 🌐 External Feeds

| Feed                      | Endpoint                                                                                  | Auth     | Update      |
| ------------------------- | ----------------------------------------------------------------------------------------- | -------- | ----------- |
| Apple Music “Most-Played” | `https://rss.applemarketingtools.com/api/v2/{storefront}/music/most-played/50/songs.json` | none     | hourly      |
| Newsdata.io Entertainment | `https://newsdata.io/api/1/news?apikey=KEY&category=entertainment&language=en`            | free key | ~12 h delay |

---

## 🗄️ Backend Implementation

### 1 `/api/charts/:storefront`

```js
// controllers/chartController.js
const axios = require('axios');
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 900 }); // 15 min

exports.getMostPlayed = async (req, res) => {
  const code = req.params.storefront.toLowerCase();
  const cacheKey = `charts_${code}`;
  if (cache.has(cacheKey)) return res.json(cache.get(cacheKey));

  const url = `https://rss.applemarketingtools.com/api/v2/${code}/music/most-played/50/songs.json`;
  const { data } = await axios.get(url);

  const tracks = data.feed.results.map((t) => ({
    title: t.name,
    artist: t.artistName,
    art: t.artworkUrl100.replace('100x100', '400x400'),
    link: t.url,
    explicit: t.contentAdvisoryRating === 'Explicit',
  }));

  const payload = { updated: data.feed.updated, tracks };
  cache.set(cacheKey, payload);
  res.json(payload);
};
```
