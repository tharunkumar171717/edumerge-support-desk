import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sequelize loads its dialect drivers dynamically; keep it (and pg) as plain Node requires.
  serverExternalPackages: ["sequelize", "pg", "pg-hstore"],
};

export default nextConfig;
