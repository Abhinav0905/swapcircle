import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SwapCircle — Good books, full circle",
  description: "Find your next read in a circle of people who all say yes. Taste-assisted discovery and member-approved book exchanges.",
  metadataBase: new URL("https://swapcircle-books.abhinav-0905.chatgpt.site"),
  referrer: "no-referrer",
  openGraph: {
    title: "SwapCircle — Good books, full circle",
    description: "One book in. One book out. Every reader has a say.",
    type: "website",
    images: [{ url: "/og-card.png", width: 1200, height: 800, alt: "SwapCircle: taste, choice and approval bring books full circle." }],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
