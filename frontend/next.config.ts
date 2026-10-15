import type { NextConfig } from 'next';

const API_URL = process.env.API_URL ?? 'http://localhost:8000';

// Build: export estático servido por FastAPI (mismo origen). Dev: proxy de /api al backend.
const config: NextConfig =
  process.env.NODE_ENV === 'production'
    ? { output: 'export', trailingSlash: true }
    : {
        trailingSlash: true,
        skipTrailingSlashRedirect: true,
        rewrites: async () => [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }],
      };

export default config;
