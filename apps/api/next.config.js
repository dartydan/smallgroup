/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return {
      // Run before app route so / serves Expo web app, not the API page
      beforeFiles: [
        { source: '/', destination: '/index.html' },
      ],
    };
  },
};

module.exports = nextConfig;
