/**
 * @jest-environment node
 */

const { server, app, io } = require('../server');
const request = require('supertest');
const ioClient = require('socket.io-client');

describe('Socket join event - Room Capacity', () => {
  let port;
  let testServer;
  let clients = [];

  beforeAll((done) => {
    // Check if the server is already listening
    if (!server.listening) {
      testServer = server.listen(0, () => {
        port = testServer.address().port;
        done();
      });
    } else {
      testServer = server;
      port = testServer.address().port;
      done();
    }
  });

  afterAll((done) => {
    clients.forEach(c => c.disconnect());
    clients = []; // clear clients
    // Close the socket.io server
    io.close(() => {
      // Then close the HTTP server
      if (testServer && testServer.listening) {
        testServer.close(done);
      } else {
        done();
      }
    });
  });

  it('should prevent a third client from joining a full room and emit room-full', async () => {
    // 1. Get tokens for three clients
    const [token1, token2, token3] = await Promise.all([
      request(app).post('/api/token').expect(200).then(res => res.body.token),
      request(app).post('/api/token').expect(200).then(res => res.body.token),
      request(app).post('/api/token').expect(200).then(res => res.body.token)
    ]);

    // 2. Create a room
    const roomRes = await request(app).post('/api/room').expect(200);
    const roomId = roomRes.body.roomId;

    // 3. Connect three clients
    const createClient = (token) => {
      return new Promise((resolve) => {
        const client = ioClient(`http://localhost:${port}`, {
          auth: { token },
          transports: ['websocket'],
          forceNew: true
        });
        client.on('connect', () => {
          clients.push(client);
          resolve(client);
        });
      });
    };

    const client1 = await createClient(token1);
    const client2 = await createClient(token2);
    const client3 = await createClient(token3);

    // 4. Client 1 and Client 2 join the room
    const joinRoom = (client, rId) => {
      return new Promise((resolve, reject) => {
        client.emit('join', { roomId: rId });

        client.once('room-joined', (data) => resolve(data));
        client.once('room-full', () => reject(new Error('Room unexpectedly full')));
        client.once('error', (err) => reject(err));
      });
    };

    await joinRoom(client1, roomId);
    await joinRoom(client2, roomId);

    // 5. Client 3 attempts to join and should receive 'room-full'
    await new Promise((resolve, reject) => {
      client3.emit('join', { roomId });

      client3.once('room-full', () => {
        resolve(); // Success! We expected this.
      });

      client3.once('room-joined', () => {
        reject(new Error('Client 3 joined a full room!'));
      });

      // Timeout after 2 seconds if no event is received
      setTimeout(() => reject(new Error('Timeout waiting for room-full event')), 2000);
    });
  });
});
