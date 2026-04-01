/**
 * @jest-environment node
 */

const request = require('supertest');
const { app, server, io, rateLimitMiddleware, socketConnectCount } = require('./server');
const Client = require('socket.io-client');

describe('Server Export Verification', () => {
  it('should export the app, server, and io instances', () => {
    expect(app).toBeDefined();
    expect(server).toBeDefined();
    expect(io).toBeDefined();
  });
});

describe('Express API Endpoints', () => {
  it('GET / should serve static files (or return 404 if index.html missing without throwing error)', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).not.toBe(500);
  });

  it('POST /api/token should return a valid JWT token and userId', async () => {
    const res = await request(app).post('/api/token');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('userId');
    expect(typeof res.body.token).toBe('string');
    expect(typeof res.body.userId).toBe('string');
  });

  it('POST /api/room should return a valid roomId', async () => {
    const res = await request(app).post('/api/room');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('roomId');
    expect(typeof res.body.roomId).toBe('string');
  });
});

describe('Socket.io Rate Limiting Middleware', () => {
  beforeEach(() => {
    socketConnectCount.clear();
  });

  afterEach(() => {
    socketConnectCount.clear();
  });

  it('should allow connections if the IP has less than or equal to 10 connections', () => {
    const mockSocket = { handshake: { address: '192.168.1.1' } };
    const mockNext = jest.fn();

    for (let i = 0; i < 10; i++) {
      rateLimitMiddleware(mockSocket, mockNext);
    }

    expect(mockNext).toHaveBeenCalledTimes(10);
  });

  it('should block the 11th connection from the same IP with an error', () => {
    const mockSocket = { handshake: { address: '192.168.1.1' } };
    const mockNext = jest.fn();

    for (let i = 0; i < 10; i++) {
      rateLimitMiddleware(mockSocket, mockNext);
    }

    rateLimitMiddleware(mockSocket, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(11);
    expect(mockNext).toHaveBeenLastCalledWith(new Error('Too many connections from this IP'));
  });

  it('should track connections per IP address separately', () => {
    const mockSocket1 = { handshake: { address: '192.168.1.1' } };
    const mockSocket2 = { handshake: { address: '10.0.0.1' } };
    const mockNext1 = jest.fn();
    const mockNext2 = jest.fn();

    for (let i = 0; i < 10; i++) {
      rateLimitMiddleware(mockSocket1, mockNext1);
      rateLimitMiddleware(mockSocket2, mockNext2);
    }

    rateLimitMiddleware(mockSocket1, mockNext1);
    expect(mockNext1).toHaveBeenLastCalledWith(new Error('Too many connections from this IP'));

    rateLimitMiddleware(mockSocket2, mockNext2);
    expect(mockNext2).toHaveBeenLastCalledWith(new Error('Too many connections from this IP'));
  });
});

describe('Socket.IO Server Events Integration', () => {
  let port;
  let serverUrl;
  let clientSocket1;
  let clientSocket2;
  let clientSocket3;
  let token1, token2, token3;
  let roomId;

  beforeAll(async () => {
    return new Promise((resolve) => {
      server.listen(0, () => {
        port = server.address().port;
        serverUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  afterAll((done) => {
    io.close();
    server.close(done);
  });

  beforeEach(async () => {
    let res = await request(app).post('/api/token');
    token1 = res.body.token;

    res = await request(app).post('/api/token');
    token2 = res.body.token;

    res = await request(app).post('/api/token');
    token3 = res.body.token;

    res = await request(app).post('/api/room');
    roomId = res.body.roomId;
  });

  afterEach(() => {
    if (clientSocket1 && clientSocket1.connected) clientSocket1.disconnect();
    if (clientSocket2 && clientSocket2.connected) clientSocket2.disconnect();
    if (clientSocket3 && clientSocket3.connected) clientSocket3.disconnect();
  });

  it('should reject connection without token', (done) => {
    clientSocket1 = Client(serverUrl, { transports: ['websocket'] });
    clientSocket1.on('connect_error', (err) => {
      expect(err.message).toBe('Authentication required');
      done();
    });
  });

  it('should reject connection with invalid token', (done) => {
    clientSocket1 = Client(serverUrl, { auth: { token: 'invalid.token.here' }, transports: ['websocket'] });
    clientSocket1.on('connect_error', (err) => {
      expect(err.message).toBe('Invalid or expired token');
      done();
    });
  });

  it('should connect successfully with a valid token', (done) => {
    clientSocket1 = Client(serverUrl, { auth: { token: token1 }, transports: ['websocket'] });
    clientSocket1.on('connect', () => {
      expect(clientSocket1.id).toBeDefined();
      done();
    });
  });

  it('should allow a client to join a valid room and broadcast peer-joined', (done) => {
    clientSocket1 = Client(serverUrl, { auth: { token: token1 }, transports: ['websocket'] });

    clientSocket1.on('connect', () => {
      clientSocket1.emit('join', { roomId });
    });

    clientSocket1.on('room-joined', (data) => {
      expect(data.roomId).toBe(roomId);
      expect(data.peers).toHaveLength(0); // 1st user, no peers

      // Now join the second client
      clientSocket2 = Client(serverUrl, { auth: { token: token2 }, transports: ['websocket'] });

      clientSocket2.on('connect', () => {
        clientSocket2.emit('join', { roomId });
      });

      clientSocket2.on('room-joined', (data2) => {
        expect(data2.roomId).toBe(roomId);
        expect(data2.peers).toHaveLength(1);
        expect(data2.peers).toContain(clientSocket1.id);
      });
    });

    clientSocket1.on('peer-joined', (data) => {
      expect(data.peerId).toBe(clientSocket2.id);
      done();
    });
  });

  it('should handle invalid room join gracefully', (done) => {
    clientSocket1 = Client(serverUrl, { auth: { token: token1 }, transports: ['websocket'] });

    clientSocket1.on('connect', () => {
      clientSocket1.emit('join', { roomId: 'short' });
    });

    clientSocket1.on('error', (err) => {
      expect(err.message).toBe('Invalid room ID');
      done();
    });
  });

  it('should emit room-full when a 3rd user tries to join', (done) => {
    clientSocket1 = Client(serverUrl, { auth: { token: token1 }, transports: ['websocket'] });

    clientSocket1.on('connect', () => clientSocket1.emit('join', { roomId }));

    clientSocket1.on('room-joined', () => {
      clientSocket2 = Client(serverUrl, { auth: { token: token2 }, transports: ['websocket'] });
      clientSocket2.on('connect', () => clientSocket2.emit('join', { roomId }));

      clientSocket2.on('room-joined', () => {
        clientSocket3 = Client(serverUrl, { auth: { token: token3 }, transports: ['websocket'] });
        clientSocket3.on('connect', () => clientSocket3.emit('join', { roomId }));

        clientSocket3.on('room-full', () => {
          done();
        });
      });
    });
  });

  it('should relay offer, answer, and ice-candidate events to the target peer', (done) => {
    clientSocket1 = Client(serverUrl, { auth: { token: token1 }, transports: ['websocket'] });

    clientSocket1.on('connect', () => clientSocket1.emit('join', { roomId }));

    clientSocket1.on('room-joined', () => {
      clientSocket2 = Client(serverUrl, { auth: { token: token2 }, transports: ['websocket'] });
      clientSocket2.on('connect', () => clientSocket2.emit('join', { roomId }));

      clientSocket2.on('offer', (data) => {
        expect(data.from).toBe(clientSocket1.id);
        expect(data.offer.sdp).toBe('test-sdp');

        clientSocket2.emit('answer', { to: data.from, answer: { type: 'answer', sdp: 'test-answer' } });
      });

      clientSocket2.on('ice-candidate', (data) => {
        expect(data.from).toBe(clientSocket1.id);
        expect(data.candidate.candidate).toBe('candidate-string');
        done();
      });
    });

    clientSocket1.on('peer-joined', (data) => {
      const peerId = data.peerId;
      clientSocket1.emit('offer', { to: peerId, offer: { type: 'offer', sdp: 'test-sdp' } });
    });

    clientSocket1.on('answer', (data) => {
      expect(data.from).toBe(clientSocket2.id);
      expect(data.answer.sdp).toBe('test-answer');

      clientSocket1.emit('ice-candidate', { to: data.from, candidate: { candidate: 'candidate-string' } });
    });
  });

  it('should broadcast chat messages and sanitize HTML', (done) => {
    clientSocket1 = Client(serverUrl, { auth: { token: token1 }, transports: ['websocket'] });

    clientSocket1.on('connect', () => clientSocket1.emit('join', { roomId }));

    clientSocket1.on('room-joined', () => {
      clientSocket2 = Client(serverUrl, { auth: { token: token2 }, transports: ['websocket'] });
      clientSocket2.on('connect', () => clientSocket2.emit('join', { roomId }));

      clientSocket2.on('chat', (data) => {
        expect(data.from).toBe(clientSocket1.id);
        expect(data.text).toBe('Hello &lt;b&gt;world&lt;/b&gt;'); // Sanitized
        expect(data.ts).toBeDefined();
        done();
      });
    });

    clientSocket1.on('peer-joined', () => {
      clientSocket1.emit('chat', { roomId, text: 'Hello <b>world</b>' });
    });
  });

  it('should emit peer-left when a user disconnects', (done) => {
    clientSocket1 = Client(serverUrl, { auth: { token: token1 }, transports: ['websocket'] });

    clientSocket1.on('connect', () => clientSocket1.emit('join', { roomId }));

    clientSocket1.on('room-joined', () => {
      clientSocket2 = Client(serverUrl, { auth: { token: token2 }, transports: ['websocket'] });
      clientSocket2.on('connect', () => clientSocket2.emit('join', { roomId }));
    });

    let client2Id;

    clientSocket1.on('peer-joined', (data) => {
      client2Id = data.peerId;
      clientSocket2.disconnect();
    });

    clientSocket1.on('peer-left', (data) => {
      expect(data.peerId).toBe(client2Id);
      done();
    });
  });
});
