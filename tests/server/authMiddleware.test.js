const jwt = require('jsonwebtoken');

// Mock Redis BEFORE requiring the middleware — it's imported at module load time
jest.mock('../../server/config/redis', () => ({
  createRedisClient: () => ({
    on: jest.fn(),
    connect: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    isReady: false, // disables the blacklist check
  }),
}));

// Module exports protect directly — NOT as a named export { protect }
const protect = require('../../server/middleware/authMiddleware');

const TEST_SECRET = 'testsecret';

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
      // Express's req.header() reads from req.headers case-insensitively.
      // The plain object mock doesn't have this method — add it manually.
      header: function (name) {
        return this.headers[name.toLowerCase()] || this.headers[name];
      },
    };
    res = {
      statusCode: 200,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  it('should return 401 if no token is provided', async () => {
    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ msg: expect.any(String) }));
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next() if a valid token is provided', async () => {
    process.env.JWT_SECRET = TEST_SECRET;
    const validToken = jwt.sign({ id: 'user123' }, TEST_SECRET);
    // req.header() reads from req.headers — store it lowercased to match Express behavior
    req.headers['authorization'] = `Bearer ${validToken}`;

    await protect(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe('user123');
  });

  it('should return 401 for an invalid token', async () => {
    req.headers['authorization'] = 'Bearer this.is.invalid';

    await protect(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});