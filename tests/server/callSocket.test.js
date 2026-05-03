const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const setupSocketHandlers = require('../../server/socket/socketHandler');

// Redis mock — sMembers is key: call handler looks up user sockets via user_sockets:{userId}
const socketRegistry = new Map();
const mockRedis = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  sAdd: jest.fn().mockImplementation(async (key, value) => {
    if (!socketRegistry.has(key)) socketRegistry.set(key, new Set());
    socketRegistry.get(key).add(value);
    return 1;
  }),
  sMembers: jest.fn().mockImplementation(async (key) => {
    return socketRegistry.has(key) ? Array.from(socketRegistry.get(key)) : [];
  }),
  sRem: jest.fn().mockResolvedValue(1),
  del: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
  hSet: jest.fn().mockResolvedValue(1),
  hGet: jest.fn().mockResolvedValue(null),
  hDel: jest.fn().mockResolvedValue(1),
  hExists: jest.fn().mockResolvedValue(0),
  keys: jest.fn().mockResolvedValue([]),
  isReady: true,
};

describe('Socket.io Call Handlers (WebRTC)', () => {
  let io, callerSocket, receiverSocket;

  beforeAll((done) => {
    const httpServer = createServer();
    io = new Server(httpServer);
    // Pass mockRedis — required, otherwise all async handlers crash immediately
    setupSocketHandlers(io, mockRedis);

    httpServer.listen(() => {
      const port = httpServer.address().port;
      callerSocket = new Client(`http://localhost:${port}`);
      receiverSocket = new Client(`http://localhost:${port}`);

      let connections = 0;
      io.on('connection', () => {
        connections++;
        if (connections === 2) done();
      });
    });
  });

  afterAll(() => {
    socketRegistry.clear();
    io.close();
    callerSocket.close();
    receiverSocket.close();
  });

  it('should route an incoming call offer to the correct user', (done) => {
    // Real event names: 'add-user' to register, 'call-user' to call, 'incoming-call' to receive
    // We register the receiver's socket under their userId in the mockRedis registry
    receiverSocket.on('connect', () => {
      // Map 'user_sockets:user_bob_123' -> receiverSocket.id in our mock registry
      socketRegistry.set('user_sockets:user_bob_123', new Set([receiverSocket.id]));
    });

    receiverSocket.on('incoming-call', (data) => {
      expect(data.from).toBe('user_alice_456');
      expect(data.signal).toBeDefined();
      done();
    });

    setTimeout(() => {
      // Real event is 'call-user' with { userToCall, signalData, from, name, type }
      callerSocket.emit('call-user', {
        userToCall: 'user_bob_123',
        from: 'user_alice_456',
        signalData: { type: 'offer', sdp: 'dummy_sdp_data' },
        name: 'Alice',
        type: 'video',
      });
    }, 100);
  }, 8000);
});