const { Worker } = require('bullmq');
const redisClient = require('../config/redis');
const logger = require('../utils/logger');
const meilisearch = require('../utils/meilisearch'); // Assuming your meilisearch instance is exported here

const searchWorker = new Worker('meilisearch-sync', async (job) => {
  const { id, content, groupId, senderId } = job.data;
  try {
    // Sync to Meilisearch in the background, keeping the main event loop free
    await meilisearch.index('messages').addDocuments([{ id, content, groupId, senderId }]);
    logger.info(`Message ${id} background synced to Meilisearch`);
  } catch (error) {
    logger.error(`Meilisearch sync failed: ${error.message}`);
    throw error;
  }
}, { connection: redisClient });

searchWorker.on('failed', (job, err) => {
  logger.error(`Job ${job.id} failed with error ${err.message}`);
});

module.exports = searchWorker;
