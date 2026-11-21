const mode = process.env.NODE_ENV || process.env.MODE || '';
const isProd = process.argv.includes('--production') || mode === 'production' || Boolean(process.env.VERCEL);
const baseUrl = process.env.VITE_API_BASE_URL;

if (!baseUrl) {
  if (isProd) {
    console.error('\x1b[31m[BUILD ERROR] VITE_API_BASE_URL is required when building for production to prevent silent fallbacks to localhost.\x1b[0m');
    process.exit(1);
  } else {
    console.warn('\x1b[33m[BUILD WARN] VITE_API_BASE_URL is not set. Local build will default to localhost backend origin.\x1b[0m');
  }
} else {
  console.log(`\x1b[32m[BUILD INFO] Target API Base URL: ${baseUrl}\x1b[0m`);
}
