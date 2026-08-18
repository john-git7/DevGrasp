/**
 * instrument.js — Sentry Initialization
 *
 * IMPORTANT: This file MUST be imported at the very top of server/index.js
 * BEFORE any other require() calls, so Sentry can instrument all modules.
 *
 * Setup:
 *   1. Create a free account at https://sentry.io
 *   2. Create a new "Node.js" project
 *   3. Copy the DSN and add it to your .env as SENTRY_DSN
 *
 * What it does:
 *   - Captures all unhandled exceptions and rejected promises
 *   - Captures Express route errors via Sentry.setupExpressErrorHandler()
 *   - Tracks performance with 10% sample rate (tracesSampleRate: 0.1)
 *   - Profiles 10% of sampled transactions (profilesSampleRate: 1.0 of traces)
 *   - Automatically captures MongoDB, HTTP, and Node.js built-in spans
 */

'use strict';

const Sentry = require('@sentry/node');
const { nodeProfilingIntegration } = require('@sentry/profiling-node');

// Only initialize Sentry if DSN is provided.
// This prevents errors in local development if SENTRY_DSN is not set.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,

    environment: process.env.NODE_ENV || 'development',

    integrations: [
      // Performance profiling (CPU profiling per transaction)
      nodeProfilingIntegration(),
    ],

    // Capture 10% of all transactions for performance monitoring.
    // Increase to 1.0 for full visibility (uses more quota).
    tracesSampleRate: 0.1,

    // Profile 100% of the sampled transactions.
    profilesSampleRate: 1.0,
  });

  console.log('[Sentry] Initialized. Environment:', process.env.NODE_ENV || 'development');
} else {
  console.warn('[Sentry] SENTRY_DSN not set — error monitoring is disabled.');
}

module.exports = Sentry;
