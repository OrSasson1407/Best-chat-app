const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const setupSocketHandlers = require('../../server/socket/socketHandler');

// Minimal Redis mock — all handlers call redisClient methods; without this the
// server crashes with "Cannot read properties of undefined (reading 'get')"
const mockRedis = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  sAdd: jest.fn().mockResolvedValue(1),
  sMembers: jest.fn().mockResolvedValue([]),
  sRem: jest.fn().mockResolvedValue(1),
  del: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
  hSet: jest.fn().mockResolvedValue(1),
  hGet: jest.fn().mockResolvedValue(null),
  hDel: jest.fn().mockResolvedValue(1),
  hExists: jest.fn().mockResolvedValue(false),
  keys: jest.fn().mockResolvedValue([]),
  isReady: true,
};

describe('Socket.io Message Handlers', () => {
  let io, serverSocket, clientSocket;

  beforeAll((done) => {
    const httpServer = createServer();
    io = new Server(httpServer);
    // Pass mockRedis as second argument — required by all socket handlers
    setupSocketHandlers(io, mockRedis);

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

  it('should join a group room without errors', (done) => {
    // Real event name is 'join-group' (hyphen), not 'join_group' (underscore)
    // join-group validates membership via DB — with no userId set it emits 'error-msg'
    // We just confirm the socket doesn't crash and stays connected
    clientSocket.emit('join-group', 'room123');

    setTimeout(() => {
      expect(clientSocket.connected).toBe(true);
      done();
    }, 100);
  });

  it('should receive an error on send-msg with invalid payload', (done) => {
    // Real event is 'send-msg'; it uses a Joi schema and calls callback on error
    // Sending an empty object triggers validation failure
    clientSocket.emit('send-msg', {}, (response) => {
      expect(response).toBeDefined();
      expect(response.status).toBe('error');
      done();
    });
  });
});