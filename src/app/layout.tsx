import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProfitExact",
  description: "Știi cât încasezi. ProfitExact îți arată exact ce rămâne după cheltuieli.",
  applicationName: "ProfitExact",
  // Iconițe mici, generate din logo, ca pagina să se încarce repede pe telefon.
  icons: {
    icon: [
      { url: "/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
  },
  // Pe iPhone, „Adaugă pe ecranul principal” deschide aplicația ca pe una instalată.
  appleWebApp: {
    capable: true,
    title: "ProfitExact",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Conținutul ține cont de „breton” și de bara de jos a telefoanelor noi.
  viewportFit: "cover",
  themeColor: "#075c55",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ro">
      <body>{children}</body>
    </html>
  );
}
