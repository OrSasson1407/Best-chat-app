const mongoose = require('mongoose');
const User = require('../../server/models/User');
const Message = require('../../server/models/Message');
const GroupModel = require('../../server/models/GroupModel');

describe('Data Integrity: Cascading Deletes', () => {
  let testUser;

  beforeAll(async () => {
    await mongoose.connect(process.env.TEST_MONGO_URI);
    
    // Seed database with a user, a message, and a group
    testUser = await User.create({ username: 'DeleteMe', email: 'del@test.com', password: 'pwd' });
    
    await Message.create({ sender: testUser._id, text: 'This should disappear' });
    await GroupModel.create({ name: 'Test Group', members: [testUser._id] });
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  it('should remove the user\'s messages and references when their account is deleted', async () => {
    // 1. Verify data exists
    let messages = await Message.find({ sender: testUser._id });
    expect(messages.length).toBe(1);

    // 2. Perform the delete operation (triggering model middleware)
    await User.findByIdAndDelete(testUser._id);

    // 3. Assert messages are wiped
    messages = await Message.find({ sender: testUser._id });
    expect(messages.length).toBe(0);

    // 4. Assert user was removed from group memberships
    const group = await GroupModel.findOne({ name: 'Test Group' });
    expect(group.members).not.toContainEqual(testUser._id);
  });
});