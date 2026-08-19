/**
 * Jest Global Setup
 * Runs ONCE before all test suites. Pre-warms the mongodb-memory-server
 * binary so individual test suites don't race to download it.
 */
const { MongoBinary } = require('mongodb-memory-server-core');

module.exports = async function globalSetup() {
  console.log('\n[Global Setup] Pre-warming MongoDB binary cache...');
  try {
    await MongoBinary.getPath();
    console.log('[Global Setup] MongoDB binary ready.\n');
  } catch (err) {
    console.error('[Global Setup] Failed to pre-warm MongoDB binary:', err.message);
  }
};
