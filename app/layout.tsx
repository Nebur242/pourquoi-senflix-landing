import type { Metadata, Viewport } from "next";
import { Anton, Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const anton = Anton({
  subsets: ["latin", "latin-ext"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

const title = "Pourquoi Senflix ? — Le contenu africain mérite plus.";
const description =
  "Comprendre les défis des créateurs africains et découvrir pourquoi Senflix propose une nouvelle voie pour le contenu vidéo premium.";

export const metadata: Metadata = {
  metadataBase: new URL("https://pourquoi.senflix.app"),
  applicationName: "Pourquoi Senflix",
  title,
  description,
  keywords: [
    "Senflix",
    "contenu africain",
    "créateurs africains",
    "vidéo premium",
    "Mobile Money",
  ],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  icons: { icon: "/brand/senflix-icon.png" },
  openGraph: {
    title,
    description,
    url: "https://pourquoi.senflix.app",
    siteName: "Pourquoi Senflix",
    locale: "fr_FR",
    type: "website",
    images: [
      {
        url: "/brochures/06_appel_a_decouvrir.webp",
        type: "image/webp",
        width: 1254,
        height: 1254,
        alt: "Le talent est ici : votre audience est là, offrez-lui plus.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/brochures/06_appel_a_decouvrir.webp"],
  },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${geist.variable} ${anton.variable}`}>
      <head>
        <link rel="preload" as="image" type="image/webp" href="/brochures/01_le_constat.webp" />
        <link rel="preload" as="image" type="image/webp" href="/brochures/02_le_defi.webp" />
        <link rel="preload" as="image" type="image/webp" href="/brochures/03_contenu_premium.webp" />
      </head>
      <body>{children}</body>
    </html>
  );
}
