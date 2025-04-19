const request = require('supertest');
const app = require('../server');
const axios = require('axios');
const fs = require('fs');
const { promisify } = require('util');

// Mock axios and fs modules
jest.mock('axios');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readdir: jest.fn(),
}));

describe('Playlist API Routes', () => {
  describe('GET /api/playlist', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return 400 if neither url nor folder is provided', async () => {
      const res = await request(app).get('/api/playlist');
      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty(
        'message',
        'Either url or folder parameter is required',
      );
    });

    it('should extract mp3 links from remote URL', async () => {
      // Mock axios response with HTML containing mp3 links
      const mockHtml = `
        <html>
          <body>
            <a href="song1.mp3">Song 1</a>
            <a href="song2.mp3">Song 2</a>
            <a href="not-a-song.txt">Not a song</a>
            <a href="song3.mp3"></a>
          </body>
        </html>
      `;

      axios.get.mockResolvedValueOnce({ data: mockHtml });

      const res = await request(app).get(
        '/api/playlist?url=https://example.com/music/',
      );

      expect(axios.get).toHaveBeenCalledWith('https://example.com/music/');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('count', 3);
      expect(res.body.data).toHaveLength(3);

      // Check that the tracks are correctly formatted
      expect(res.body.data[0]).toHaveProperty('title', 'Song 1');
      expect(res.body.data[0]).toHaveProperty(
        'url',
        'https://example.com/music/song1.mp3',
      );
      expect(res.body.data[1]).toHaveProperty('title', 'Song 2');
      expect(res.body.data[1]).toHaveProperty(
        'url',
        'https://example.com/music/song2.mp3',
      );
      expect(res.body.data[2]).toHaveProperty('title', 'Song3');
      expect(res.body.data[2]).toHaveProperty(
        'url',
        'https://example.com/music/song3.mp3',
      );
    });

    it('should handle errors from remote URL', async () => {
      axios.get.mockRejectedValueOnce(new Error('Network error'));

      const res = await request(app).get(
        '/api/playlist?url=https://example.com/music/',
      );

      expect(res.statusCode).toEqual(500);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body.message).toContain('Failed to fetch remote playlist');
    });

    it('should list mp3 files from local folder', async () => {
      // Mock fs.readdir to return a list of files
      fs.readdir.mockImplementationOnce((path, callback) => {
        callback(null, [
          'song1.mp3',
          'song2.mp3',
          'not-a-song.txt',
          'song3.MP3',
        ]);
      });

      const res = await request(app).get('/api/playlist?folder=/music/');

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('count', 3);
      expect(res.body.data).toHaveLength(3);

      // Check that the tracks are correctly formatted
      expect(res.body.data[0]).toHaveProperty('title', 'Song1');
      expect(res.body.data[1]).toHaveProperty('title', 'Song2');
      expect(res.body.data[2]).toHaveProperty('title', 'Song3');

      // Check that URLs are correctly formed - be flexible with slashes
      expect(res.body.data[0].url).toMatch(/public.*music.*song1\.mp3/);
    });

    it('should handle errors from local folder', async () => {
      fs.readdir.mockImplementationOnce((path, callback) => {
        callback(new Error('Directory not found'), null);
      });

      const res = await request(app).get('/api/playlist?folder=/nonexistent/');

      expect(res.statusCode).toEqual(500);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body.message).toContain('Failed to read local playlist');
    });

    // Input validation tests for Story 5
    it('should reject invalid URL format', async () => {
      const res = await request(app).get('/api/playlist?url=not-a-valid-url');

      expect(res.statusCode).toEqual(500);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body.message).toContain('Invalid URL');
    });

    it('should reject URL with unsupported protocol', async () => {
      const res = await request(app).get(
        '/api/playlist?url=ftp://example.com/music/',
      );

      expect(res.statusCode).toEqual(500);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body.message).toContain('URL must use HTTP or HTTPS protocol');
    });

    it('should reject folder path with directory traversal attempt', async () => {
      const res = await request(app).get('/api/playlist?folder=../../../etc');

      expect(res.statusCode).toEqual(500);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body.message).toContain('Directory traversal is not allowed');
    });
  });
});
