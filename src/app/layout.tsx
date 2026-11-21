import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Triavi Localization", description: "Translate and review Triavi patient screen text." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
