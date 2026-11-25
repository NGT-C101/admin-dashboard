import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: process.env.STANDALONE === "0" ? undefined : "standalone", // نسخة خفيفة للتشغيل داخل Docker
};

export default nextConfig;
