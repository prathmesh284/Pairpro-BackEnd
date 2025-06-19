const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const socketToRoom = {};
const roomToSockets = {};

io.on('connection', (socket) => {
  console.log(`🔌 New socket connected: ${socket.id}`);

  socket.on('join-room', ({ roomId }) => {
    console.log(`user joined`);

    if (!roomToSockets[roomId]) {
      roomToSockets[roomId] = [];
    }

    const room = roomToSockets[roomId];

    if (room.length >= 2) {
      socket.emit('room-full');
      return;
    }

    if (!room.includes(socket.id)) {
      room.push(socket.id);
      socketToRoom[socket.id] = roomId;
      socket.join(roomId);
    }

    const otherUser = room.find(id => id !== socket.id);
    if (otherUser) {
      socket.emit('user-joined', { socketId: otherUser });
      console.log(`🔁 Sent user-joined to ${socket.id} to connect with ${otherUser}`);
    }

    console.log(`✅ ${socket.id} joined room ${roomId}`);
  });

  socket.on('send-offer', ({ offer, to }) => {
    io.to(to).emit('receive-offer', { offer, from: socket.id });
  });

  socket.on('send-answer', ({ answer, to }) => {
    io.to(to).emit('receive-answer', { answer, from: socket.id });
  });

  socket.on('send-ice-candidate', ({ candidate, to }) => {
    io.to(to).emit('receive-ice-candidate', { candidate, from: socket.id });
  });

  // Code editor collaboration events
  socket.on('code-change', ({ roomId, code }) => {
    console.log('room id: ', roomId);
    socket.to(roomId).emit('code-change', code);
  });

  socket.on('cursor-change', ({ roomId, cursorData }) => {
    console.log('cursor-change emitted');
    socket.to(roomId).emit('cursor-change', {
      socketId: socket.id,
      cursorData,
    });
  });

  // 💬 Chat message handling
  socket.on('send-message', ({ roomId, message }) => {
    console.log(`💬 Message in room ${ roomId }:`, message);
    socket.to(roomId).emit('receive-message', message);
  });

  // On Tab Switch Warning
  socket.on('tab-warning', ({ roomId, userId }) => {
    socket.to(roomId).emit('peer-tab-warning');
    socket.emit('tab-switch-ack');
  });

  // Malicious-detection
  socket.on("malicious-detected", ({ roomId, userId }) => {
  socket.to(roomId).emit("peer-malicious-detected", { userId });

});
  socket.on('disconnect', () => {
    const roomId = socketToRoom[socket.id];
    const room = roomToSockets[roomId];
    if (room) {
      roomToSockets[roomId] = room.filter(id => id !== socket.id);
      if (roomToSockets[roomId].length === 0) {
        delete roomToSockets[roomId];
      }
    }
    delete socketToRoom[socket.id];

    const peers = roomToSockets[roomId] || [];
    peers.forEach(peerId => {
      io.to(peerId).emit('user-left', { socketId: socket.id });
    });

    console.log(`❌ User disconnected: ${socket.id}`);
  });
});

server.listen(5000, () => {
  console.log('🚀 Server listening on port 5000');
});