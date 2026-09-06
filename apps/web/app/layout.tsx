import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bonanzbar",
  description: "Barinventar, Zählungen und Konsum der Mitglieder",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de"><body>{children}</body></html>;
}
