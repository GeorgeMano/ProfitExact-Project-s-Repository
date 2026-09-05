import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProfitExact",
  description: "Știi cât încasezi. ProfitExact îți arată exact ce rămâne după cheltuieli.",
  icons: {
    icon: "/profitexact-logo.png",
    apple: "/profitexact-logo.png",
  },
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
