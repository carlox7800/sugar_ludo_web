import { io } from 'socket.io-client';

const socket = io('https://juego-de-servidor.onrender.com/', {
  transports: ['websocket', 'polling'],
});

socket.on('connect', () => {
  console.log('Connected! Emitting get_room_info...');
  socket.emit('get_room_info', { roomCode: '123456', code: '123456' }, (res) => {
    console.log('Ack get_room_info:', res);
  });

  socket.emit('check_room', { roomCode: '123456', code: '123456' }, (res) => {
    console.log('Ack check_room:', res);
  });
  
  socket.on('room_error', (err) => console.log('room_error:', err));
  socket.on('room_info', (info) => console.log('room_info:', info));

  setTimeout(() => {
    socket.disconnect();
    process.exit(0);
  }, 3000);
});

socket.on('connect_error', (err) => {
  console.error('Connect Error:', err);
  process.exit(1);
});
