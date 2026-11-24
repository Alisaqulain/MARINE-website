import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Contact Marina Muse International — corporate office and factory in Roorkee, Uttarakhand, India.",
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
