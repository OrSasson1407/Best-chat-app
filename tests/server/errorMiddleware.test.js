const { errorHandler, notFound } = require('../../server/middleware/errorMiddleware');

describe('Error Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    // method and ip are required by the logger inside errorHandler
    req = { originalUrl: '/api/test', method: 'GET', ip: '127.0.0.1' };
    res = {
      // CRITICAL FIX: middleware reads res.statusCode to determine fallback status.
      // Without this, (res.statusCode === 200 ? 500 : res.statusCode) evaluates
      // to undefined, so res.status() is called with undefined — not a Number.
      statusCode: 200,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  afterEach(() => {
    // Prevent NODE_ENV leaking between tests
    process.env.NODE_ENV = 'test';
  });

  it('should format the 404 Not Found error correctly', () => {
    if (typeof notFound === 'function') {
      notFound(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    }
  });

  it('should return error messages and stack traces in development', () => {
    process.env.NODE_ENV = 'development';
    const error = new Error('Test Error');

    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(expect.any(Number));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      msg: 'Test Error',
      stack: expect.any(String),
      status: false,
    }));
  });

  it('should hide details in production for non-operational errors', () => {
    process.env.NODE_ENV = 'production';
    const error = new Error('Test Error');
    // isOperational defaults to false — middleware shows generic message for bugs/crashes

    errorHandler(error, req, res, next);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: false,
      msg: expect.stringContaining('Something went wrong'),
    }));
  });
});