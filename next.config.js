/** @type {import('next').NextConfig} */
const nextConfig = {
  // We'll keep this empty for now
  reactStrictMode: true,
  // Disable ESLint during build
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig; 