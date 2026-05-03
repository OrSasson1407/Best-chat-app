const { createServer } = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const setupSocketHandlers = require('../../server/socket/socketHandler'); //

describe('Socket.io Call Handlers (WebRTC)', () => {
  let io, callerSocket, receiverSocket;

  beforeAll((done) => {
    const httpServer = createServer();
    io = new Server(httpServer);
    setupSocketHandlers(io); 
    
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
    io.close();
    callerSocket.close();
    receiverSocket.close();
  });

  it('should route an incoming call offer to the correct user', (done) => {
    const callOffer = {
      targetUserId: 'user_bob_123',
      callerId: 'user_alice_456',
      signalData: { type: 'offer', sdp: 'dummy_sdp_data' }
    };

    // Simulate Bob registering his socket ID mapped to his User ID
    receiverSocket.emit('register_user', 'user_bob_123');

    receiverSocket.on('incoming_call', (data) => {
      expect(data.callerId).toBe('user_alice_456');
      expect(data.signalData.type).toBe('offer');
      done();
    });

    setTimeout(() => {
      callerSocket.emit('initiate_call', callOffer);
    }, 50);
  });
});