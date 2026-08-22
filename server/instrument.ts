import 'dotenv/config';
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

// Only initialize Sentry if DSN is provided.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,

    environment: process.env.NODE_ENV || 'development',

    integrations: [
      // Performance profiling (CPU profiling per transaction)
      nodeProfilingIntegration(),
    ],

    // Capture 10% of all transactions for performance monitoring.
    tracesSampleRate: 0.1,

    // Profile 100% of the sampled transactions.
    profilesSampleRate: 1.0,
  });

  console.log('[Sentry] Initialized. Environment:', process.env.NODE_ENV || 'development');
} else if (process.env.NODE_ENV !== 'test') {
  console.warn('[Sentry] SENTRY_DSN not set — error monitoring is disabled.');
}

export default Sentry;
