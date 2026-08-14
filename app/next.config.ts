import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // The applicant CSV is uploaded as the body of a server action, and a full
      // cohort of essays runs to a few hundred kilobytes — close enough to the
      // 1mb default that an import would start failing partway through a
      // recruitment cycle, as the sheet grows, with nothing to point at.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
