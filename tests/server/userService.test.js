const { getUserProfile, updateUserStatus, updateTheme } = require('../../server/services/userService');
const User = require('../../server/models/User');

jest.mock('../../server/models/User');

describe('User Service Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Test 1
  it('1. should retrieve a user profile successfully by ID', async () => {
    const mockUser = { _id: '123', username: 'testuser', email: 'test@test.com' };
    User.findById.mockResolvedValue(mockUser);
    const result = await getUserProfile('123');
    expect(User.findById).toHaveBeenCalledWith('123');
    expect(result.username).toBe('testuser');
  });

  // Test 2
  it('2. should throw an error if user profile is not found', async () => {
    User.findById.mockResolvedValue(null);
    await expect(getUserProfile('invalid-id')).rejects.toThrow('User not found');
  });

  // Test 3
  it('3. should update user status to away successfully', async () => {
    User.findByIdAndUpdate.mockResolvedValue({ _id: '123', status: 'away' });
    const result = await updateUserStatus('123', 'away');
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith('123', { status: 'away' }, { new: true });
    expect(result.status).toBe('away');
  });

  // Test 4
  it('4. should fail to update status if invalid status provided', async () => {
    await expect(updateUserStatus('123', 'invalid-status')).rejects.toThrow('Invalid status');
  });

  // Test 5
  it('5. should update user theme preference to dark mode', async () => {
    User.findByIdAndUpdate.mockResolvedValue({ _id: '123', theme: 'dark' });
    const result = await updateTheme('123', 'dark');
    expect(User.findByIdAndUpdate).toHaveBeenCalledWith('123', { theme: 'dark' }, { new: true });
    expect(result.theme).toBe('dark');
  });
});