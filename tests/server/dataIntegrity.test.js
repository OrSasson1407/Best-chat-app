const { mongoose, dbReady } = require('../../server/index');
const User = mongoose.model('User');
const Message = mongoose.model('Message');
const GroupModel = mongoose.model('Group');

describe('Data Integrity: Cascading Deletes', () => {
  let testUser;
  let testUser2;

  beforeAll(async () => {
    await dbReady;
    await User.deleteOne({ email: 'del@test.com' });
    await User.deleteOne({ email: 'del2@test.com' });

    testUser = await User.create({
      username: 'DeleteMe',
      email: 'del@test.com',
      password: 'hashedpwd123',
    });

    testUser2 = await User.create({
      username: 'DeleteMe2',
      email: 'del2@test.com',
      password: 'hashedpwd123',
    });

    // Message schema: { from, to, message: { text }, users, sender, type }
    await Message.create({
      from: testUser._id,
      to: testUser2._id,
      message: { text: 'This should disappear' },
      users: [testUser._id, testUser2._id],
      sender: testUser._id,
    });

    await GroupModel.create({
      name: 'Test Group',
      members: [testUser._id],
    });
  }, 65000);

  afterAll(async () => {
    await GroupModel.deleteMany({ name: 'Test Group' });
    await Message.deleteMany({ sender: testUser?._id });
    await User.deleteOne({ email: 'del2@test.com' });
  });

  it('should remove messages and group references when a user is deleted', async () => {
    let messages = await Message.find({ sender: testUser._id });
    expect(messages.length).toBeGreaterThan(0);

    await User.findByIdAndDelete(testUser._id);

    messages = await Message.find({ sender: testUser._id });
    expect(messages.length).toBe(0);

    const group = await GroupModel.findOne({ name: 'Test Group' });
    const memberIds = group.members.map((id) => id.toString());
    expect(memberIds).not.toContain(testUser._id.toString());
  });
});