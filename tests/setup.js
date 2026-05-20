const path = require('path');
jest.mock(path.resolve(__dirname, '../server/config/redis'), () => ({
  get: jest.fn(),
  setEx: jest.fn(),
  del: jest.fn()
}));
jest.mock('mongoose', () => ({
  model: jest.fn(),
  Schema: jest.fn(),
  connect: jest.fn()
}));
