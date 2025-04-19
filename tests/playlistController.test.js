const {
  extractMp3Links,
  validateUrl,
  validateFolderPath,
  getPlaylistFromRemoteFolder,
  getPlaylistFromLocalFolder,
} = require('../controllers/playlistController');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const { promisify } = require('util');

// Mock axios and fs modules
jest.mock('axios');
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readdir: jest.fn(),
}));

describe('Playlist Controller Unit Tests', () => {
  describe('extractMp3Links', () => {
    it('should extract MP3 links from HTML content', () => {
      const html = `
        <html>
          <body>
            <a href="song1.mp3">Song 1</a>
            <a href="song2.mp3">Song 2</a>
            <a href="not-a-song.txt">Not a song</a>
            <a href="song3.mp3"></a>
            <a href="UPPERCASE.MP3">Uppercase Extension</a>
          </body>
        </html>
      `;
      const baseUrl = 'https://example.com/music/';

      const result = extractMp3Links(html, baseUrl);

      expect(result).toHaveLength(4);
      expect(result[0]).toEqual({
        title: 'Song 1',
        url: 'https://example.com/music/song1.mp3',
      });
      expect(result[1]).toEqual({
        title: 'Song 2',
        url: 'https://example.com/music/song2.mp3',
      });
      expect(result[2]).toEqual({
        title: 'Song3',
        url: 'https://example.com/music/song3.mp3',
      });
      expect(result[3]).toEqual({
        title: 'Uppercase Extension',
        url: 'https://example.com/music/UPPERCASE.MP3',
      });
    });

    it('should handle relative URLs correctly', () => {
      const html = `
        <html>
          <body>
            <a href="../songs/song1.mp3">Song 1</a>
            <a href="/root/song2.mp3">Song 2</a>
          </body>
        </html>
      `;
      const baseUrl = 'https://example.com/music/folder/';

      const result = extractMp3Links(html, baseUrl);

      expect(result).toHaveLength(2);
      expect(result[0].url).toBe('https://example.com/music/songs/song1.mp3');
      expect(result[1].url).toBe('https://example.com/root/song2.mp3');
    });

    it('should generate titles from filenames when link text is empty', () => {
      const html = `
        <html>
          <body>
            <a href="my-awesome-song.mp3"></a>
            <a href="another_great_track.mp3"></a>
          </body>
        </html>
      `;
      const baseUrl = 'https://example.com/music/';

      const result = extractMp3Links(html, baseUrl);

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('My Awesome Song');
      expect(result[1].title).toBe('Another Great Track');
    });
  });

  describe('validateUrl', () => {
    it('should accept valid HTTP URLs', () => {
      const url = 'http://example.com/music/';
      expect(validateUrl(url)).toBe(url);
    });

    it('should accept valid HTTPS URLs', () => {
      const url = 'https://example.com/music/';
      expect(validateUrl(url)).toBe(url);
    });

    it('should reject URLs with invalid protocols', () => {
      expect(() => validateUrl('ftp://example.com/music/')).toThrow(
        'URL must use HTTP or HTTPS protocol',
      );
      expect(() => validateUrl('file:///C:/music/')).toThrow(
        'URL must use HTTP or HTTPS protocol',
      );
    });

    it('should reject invalid URL formats', () => {
      expect(() => validateUrl('not-a-url')).toThrow('Invalid URL');
      expect(() => validateUrl('http:/example.com')).toThrow('Invalid URL');
    });
  });

  describe('validateFolderPath', () => {
    it('should sanitize and normalize valid paths', () => {
      expect(validateFolderPath('/music/')).toBe('music');
      expect(validateFolderPath('music/')).toBe('music');
      expect(validateFolderPath('/music/subfolder/')).toBe('music/subfolder');
    });

    it('should reject paths with directory traversal attempts', () => {
      expect(() => validateFolderPath('../music')).toThrow(
        'Directory traversal is not allowed',
      );
      expect(() => validateFolderPath('music/../../etc')).toThrow(
        'Directory traversal is not allowed',
      );
      expect(() => validateFolderPath('/music/../../../etc')).toThrow(
        'Directory traversal is not allowed',
      );
    });
  });

  describe('getPlaylistFromRemoteFolder', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should fetch HTML and extract MP3 links', async () => {
      // Mock HTML response
      const mockHtml = `
        <html>
          <body>
            <a href="song1.mp3">Song 1</a>
            <a href="song2.mp3">Song 2</a>
          </body>
        </html>
      `;

      // Mock axios.get to return the HTML
      axios.get.mockResolvedValueOnce({ data: mockHtml });

      const result = await getPlaylistFromRemoteFolder(
        'https://example.com/music/',
      );

      // Verify axios was called with the correct URL
      expect(axios.get).toHaveBeenCalledWith('https://example.com/music/');

      // Verify the result contains the expected tracks
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Song 1');
      expect(result[0].url).toBe('https://example.com/music/song1.mp3');
    });

    it('should handle network errors', async () => {
      // Mock axios.get to throw an error
      axios.get.mockRejectedValueOnce(new Error('Network error'));

      // Verify the function throws an error with the expected message
      await expect(
        getPlaylistFromRemoteFolder('https://example.com/music/'),
      ).rejects.toThrow('Failed to fetch remote playlist: Network error');
    });

    it('should validate URLs before fetching', async () => {
      // Try to fetch from an invalid URL
      await expect(getPlaylistFromRemoteFolder('invalid-url')).rejects.toThrow(
        'Failed to fetch remote playlist: Invalid URL',
      );

      // Verify axios was not called
      expect(axios.get).not.toHaveBeenCalled();
    });
  });

  describe('getPlaylistFromLocalFolder', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should read directory and return MP3 files', async () => {
      // Mock fs.readdir to return a list of files
      fs.readdir.mockImplementationOnce((path, callback) => {
        callback(null, ['song1.mp3', 'song2.mp3', 'not-a-song.txt']);
      });

      // Mock request object
      const req = {
        protocol: 'http',
        get: jest.fn().mockReturnValue('example.com'),
      };

      const result = await getPlaylistFromLocalFolder('music', req);

      // Verify fs.readdir was called with the correct path
      expect(fs.readdir).toHaveBeenCalled();
      expect(fs.readdir.mock.calls[0][0]).toContain(
        path.join('public', 'music', 'music'),
      );

      // Verify the result contains the expected tracks
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Song1');
      expect(result[1].title).toBe('Song2');

      // Verify URLs are correctly formed
      expect(result[0].url).toContain('http://example.com/');
      expect(result[0].url).toContain('song1.mp3');
    });

    it('should handle filesystem errors', async () => {
      // Mock fs.readdir to throw an error
      fs.readdir.mockImplementationOnce((path, callback) => {
        callback(new Error('Directory not found'), null);
      });

      // Mock request object
      const req = {
        protocol: 'http',
        get: jest.fn().mockReturnValue('example.com'),
      };

      // Verify the function throws an error with the expected message
      await expect(
        getPlaylistFromLocalFolder('nonexistent', req),
      ).rejects.toThrow('Failed to read local playlist: Directory not found');
    });

    it('should validate folder paths before reading', async () => {
      // Mock request object
      const req = {
        protocol: 'http',
        get: jest.fn().mockReturnValue('example.com'),
      };

      // Try to read from a path with directory traversal
      await expect(getPlaylistFromLocalFolder('../etc', req)).rejects.toThrow(
        'Failed to read local playlist: Directory traversal is not allowed',
      );

      // Verify fs.readdir was not called
      expect(fs.readdir).not.toHaveBeenCalled();
    });
  });
});
