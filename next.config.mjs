/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable image optimization for QR codes/avatars per spec
  images: {
    unoptimized: true,
  },
  // Experimental features for server actions if needed
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
};

export default nextConfig;