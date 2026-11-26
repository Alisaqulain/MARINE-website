import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { Providers } from "@/components/Providers";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || process.env.AUTH_URL || "https://marinamuseinternational.com").replace(
  /\/$/,
  ""
);

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Marina Muse International — Retailer, Exporter, Manufacturer & Supplier",
    template: "%s · Marina Muse International",
  },
  description:
    "Premium nautical instruments, handcrafted brass décor and custom-made products from India. Wholesale and global shipping.",
  // Square crop of the sail "M" from the logo: the full wide logo is unreadable at tab size.
  icons: {
    icon: [
      { url: "/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon-48.png",
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
  },
  openGraph: {
    type: "website",
    siteName: "Marina Muse International",
    title: "Marina Muse International — Retailer, Exporter, Manufacturer & Supplier",
    description:
      "Premium nautical instruments, handcrafted brass décor and custom-made products from India. Wholesale and global shipping.",
    images: [{ url: "/newlogo.png", width: 512, height: 512, alt: "Marina Muse International" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/newlogo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="flex min-h-screen flex-col font-sans antialiased"
        suppressHydrationWarning
      >
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
