import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  transpilePackages: ['@blog-study/shared'],

  // Production optimizations
  poweredByHeader: false,

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'cdn.discordapp.com',
      },
    ],
  },

  // Experimental features
  experimental: {
    // Enable server actions
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
              "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
              "img-src 'self' https: data: blob:",
              "font-src 'self' https://cdn.jsdelivr.net",
              "connect-src 'self' https://*.supabase.co https://o4511035097481216.ingest.us.sentry.io https://*.firebaseio.com https://*.firebase.com https://*.gstatic.com https://cdn.jsdelivr.net https://firebaseinstallations.googleapis.com https://firebaseremoteconfig.googleapis.com https://fcmregistrations.googleapis.com https://*.googleapis.com",
              "frame-ancestors 'none'",
              "worker-src 'self' https://cdn.jsdelivr.net",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  org: 'kusitms-pf',
  project: 'javascript-nextjs',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,

  // Route Sentry requests through your server (avoids ad-blockers)
  tunnelRoute: '/api/_sentry-tunnel',

  // Upload source maps for readable stack traces
  widenClientFileUpload: true,

  // Disable Sentry telemetry
  telemetry: false,
});
