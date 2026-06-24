import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
    const base = siteUrl();
    const now = new Date();

    return [
        { url: base, lastModified: now, changeFrequency: "weekly", priority: 1 },
        { url: `${base}/sign-in`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
        { url: `${base}/sign-up`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    ];
}
