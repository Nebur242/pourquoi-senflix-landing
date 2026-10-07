import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

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
  icons: { icon: "/icon.svg" },
  openGraph: {
    title,
    description,
    url: "https://pourquoi.senflix.app",
    siteName: "Pourquoi Senflix",
    locale: "fr_FR",
    type: "website",
    images: [
      {
        url: "/brochures/06_appel_a_decouvrir.png",
        width: 1254,
        height: 1254,
        alt: "Découvrez Senflix",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/brochures/06_appel_a_decouvrir.png"],
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
    <html lang="fr" className={geist.variable}>
      <body>{children}</body>
    </html>
  );
}
