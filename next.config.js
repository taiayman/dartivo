/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true, // Default setting, you can adjust as needed
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/v0/b/**', // Covers typical Firebase Storage URLs
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        port: '',
        pathname: '/u/**', // Covers typical GitHub user avatar URLs
      },
      {
        protocol: 'https',            // Protocol (usually https)
        hostname: 'lh3.googleusercontent.com', // Hostname for Google User Content
        port: '',                     // Port (usually empty for default)
        pathname: '/a/**',            // Path pattern for Google profile pics (often starts with /a/)
      },
      // Add other allowed domains here if needed in the future
    ],
  },
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig; 