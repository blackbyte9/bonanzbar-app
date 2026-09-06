import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@bonanzbar/shared"],
  output: "standalone",
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
};

export default nextConfig;
