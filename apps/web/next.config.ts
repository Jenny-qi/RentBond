import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const backendUrl = process.env.BACKEND_URL;
if (backendUrl) {
  const target = new URL(backendUrl);
  if (
    target.protocol !== "https:" || target.username || target.password ||
    target.pathname !== "/" || target.search || target.hash ||
    (process.env.NEXT_PUBLIC_APP_URL &&
      target.origin === new URL(process.env.NEXT_PUBLIC_APP_URL).origin)
  ) {
    throw new Error("BACKEND_URL must be a separate credential-free HTTPS origin.");
  }
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: false,
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
  async rewrites() {
    return {
      beforeFiles: backendUrl
        ? [{ source: "/api/:path*", destination: `${new URL(backendUrl).origin}/api/:path*` }]
        : [],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
