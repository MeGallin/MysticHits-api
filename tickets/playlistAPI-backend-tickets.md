# 🎧 Epic: Remote Playlist Generator API

This file includes **backend-related tickets** for enabling both remote and same-domain playlist generation via API.

## ✅ Story 1: Create Playlist Route
**Description**: Add a new route `/api/playlist` that accepts either a folder URL or a local folder path and returns a list of `.mp3` tracks.

### Tasks:
- [ ] Create a new file `routes/playlist.js`.
- [ ] Define route: `GET /api/playlist?url=https://example.com/folder/` and `GET /api/playlist?folder=/music/`.
- [ ] Validate presence of either `url` or `folder` query param.
- [ ] Export router and mount in `server.js`.

**Acceptance Criteria**:
- API responds with 400 if neither `url` nor `folder` is provided.
- API is accessible at `/api/playlist`.

---

## ✅ Story 2: Implement Playlist Controller (Remote & Local)
**Description**: Build logic to handle both external and same-domain local folders.

### Tasks:
- [ ] If `url` is provided:
  - Use `axios` and `cheerio` to fetch remote HTML and extract `.mp3` links.
- [ ] If `folder` is provided:
  - Use `fs.readdir()` to list files from local filesystem under `/public/music/`.
  - Build URLs relative to the app domain.
- [ ] Return JSON playlist: `{ title, url }`.

**Acceptance Criteria**:
- JSON response contains an array of tracks from remote or local folders.
- Tracks are correctly resolved and returned.
- Errors handled gracefully.

---

## ✅ Story 5: Validate and Sanitize Input
**Description**: Ensure only safe and valid inputs are processed by the backend.

### Tasks:
- [ ] Validate external URLs for protocol and format.
- [ ] Validate local folder paths to prevent directory traversal (`../`).
- [ ] Whitelist folder roots if needed (e.g., only `/public/music/`).

**Acceptance Criteria**:
- Invalid input returns 400 with clear error.
- Folder and URL injection is prevented.

---

## ✅ Story 6: Testing and Error Handling
**Description**: Ensure reliability through tests and robust handling.

### Tasks:
- [ ] Unit test `getPlaylistFromRemoteFolder()` with mocked HTML.
- [ ] Unit test `getPlaylistFromLocalFolder()` with a mock `fs` interface.
- [ ] Integration test endpoint with real paths.
- [ ] Test error cases (bad folder, bad URL, empty folder, permission denied).

**Acceptance Criteria**:
- All functions pass tests and return consistent error responses.

---

## 🧩 Optional Enhancements
- [ ] Add caching for commonly used folders.
- [ ] Return duration/metadata using an audio tag preload or ffprobe.
- [ ] Enable grouping by subfolder or genre automatically.

## 🧩 Optional Enhancements

- [ ] Add caching for commonly used folders.
- [ ] Return duration/metadata using an audio tag preload or ffprobe.
- [ ] Enable grouping by subfolder or genre automatically.
