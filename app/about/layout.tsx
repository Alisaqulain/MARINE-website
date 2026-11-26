import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Marina Muse International — retailer, exporter, manufacturer and supplier of handcrafted nautical, brass and armour products from Roorkee, Uttarakhand, India. Founded by Mr. Mohammad Muaaz.",
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
