const jwt = require('jsonwebtoken');
const { protect } = require('../../server/middleware/authMiddleware'); //

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { headers: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  it('should return 401 if no token is provided', () => {
    protect(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Not authorized, no token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next() if a valid token is provided', () => {
    const validToken = jwt.sign({ id: 'user123' }, process.env.JWT_SECRET || 'testsecret');
    req.headers.authorization = `Bearer ${validToken}`;
    
    // Mocking the user fetch if your middleware attaches the user to req
    req.user = { _id: 'user123' }; 

    protect(req, res, next);
    
    // In a real scenario, you might need to mock User.findById here if your middleware hits the DB
    expect(next).toHaveBeenCalled();
  });
});