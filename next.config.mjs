/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable image optimization for QR codes/avatars per spec
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Clickjacking
          { key: "X-Frame-Options", value: "DENY" },
          // MIME-type sniffing
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Don't leak the full URL to third parties
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Only this origin may use the camera (QR scanner) and mic
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
          // HTTPS (browsers ignore this header over plain http, e.g. localhost)
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
