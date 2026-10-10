import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Secure International Payment",
  description:
    "Pay through secure checkout. SSL protection, worldwide shipping and international customer support from Marina Muse International.",
};

export default function PaymentLayout({ children }: { children: React.ReactNode }) {
  return children;
}
