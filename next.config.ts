import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // نسخة خفيفة للتشغيل داخل Docker
};

export default nextConfig;
