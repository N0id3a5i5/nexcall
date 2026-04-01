/**
 * @jest-environment node
 */
const { server, io } = require('../server');
const Client = require('socket.io-client');

describe('Socket.io Signaling Events', () => {
  let port, clientSocket, token;

  beforeAll(async () => {
    // Avoid port conflicts by using port 0 (OS assigns a random free port)
    await new Promise((resolve) => {
      server.listen(0, () => {
        port = server.address().port;
        resolve();
      });
    });

    // Obtain a valid token to bypass JWT auth middleware
    const res = await fetch(`http://localhost:${port}/api/token`, { method: 'POST' });
    const data = await res.json();
    token = data.token;
  });

  afterAll(() => {
    io.close();
    server.close();
  });

  beforeEach((done) => {
    clientSocket = Client(`http://localhost:${port}`, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    clientSocket.on('connect', done);
  });

  afterEach(() => {
    if (clientSocket.connected) {
      clientSocket.close();
    }
  });

  describe('join event', () => {
    it('should emit error when roomId is missing', (done) => {
      clientSocket.on('error', (err) => {
        expect(err.message).toBe('Invalid room ID');
        done();
      });

      clientSocket.emit('join', {});
    });

    it('should emit error when roomId is not a string', (done) => {
      clientSocket.on('error', (err) => {
        expect(err.message).toBe('Invalid room ID');
        done();
      });

      clientSocket.emit('join', { roomId: 1234567890 });
    });

    it('should emit error when roomId is too short (< 10 chars)', (done) => {
      clientSocket.on('error', (err) => {
        expect(err.message).toBe('Invalid room ID');
        done();
      });

      clientSocket.emit('join', { roomId: 'short' });
    });

    it('should emit error when roomId is too long (> 64 chars)', (done) => {
      clientSocket.on('error', (err) => {
        expect(err.message).toBe('Invalid room ID');
        done();
      });

      const longRoomId = 'a'.repeat(65);
      clientSocket.emit('join', { roomId: longRoomId });
    });

    it('should join successfully when roomId is valid', (done) => {
      const validRoomId = 'valid-room-id-1234'; // 18 chars long
      clientSocket.on('room-joined', (data) => {
        expect(data.roomId).toBe(validRoomId);
        expect(data.peers).toEqual([]);
        done();
      });

      clientSocket.emit('join', { roomId: validRoomId });
    });
  });
});
