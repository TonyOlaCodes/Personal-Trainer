import type { MetadataRoute } from "next";
import { siteConfig, siteUrl } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: siteConfig.name,
        short_name: "FitCoach",
        description: siteConfig.shortDescription,
        start_url: "/",
        display: "standalone",
        background_color: "#111118",
        theme_color: "#6366f1",
        orientation: "portrait-primary",
        categories: ["fitness", "health", "sports"],
        lang: "en-GB",
    };
}
