import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV ?? 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
    debug: false,
    beforeSend(event) {
      if (event.request?.cookies) {
        delete event.request.cookies;
      }
      if (event.request?.query_string) {
        event.request.query_string = '[Filtered]';
      }
      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === 'fetch' && breadcrumb.data?.url) {
        const url = breadcrumb.data.url as string;
        if (url.includes('supabase') || url.includes('token')) {
          breadcrumb.data.url = '[Filtered]';
        }
      }
      return breadcrumb;
    },
  });
}
