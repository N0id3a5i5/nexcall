const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app, JWT_SECRET } = require('../server');
const { validate: isUuid } = require('uuid');

describe('POST /api/token', () => {
  it('should generate a valid JWT token and a unique user ID', async () => {
    const response = await request(app)
      .post('/api/token')
      .expect('Content-Type', /json/)
      .expect(200);

    const { token, userId } = response.body;

    // 1. Check that userId is present and is a valid UUID
    expect(userId).toBeDefined();
    expect(typeof userId).toBe('string');
    expect(isUuid(userId)).toBe(true);

    // 2. Check that token is present and is a string
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');

    // 3. Verify the token signature and contents
    const decoded = jwt.verify(token, JWT_SECRET);

    // The decoded token payload should contain the same userId
    expect(decoded.userId).toBe(userId);

    // Ensure token has expiration logic set (the endpoint sets it to 2h)
    expect(decoded.exp).toBeDefined();
    expect(decoded.iat).toBeDefined();

    // Check roughly that expiration is 2 hours from issued time
    const diffInSeconds = decoded.exp - decoded.iat;
    expect(diffInSeconds).toBe(2 * 60 * 60); // 2 hours
  });
});
