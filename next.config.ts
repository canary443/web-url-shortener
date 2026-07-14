import type { NextConfig } from "next";

// in dev the fastapi backend runs on port 8000, on vercel it is a serverless function
const apiBase =
  process.env.NODE_ENV === "development" ? "http://127.0.0.1:8000" : "";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        // backend api routes
        source: "/api/py/:path*",
        destination:
          process.env.NODE_ENV === "development"
            ? `${apiBase}/api/py/:path*`
            : "/api/",
      },
      {
        // short link redirects, checked after real pages and public files
        source: "/:code([a-zA-Z0-9]{4,10})",
        destination:
          process.env.NODE_ENV === "development"
            ? `${apiBase}/:code`
            : "/api/",
      },
    ];
  },
};

export default nextConfig;
