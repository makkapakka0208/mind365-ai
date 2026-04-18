import type { NextConfig } from "next";

const isVercel = process.env.VERCEL === "1" || process.env.VERCEL === "true";

const nextConfig: NextConfig = {
  ...(isVercel
    ? {}
    : {
        output: "export",
        trailingSlash: true,
      }),
  images: {
    unoptimized: !isVercel,
  },
};

export default nextConfig;
