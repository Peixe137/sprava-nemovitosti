import type { NextConfig } from "next";

// Interní aplikace s přihlášením: všechny stránky se vykreslují při každém požadavku,
// takže pokročilé cachování (cacheComponents) necháváme vypnuté.
const nextConfig: NextConfig = {
  async redirects() {
    return [{ source: "/dluznici", destination: "/finance/dluznici", permanent: true }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
