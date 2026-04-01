/**
 * @jest-environment node
 */

const { app, server, io } = require('../server');
const request = require('supertest');
const { io: Client } = require('socket.io-client');

describe('Socket.io Chat Event Sanitization', () => {
  let port;
  let client1, client2;
  let roomId;

  beforeAll((done) => {
    // Start the server on a random port
    server.listen(0, () => {
      port = server.address().port;
      done();
    });
  });

  afterAll((done) => {
    // Close clients and server after all tests
    if (client1) client1.disconnect();
    if (client2) client2.disconnect();
    io.close();
    server.close(done);
  });

  afterEach(() => {
    if (client1) client1.disconnect();
    if (client2) client2.disconnect();
  });

  it('should sanitize HTML tags from chat messages', (done) => {
    Promise.all([
      request(app).post('/api/token'),
      request(app).post('/api/token'),
      request(app).post('/api/room')
    ]).then(([res1, res2, resRoom]) => {
      const token1 = res1.body.token;
      const token2 = res2.body.token;
      roomId = resRoom.body.roomId;

      client1 = new Client(`http://localhost:${port}`, { auth: { token: token1 } });
      client2 = new Client(`http://localhost:${port}`, { auth: { token: token2 }, autoConnect: false });

      client1.on('connect', () => {
        client1.emit('join', { roomId });
      });

      client1.on('room-joined', () => {
        // Only connect client 2 after client 1 has joined the room
        // to guarantee client 1 receives the peer-joined event.
        client2.connect();
      });

      client2.on('connect', () => {
        client2.emit('join', { roomId });
      });

      // Client 2 receives the chat message
      client2.on('chat', (data) => {
        try {
          expect(data.from).toBe(client1.id);
          expect(data.text).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
          expect(data.ts).toBeDefined();
          done();
        } catch (e) {
          done(e);
        }
      });

      // When client 2 joins, client 1 sends a chat message
      client1.on('peer-joined', () => {
        client1.emit('chat', { roomId, text: '<script>alert(1)</script>' });
      });
    }).catch(done);
  });

  it('should truncate chat messages exceeding 500 characters', (done) => {
    Promise.all([
      request(app).post('/api/token'),
      request(app).post('/api/token'),
      request(app).post('/api/room')
    ]).then(([res1, res2, resRoom]) => {
      const token1 = res1.body.token;
      const token2 = res2.body.token;
      roomId = resRoom.body.roomId;

      client1 = new Client(`http://localhost:${port}`, { auth: { token: token1 } });
      client2 = new Client(`http://localhost:${port}`, { auth: { token: token2 }, autoConnect: false });

      client1.on('connect', () => {
        client1.emit('join', { roomId });
      });

      client1.on('room-joined', () => {
        client2.connect();
      });

      client2.on('connect', () => {
        client2.emit('join', { roomId });
      });

      client2.on('chat', (data) => {
        try {
          expect(data.from).toBe(client1.id);
          expect(data.text.length).toBe(500);
          expect(data.text).toBe('a'.repeat(500));
          done();
        } catch (e) {
          done(e);
        }
      });

      client1.on('peer-joined', () => {
        const longText = 'a'.repeat(600);
        client1.emit('chat', { roomId, text: longText });
      });
    }).catch(done);
  });

  it('should handle non-string chat messages gracefully', (done) => {
    Promise.all([
      request(app).post('/api/token'),
      request(app).post('/api/token'),
      request(app).post('/api/room')
    ]).then(([res1, res2, resRoom]) => {
      const token1 = res1.body.token;
      const token2 = res2.body.token;
      roomId = resRoom.body.roomId;

      client1 = new Client(`http://localhost:${port}`, { auth: { token: token1 } });
      client2 = new Client(`http://localhost:${port}`, { auth: { token: token2 }, autoConnect: false });

      client1.on('connect', () => {
        client1.emit('join', { roomId });
      });

      client1.on('room-joined', () => {
        client2.connect();
      });

      client2.on('connect', () => {
        client2.emit('join', { roomId });
      });

      client2.on('chat', (data) => {
        try {
          expect(data.from).toBe(client1.id);
          expect(typeof data.text).toBe('string');
          // Object converted to string would be "[object Object]"
          expect(data.text).toBe('[object Object]');
          done();
        } catch (e) {
          done(e);
        }
      });

      client1.on('peer-joined', () => {
        client1.emit('chat', { roomId, text: { hacker: true } });
      });
    }).catch(done);
  });

  it('should drop chat messages lacking required fields', (done) => {
    Promise.all([
      request(app).post('/api/token'),
      request(app).post('/api/room')
    ]).then(([res1, resRoom]) => {
      const token1 = res1.body.token;
      roomId = resRoom.body.roomId;

      client1 = new Client(`http://localhost:${port}`, { auth: { token: token1 } });

      client1.on('connect', () => {
        client1.emit('join', { roomId });
      });

      client1.on('room-joined', () => {
        // Send a chat event without 'text'
        client1.emit('chat', { roomId });

        // Wait a bit to verify no error occurred and server is still up
        setTimeout(() => {
          done();
        }, 200);
      });
    }).catch(done);
  });
});
