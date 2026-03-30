/**
 * VideoCall Signaling Server
 * Phase 1: Express + Socket.io core
 * Phase 2: HTTPS / wss support
 * Phase 3: CORS lockdown, rate limiting, JWT auth, UUID rooms
 * Phase 4: Deploy-ready (env vars, graceful shutdown, security headers)
 */

const fs         = require('fs');
const path       = require('path');
const https      = require('https');
const http       = require('http');
const express    = require('express');
const { Server } = require('socket.io');
const jwt        = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const cors       = require('cors');

// ─── Config ────────────────────────────────────────────────────────────────
const PORT        = process.env.PORT        || 3000;
const JWT_SECRET  = process.env.JWT_SECRET  || 'change-this-in-production-' + uuidv4();
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://localhost:3000';
const USE_HTTPS   = process.env.USE_HTTPS !== 'false'; // set USE_HTTPS=false for plain HTTP on cloud

const app = express();

// ─── Phase 3: Security headers ─────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'"],
      styleSrc:   ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:    ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:     ["'self'", 'data:', 'blob:'],
      mediaSrc:   ["'self'", 'blob:'],
      connectSrc: ["'self'", 'wss:', 'ws:'],
      manifestSrc:["'self'"],
      workerSrc:  ["'self'"],
    }
  },
  crossOriginEmbedderPolicy: false,
}));

// ─── Phase 3: HTTP rate limiting ───────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down.' }
});
app.use(limiter);

// ─── Phase 3: Express CORS middleware ──────────────────────────────────────
const allowedOrigins = [
  ALLOWED_ORIGIN,
  'https://localhost',
  'capacitor://localhost',
  'http://localhost',
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true
}));

app.use(express.json());
app.use(express.static(__dirname));

// ─── Auth endpoint — issues a short-lived JWT ──────────────────────────────
// In production, validate real credentials here.
app.post('/api/token', (req, res) => {
  const userId = uuidv4(); // anonymous but unique identity
  const token  = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '2h' });
  res.json({ token, userId });
});

// ─── Room creation endpoint ────────────────────────────────────────────────
app.post('/api/room', (req, res) => {
  const roomId = uuidv4(); // unguessable room name (Phase 3)
  res.json({ roomId });
});

// ─── Phase 2: HTTPS server ─────────────────────────────────────────────────
let server;
if (USE_HTTPS && fs.existsSync('server.key') && fs.existsSync('server.cert')) {
  const creds = {
    key:  fs.readFileSync('server.key'),
    cert: fs.readFileSync('server.cert'),
  };
  server = https.createServer(creds, app);
  console.log('[server] Running in HTTPS mode (wss://)');
} else {
  server = http.createServer(app);
  console.log('[server] Running in HTTP mode (ws://) — generate certs for HTTPS');
}

// ─── Socket.io ─────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: (origin, cb) => {
      // Phase 3: lock down to allowed origin only
      // Also allow Capacitor WebView origins
      const allowed = [
        ALLOWED_ORIGIN,
        'https://localhost',
        'capacitor://localhost',
        'http://localhost',
      ];
      if (!origin || allowed.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  // Phase 3: transport hardening
  transports: ['websocket', 'polling'],
  pingTimeout:  20000,
  pingInterval: 25000,
});

// ─── Phase 3: Socket.io rate limiting per-IP ──────────────────────────────
const socketConnectCount = new Map(); // ip → count

io.use((socket, next) => {
  const ip = socket.handshake.address;
  const count = (socketConnectCount.get(ip) || 0) + 1;
  socketConnectCount.set(ip, count);
  if (count > 10) {
    return next(new Error('Too many connections from this IP'));
  }
  next();
});

// ─── Phase 3: JWT authentication middleware ────────────────────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    socket.userId = payload.userId;
    next();
  } catch (e) {
    next(new Error('Invalid or expired token'));
  }
});

// ─── Room state ────────────────────────────────────────────────────────────
const rooms = new Map(); // roomId → Set of socketIds

// ─── Phase 1: Signaling events ────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id} (user: ${socket.userId})`);

  // Phase 3: input validation helper
  const validate = (data, required) => {
    if (typeof data !== 'object' || data === null) return false;
    return required.every(k => data[k] !== undefined);
  };

  // Join a room
  socket.on('join', ({ roomId }) => {
    if (typeof roomId !== 'string' || roomId.length < 10 || roomId.length > 64) {
      return socket.emit('error', { message: 'Invalid room ID' });
    }

    const room = rooms.get(roomId) || new Set();

    if (room.size >= 2) {
      return socket.emit('room-full');
    }

    room.add(socket.id);
    rooms.set(roomId, room);
    socket.join(roomId);
    socket.currentRoom = roomId;

    const peers = [...room].filter(id => id !== socket.id);
    socket.emit('room-joined', { roomId, peers });

    // Tell existing peer a new user arrived
    peers.forEach(peerId => {
      io.to(peerId).emit('peer-joined', { peerId: socket.id });
    });

    console.log(`[room] ${roomId} — ${room.size}/2 peers`);
  });

  // WebRTC offer
  socket.on('offer', (data) => {
    if (!validate(data, ['to', 'offer'])) return;
    socket.to(data.to).emit('offer', { from: socket.id, offer: data.offer });
  });

  // WebRTC answer
  socket.on('answer', (data) => {
    if (!validate(data, ['to', 'answer'])) return;
    socket.to(data.to).emit('answer', { from: socket.id, answer: data.answer });
  });

  // ICE candidates
  socket.on('ice-candidate', (data) => {
    if (!validate(data, ['to', 'candidate'])) return;
    socket.to(data.to).emit('ice-candidate', { from: socket.id, candidate: data.candidate });
  });

  // Chat message (Phase 3: sanitize text)
  socket.on('chat', (data) => {
    if (!validate(data, ['roomId', 'text'])) return;
    const text = String(data.text).slice(0, 500).replace(/[<>]/g, c => c === '<' ? '&lt;' : '&gt;');
    io.to(data.roomId).emit('chat', { from: socket.id, text, ts: Date.now() });
  });

  // Disconnect cleanup
  socket.on('disconnect', () => {
    const ip = socket.handshake.address;
    const count = socketConnectCount.get(ip) || 1;
    socketConnectCount.set(ip, Math.max(0, count - 1));

    if (socket.currentRoom) {
      const room = rooms.get(socket.currentRoom);
      if (room) {
        room.delete(socket.id);
        if (room.size === 0) rooms.delete(socket.currentRoom);
        else socket.to(socket.currentRoom).emit('peer-left', { peerId: socket.id });
      }
    }
    console.log(`[socket] disconnected: ${socket.id}`);
  });
});

// ─── Phase 4: Graceful shutdown ────────────────────────────────────────────
process.on('SIGTERM', () => {
  console.log('[server] SIGTERM — shutting down gracefully');
  io.close();
  server.close(() => process.exit(0));
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`[server] Listening on port ${PORT}`);
    console.log(`[server] Open: ${USE_HTTPS ? 'https' : 'http'}://localhost:${PORT}`);
    console.log(`[server] JWT secret: ${JWT_SECRET.slice(0, 12)}...`);
  });
}

module.exports = { app, server, io };
