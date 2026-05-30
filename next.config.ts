import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Logos/escudos servidos por el backend (storage:link)
    remotePatterns: [
      {
        protocol: "https",
        hostname: "admin.vedo.com.ar",
        pathname: "/storage/**",
      },
    ],
  },
};

export default nextConfig;
