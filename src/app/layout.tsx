import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Správa nemovitostí",
  description: "Správa vlastních i spravovaných nemovitostí",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="cs" className="h-full antialiased">
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
