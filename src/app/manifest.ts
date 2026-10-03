import type { MetadataRoute } from "next";

/** Face aplicația instalabilă pe telefon („Adaugă pe ecranul principal”). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ProfitExact",
    short_name: "ProfitExact",
    description: "Știi cât încasezi. ProfitExact îți arată exact ce rămâne după cheltuieli.",
    lang: "ro",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f7f5",
    theme_color: "#075c55",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
