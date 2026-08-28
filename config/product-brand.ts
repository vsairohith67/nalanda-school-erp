export const PRODUCT_BRAND = {
  schoolName: "NALANDA PUBLIC SCHOOL",
  productName: "Nalanda School Management System",
  technicalDescriptor: "Secure School ERP & Operations Platform",
  nativeShortName: "Nalanda School",
  backupFilenamePrefix: "nalanda-school-backup",
  logoPath: "/nalanda-logo-transparent.png",
  fullSchoolNameFontFamily: "Georgia, 'Times New Roman', serif"
} as const;

export type ProductBrand = typeof PRODUCT_BRAND;
