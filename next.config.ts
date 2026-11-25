import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.STANDALONE === "0" ? undefined : "standalone", // نسخة خفيفة للتشغيل داخل Docker
  experimental: {
    serverActions: { bodySizeLimit: "11mb" }, // رفع مستندات لحد 10 ميجا
  },
};

export default nextConfig;
