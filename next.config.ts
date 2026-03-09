import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async redirects() {
    return [
      {
        source: "/connections",
        destination: "/activity",
        permanent: true,
      },
      {
        source: "/meetups",
        destination: "/activity",
        permanent: true,
      },
      {
        source: "/settings",
        destination: "/profile",
        permanent: true,
      },
      {
        source: "/network",
        destination: "/profile",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
