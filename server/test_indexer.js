require('dotenv').config();
const mongoose = require('mongoose');
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);
const { indexRepository } = require('./services/indexer');

async function run() {
  await mongoose.connect(process.env.MONGO_URI, { family: 4 });
  console.log('Connected to MongoDB');
  try {
    await indexRepository('https://github.com/john-git7/Studio');
    console.log('Done!');
  } catch (err) {
    console.error('Crash:', err);
  }
  process.exit(0);
}
run();
