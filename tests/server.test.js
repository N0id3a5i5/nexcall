const request = require('supertest');
const Client = require('socket.io-client');
const { app, server, io } = require('../server');

describe('Server API and Socket.io signaling', () => {
  let httpServer;
  let serverSocket;
  let clientSocket;
  let token;
  let port;

  beforeAll((done) => {
    httpServer = server.listen(0, () => {
      port = httpServer.address().port;
      done();
    });
  });

  afterAll((done) => {
    io.close(done);
  });

  afterEach(() => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('API endpoints', () => {
    it('should issue a JWT token at /api/token', async () => {
      const res = await request(app).post('/api/token');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('userId');
      token = res.body.token; // save for socket tests
    });

    it('should generate a room id at /api/room', async () => {
      const res = await request(app).post('/api/room');
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('roomId');
      expect(typeof res.body.roomId).toBe('string');
    });
  });

  describe('Socket.io signaling', () => {
    beforeEach((done) => {
      if (!token) {
        // Fallback token if not set by earlier test
        const request = require('supertest');
        request(app).post('/api/token').then(res => {
          token = res.body.token;
          done();
        });
      } else {
        done();
      }
    });

    it('should reject connections without a token', (done) => {
      clientSocket = new Client(`http://localhost:${port}`);
      clientSocket.on('connect_error', (err) => {
        expect(err.message).toBe('Authentication required');
        clientSocket.disconnect();
        done();
      });
    });

    it('should reject connections with an invalid token', (done) => {
      clientSocket = new Client(`http://localhost:${port}`, {
        auth: { token: 'invalid_token_123' }
      });
      clientSocket.on('connect_error', (err) => {
        expect(err.message).toBe('Invalid or expired token');
        clientSocket.disconnect();
        done();
      });
    });

    it('should connect successfully with a valid token', (done) => {
      clientSocket = new Client(`http://localhost:${port}`, {
        auth: { token }
      });
      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });
    });

    describe('Room management', () => {
      let roomId;

      beforeEach(async () => {
        const res = await request(app).post('/api/room');
        roomId = res.body.roomId;
      });

      it('should allow a user to join a valid room', (done) => {
        clientSocket = new Client(`http://localhost:${port}`, {
          auth: { token }
        });

        clientSocket.on('connect', () => {
          clientSocket.emit('join', { roomId });
        });

        clientSocket.on('room-joined', (data) => {
          expect(data.roomId).toBe(roomId);
          expect(Array.isArray(data.peers)).toBe(true);
          done();
        });
      });

      it('should reject invalid room IDs', (done) => {
        clientSocket = new Client(`http://localhost:${port}`, {
          auth: { token }
        });

        clientSocket.on('connect', () => {
          clientSocket.emit('join', { roomId: 'short' });
        });

        clientSocket.on('error', (err) => {
          expect(err.message).toBe('Invalid room ID');
          done();
        });
      });

      it('should enforce a max limit of 2 users per room', (done) => {
        const client1 = new Client(`http://localhost:${port}`, { auth: { token } });
        const client2 = new Client(`http://localhost:${port}`, { auth: { token } });
        const client3 = new Client(`http://localhost:${port}`, { auth: { token } });

        let joinedCount = 0;

        const checkDone = () => {
          if (joinedCount === 2) {
            client3.emit('join', { roomId });
          }
        };

        client1.on('room-joined', () => { joinedCount++; checkDone(); });
        client2.on('room-joined', () => { joinedCount++; checkDone(); });

        client3.on('room-full', () => {
          client1.disconnect();
          client2.disconnect();
          client3.disconnect();
          done();
        });

        client1.on('connect', () => client1.emit('join', { roomId }));
        client2.on('connect', () => client2.emit('join', { roomId }));
      });
    });

    describe('Signaling events', () => {
      let client1, client2;
      let roomId;

      beforeEach(async () => {
        const res = await request(app).post('/api/room');
        roomId = res.body.roomId;
        client1 = new Client(`http://localhost:${port}`, { auth: { token } });
        client2 = new Client(`http://localhost:${port}`, { auth: { token } });
      });

      afterEach(() => {
        client1.disconnect();
        client2.disconnect();
      });

      it('should broadcast peer-joined when a second user joins', (done) => {
        client1.on('connect', () => {
          client1.emit('join', { roomId });
        });

        client1.on('room-joined', () => {
          client2.connect();
          client2.emit('join', { roomId });
        });

        client1.on('peer-joined', (data) => {
          expect(data.peerId).toBe(client2.id);
          done();
        });
      });

      it('should relay offers, answers, and candidates between peers', (done) => {
        let eventsRelayed = 0;
        const checkDone = () => {
          eventsRelayed++;
          if (eventsRelayed === 3) done();
        };

        client1.on('connect', () => client1.emit('join', { roomId }));

        client1.on('room-joined', () => {
          client2.connect();
          client2.emit('join', { roomId });
        });

        client2.on('room-joined', () => {
          // Both are joined, start signaling from client1 -> client2
          client1.emit('offer', { to: client2.id, offer: { type: 'offer', sdp: 'fake-sdp' } });
        });

        client2.on('offer', (data) => {
          expect(data.from).toBe(client1.id);
          expect(data.offer.sdp).toBe('fake-sdp');
          checkDone();
          // client2 replies with answer
          client2.emit('answer', { to: client1.id, answer: { type: 'answer', sdp: 'fake-answer-sdp' } });
        });

        client1.on('answer', (data) => {
          expect(data.from).toBe(client2.id);
          expect(data.answer.sdp).toBe('fake-answer-sdp');
          checkDone();
          // client1 sends ICE candidate
          client1.emit('ice-candidate', { to: client2.id, candidate: { candidate: 'fake-ice' } });
        });

        client2.on('ice-candidate', (data) => {
          expect(data.from).toBe(client1.id);
          expect(data.candidate.candidate).toBe('fake-ice');
          checkDone();
        });
      });

      it('should relay chat messages and sanitize HTML', (done) => {
        client1.on('connect', () => client1.emit('join', { roomId }));

        client1.on('room-joined', () => {
          client2.connect();
          client2.emit('join', { roomId });
        });

        client2.on('room-joined', () => {
          client1.emit('chat', { roomId, text: '<script>alert("xss")</script>Hello' });
        });

        client2.on('chat', (data) => {
          expect(data.from).toBe(client1.id);
          expect(data.text).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;Hello');
          done();
        });
      });
    });
  });
});