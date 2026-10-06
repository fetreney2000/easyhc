import type { MetadataRoute } from "next";

/**
 * Internal staff PWA — there is nothing here worth indexing, and the visitor
 * check-in URL is distributed as a QR code rather than by search.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: "/",
    },
  };
}
