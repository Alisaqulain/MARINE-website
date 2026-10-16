import type { Metadata } from "next";
import Link from "next/link";
import { PolicyDocument } from "@/components/PolicyDocument";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of Service for Marina Muse International — products, pricing, payments, shipping, wholesale orders, and use of the website.",
};

export default function TermsPage() {
  return (
    <PolicyDocument
      title="Terms of Service"
      intro="By accessing or registering on our website, you agree to these Terms of Service."
      sections={[
        {
          title: "Products",
          body: [
            "We offer handcrafted brass telescopes, binoculars, kitchenware, drinkware, cutlery, compasses, nautical décor, lighting, jewellery, and other brass products.",
            "Handmade products may have minor variations.",
          ],
        },
        {
          title: "Product Performance",
          body: [
            "Optical performance and viewing distance depend on lens specifications, product configuration, and viewing conditions.",
            "Estimated viewing distances are not guaranteed.",
          ],
        },
        {
          title: "Pricing and Orders",
          body: [
            "Prices are generally displayed in USD for international customers.",
            "Orders are subject to availability and confirmation.",
            "Shipping charges and applicable taxes will be communicated before order completion.",
          ],
        },
        {
          title: "Payments",
          body: [
            "Customers must use available payment methods.",
            "Any advance payment or deposit requirements will be communicated before the order is finalized.",
            "Cash on Delivery is available only where expressly offered.",
          ],
        },
        {
          title: "Shipping",
          body: [
            "Delivery times are estimates.",
            "International customers may be responsible for applicable import duties, customs charges, and taxes unless otherwise agreed or required by law.",
          ],
        },
        {
          title: "Returns and Refunds",
          body: [
            <>
              Returns, refunds, and cancellations are governed by our published{" "}
              <Link href="/returns" className="text-[#8C6E28] underline">
                Return and Refund Policy
              </Link>{" "}
              and applicable consumer laws.
            </>,
            "Mandatory consumer rights remain unaffected.",
          ],
        },
        {
          title: "Wholesale Orders",
          body: [
            "B2B and wholesale orders may have separate quantities, prices, production timelines, and payment terms confirmed in writing.",
          ],
        },
        {
          title: "AI Agent",
          body: [
            "Our AI Agent provides automated assistance.",
            "Quotes, customized orders, and wholesale agreements require confirmation by an authorized representative unless the AI Agent has expressly been authorized to finalize them.",
          ],
        },
        {
          title: "Acceptable Use",
          body: [
            "Users must not use the website for fraud, unlawful activity, unauthorized access, or disruption of website security.",
          ],
        },
        {
          title: "Liability",
          body: ["Nothing in these Terms excludes liability or consumer rights that cannot legally be excluded."],
        },
        {
          title: "Applicable Law",
          body: [
            "These Terms are subject to applicable Indian law while respecting mandatory consumer protections applicable in other countries.",
          ],
        },
      ]}
    />
  );
}
