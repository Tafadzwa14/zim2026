import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Zim 2026",
    short_name: "Zim 2026",
    description: "A private family command centre for the Zimbabwe trip.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbf4ea",
    theme_color: "#d9822b",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
