import * as Sentry from '@sentry/node';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'production',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
    sendDefaultPii: false,
    debug: false,
    beforeSend(event) {
      // Strip cookies
      if (event.request?.cookies) {
        delete event.request.cookies;
      }

      // Scrub sensitive patterns from exception messages and stack traces
      const scrub = (str: string) =>
        str
          .replace(/postgres(ql)?:\/\/[^\s"']+/gi, '[DATABASE_URL]')
          .replace(/\b[A-Za-z0-9_-]{50,}\.[A-Za-z0-9_-]{6}\b/g, '[DISCORD_TOKEN]')
          .replace(/\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+/g, '[JWT]');

      if (event.exception?.values) {
        for (const ex of event.exception.values) {
          if (ex.value) ex.value = scrub(ex.value);
          if (ex.stacktrace?.frames) {
            for (const frame of ex.stacktrace.frames) {
              if (frame.context_line) frame.context_line = scrub(frame.context_line);
            }
          }
        }
      }

      return event;
    },
  });
} else if (process.env.NODE_ENV === 'production') {
  // eslint-disable-next-line no-console
  console.warn('[Sentry] SENTRY_DSN is not set — error monitoring is disabled');
}

export { Sentry };
