export const PUBLIC_WEBSITE_ASSETS = {
  NALANDA_LOGO: {
    key: "NALANDA_LOGO",
    src: "/nalanda-logo.jpg",
    width: 1080,
    height: 1080,
    mimeType: "image/jpeg",
    altPolicy: "Nalanda Public School"
  },
  PWA_ICON_512: {
    key: "PWA_ICON_512",
    src: "/icons/icon-512.png",
    width: 512,
    height: 512,
    mimeType: "image/png",
    altPolicy: "Nalanda Public School app icon"
  },
  DECORATIVE_PWA_MARK: {
    key: "DECORATIVE_PWA_MARK",
    src: "/icons/icon-maskable-512.png",
    width: 512,
    height: 512,
    mimeType: "image/png",
    altPolicy: ""
  }
} as const;

export type PublicWebsiteAssetKey = keyof typeof PUBLIC_WEBSITE_ASSETS;

export function getPublicWebsiteAsset(key: string) {
  const asset = PUBLIC_WEBSITE_ASSETS[key as PublicWebsiteAssetKey];
  if (!asset) throw new Error("Select a registered local public asset.");
  return asset;
}

export function validateRegisteredImage(input: Record<string, unknown>) {
  const key = String(input.assetKey ?? "");
  const asset = getPublicWebsiteAsset(key);
  const decorative = input.decorative === true;
  const alt = String(input.alt ?? "").trim();
  if (!decorative && !alt) throw new Error("Published images require approved alt text.");
  if (decorative && alt) throw new Error("Decorative images must use an intentionally empty alt.");
  if (alt.length > 240) throw new Error("Image alt text must be 240 characters or fewer.");
  return { assetKey: asset.key, alt: decorative ? "" : alt, decorative };
}
