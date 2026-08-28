import type { MetadataRoute } from "next";
import { PRODUCT_BRAND } from "@/config/product-brand";

export const PWA_ICON_PATHS = [
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png"
] as const;

export function buildPwaManifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: PRODUCT_BRAND.productName,
    short_name: PRODUCT_BRAND.nativeShortName,
    description: PRODUCT_BRAND.technicalDescriptor,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    lang: "en-IN",
    dir: "ltr",
    background_color: "#f4f7f8",
    theme_color: "#0f766e",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}
