const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const setupSocketHandlers = require('../../server/socket/socketHandler');

describe('Socket.io Message Handlers', () => {
  let io, serverSocket, clientSocket;

  beforeAll((done) => {
    const httpServer = createServer();
    io = new Server(httpServer);
    // Attach your project's specific socket logic
    setupSocketHandlers(io); 
    
    httpServer.listen(() => {
      const port = httpServer.address().port;
      clientSocket = new Client(`http://localhost:${port}`);
      io.on('connection', (socket) => {
        serverSocket = socket;
      });
      clientSocket.on('connect', done);
    });
  });

  afterAll(() => {
    io.close();
    clientSocket.close();
  });

  it('should broadcast a message to a specific room', (done) => {
    const testMessage = { text: 'Hello World', roomId: 'room123', sender: 'UserA' };

    clientSocket.emit('join_group', 'room123'); // Assuming you have a join handler
    
    clientSocket.on('receive_message', (msg) => {
      expect(msg.text).toBe('Hello World');
      expect(msg.sender).toBe('UserA');
      done();
    });

    // Simulate sending a message after joining
    setTimeout(() => {
      clientSocket.emit('send_message', testMessage);
    }, 50);
  });
});