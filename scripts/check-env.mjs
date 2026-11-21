const mode = process.env.NODE_ENV || process.env.MODE || '';
if (process.argv.includes('--production') || mode === 'production') {
  if (!process.env.VITE_API_BASE_URL) {
    console.error('\x1b[31m[BUILD ERROR] VITE_API_BASE_URL is required when building for production to prevent silent fallbacks to localhost.\x1b[0m');
    process.exit(1);
  }
}
