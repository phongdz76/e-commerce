import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: ["firebasestorage.googleapis.com", "m.media-amazon.com", "lh3.googleusercontent.com"],
  },
};

export default nextConfig;
