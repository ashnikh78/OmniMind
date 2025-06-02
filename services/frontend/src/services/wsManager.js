// src/services/wsManager.js
let socket = null;

const wsManager = {
  connect: (url) => {
    socket = new WebSocket(url);
    socket.onopen = () => console.log('WebSocket connected');
    socket.onclose = () => console.log('WebSocket disconnected');
  },
  disconnect: () => {
    if (socket) {
      socket.close();
      console.log('WebSocket closed');
      socket = null;
    }
  },
  getSocket: () => socket,
};

export default wsManager;
