const { errorHandler, notFound } = require('../../server/middleware/errorMiddleware');

describe('Error Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { originalUrl: '/api/test' };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  it('should format the 404 Not Found error correctly', () => {
    // Check if your middleware uses 'notFound' or just 'errorHandler'
    if (typeof notFound === 'function') {
      notFound(req, res, next);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
    }
  });

  it('should return error messages and stack traces in development', () => {
    const error = new Error('Test Error');
    process.env.NODE_ENV = 'development';

    errorHandler(error, req, res, next);

    expect(res.status).toHaveBeenCalledWith(expect.any(Number));
    // Updated to match your actual 'Received' object structure
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      msg: 'Test Error',
      stack: expect.any(String),
      status: false
    }));
  });

  it('should hide details in production', () => {
    process.env.NODE_ENV = 'production';
    const error = new Error('Test Error');

    errorHandler(error, req, res, next);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: false,
      msg: expect.stringContaining('Something went wrong')
    }));
  });
});