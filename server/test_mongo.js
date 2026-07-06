const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']);

const mongoose = require('mongoose');
require('dotenv').config();

console.log('Testing with Google DNS...');

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Success! Connected to MongoDB.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Failed:', err.message);
    process.exit(1);
  });
