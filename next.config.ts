import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Reduces server bundle bloat; AWS SDK runs from node_modules. */
  serverExternalPackages: [
    "@aws-sdk/client-s3",
    "@aws-sdk/s3-request-presigner",
    "@aws-sdk/*",
  ],

  /** Helps Next/Webpack consume @xyflow’s conditional exports reliably (avoids bad interop chunks). */
  transpilePackages: ["@xyflow/react", "@xyflow/system", "exceljs"],

  /**
   * `xlsx` (SheetJS) touches Node built-ins. Stub them for the browser bundle to avoid
   * broken chunk graphs that can surface as `__webpack_modules__[moduleId] is not a function`.
   */
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        stream: false,
      };
    }
    return config;
  },

  async redirects() {
    return [
      { source: "/defect-analysis/:path+", destination: "/historical/:path+", permanent: false },
      { source: "/active", destination: "/live", permanent: false },
      { source: "/active/:path*", destination: "/live/:path*", permanent: false },
      { source: "/live/:projectId/metadata", destination: "/live/:projectId/setup", permanent: false },
      { source: "/live/:projectId/map-columns", destination: "/live/:projectId/upload", permanent: false },
      {
        source: "/historical/:projectId/metadata",
        destination: "/historical/:projectId/setup",
        permanent: false,
      },
      {
        source: "/historical/:projectId/map-columns",
        destination: "/historical/:projectId/upload",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
