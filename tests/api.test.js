/**
 * @jest-environment node
 */

const request = require('supertest');
const { app } = require('../server');
const { validate: isUuid } = require('uuid');

describe('API Endpoints', () => {
  describe('POST /api/room', () => {
    it('should create a room and return a valid UUID roomId', async () => {
      const res = await request(app)
        .post('/api/room')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(res.body).toHaveProperty('roomId');
      expect(typeof res.body.roomId).toBe('string');
      expect(isUuid(res.body.roomId)).toBe(true);
    });

    it('should not allow GET requests to the room creation endpoint', async () => {
      await request(app)
        .get('/api/room')
        .expect(404);
    });
  });
});
