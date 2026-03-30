const request = require('supertest');
const { app } = require('../server');

describe('API Endpoints', () => {
  describe('POST /api/room', () => {
    it('should create a room and return a valid UUIDv4', async () => {
      const response = await request(app).post('/api/room');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('roomId');

      const { roomId } = response.body;
      expect(typeof roomId).toBe('string');

      // UUID v4 regex pattern
      const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(roomId).toMatch(uuidV4Regex);
    });
  });
});
