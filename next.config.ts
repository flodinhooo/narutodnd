import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": ["./assets/world-atlas/shio/**/*"],
  },
  // Private runtime volumes are provisioned separately, never copied into builds.
  outputFileTracingExcludes: {
    "/*": ["./.private-data/**/*", "./.local-backups/**/*", "./.lore-storage/**/*", "./.portrait-storage/**/*", "./.atlas-storage/**/*", "./prisma/*.db*", "./prisma/*.sqlite*"],
  },
};

export default nextConfig;
