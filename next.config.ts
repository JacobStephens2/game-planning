import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-host deploy: emit a minimal standalone server (.next/standalone)
  // to run behind Apache reverse-proxy via systemd.
  output: "standalone",
};

export default nextConfig;
