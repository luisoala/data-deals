/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  basePath: process.env.BASE_PATH || '/neurips2025-data-deals',
  images: {
    // Disable image optimization to avoid basePath issues
    // Images will be served directly from public folder
    unoptimized: true,
  },
}

module.exports = nextConfig

