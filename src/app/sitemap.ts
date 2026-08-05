import type { MetadataRoute } from "next";

import { diagnosticConfig } from "@/config/diagnostic";
import { siteConfig } from "@/config/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [
    {
      url: siteConfig.siteUrl,
      changeFrequency: "monthly",
      priority: 1,
    },
  ];

  if (diagnosticConfig.enabled) {
    entries.push({
      url: `${new URL(siteConfig.siteUrl).origin}${diagnosticConfig.href}/`,
      changeFrequency: "monthly",
      priority: 0.8,
    });
  }

  return entries;
}
