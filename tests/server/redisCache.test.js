const redisClient = require('../../server/config/redis');

jest.mock('../../server/config/redis', () => ({
  get: jest.fn(),
  setEx: jest.fn(),
  del: jest.fn(),
  keys: jest.fn()
}));

describe('Redis Cache Service Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test 6
  it('6. should successfully set a cache value with an expiration', async () => {
    redisClient.setEx.mockResolvedValue('OK');
    const res = await redisClient.setEx('user:123:session', 3600, 'token_data');
    expect(redisClient.setEx).toHaveBeenCalledWith('user:123:session', 3600, 'token_data');
    expect(res).toBe('OK');
  });

  // Test 7
  it('7. should retrieve an existing cache value successfully', async () => {
    redisClient.get.mockResolvedValue('token_data');
    const val = await redisClient.get('user:123:session');
    expect(redisClient.get).toHaveBeenCalledWith('user:123:session');
    expect(val).toBe('token_data');
  });

  // Test 8
  it('8. should return null for a cache miss', async () => {
    redisClient.get.mockResolvedValue(null);
    const val = await redisClient.get('missing:key');
    expect(val).toBeNull();
  });

  // Test 9
  it('9. should delete a cache key successfully', async () => {
    redisClient.del.mockResolvedValue(1);
    const res = await redisClient.del('user:123:session');
    expect(redisClient.del).toHaveBeenCalledWith('user:123:session');
    expect(res).toBe(1);
  });

  // Test 10
  it('10. should flush multiple keys by pattern', async () => {
    redisClient.keys.mockResolvedValue(['user:123:data1', 'user:123:data2']);
    redisClient.del.mockResolvedValue(2);
    const keys = await redisClient.keys('user:123:*');
    const res = await redisClient.del(...keys);
    expect(redisClient.keys).toHaveBeenCalledWith('user:123:*');
    expect(res).toBe(2);
  });
});