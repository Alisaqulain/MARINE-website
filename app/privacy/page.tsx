import type { Metadata } from "next";
import { PolicyDocument } from "@/components/PolicyDocument";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Marina Muse International collects, uses, and protects personal information, including orders, accounts, and AI Agent messages.",
};

export default function PrivacyPage() {
  return (
    <PolicyDocument
      title="Privacy Policy"
      intro="MARINA MUSE INTERNATIONAL respects your privacy and protects your personal information."
      sections={[
        {
          title: "Information We Collect",
          body: ["We may collect:"],
          list: [
            "Name",
            "Email address",
            "Phone number",
            "Shipping and billing address",
            "Account information",
            "Order history",
            "Messages shared with our AI Agent",
          ],
        },
        {
          title: "How We Use Information",
          body: ["We use information to:"],
          list: [
            "Manage accounts",
            "Process orders and payments",
            "Arrange shipping",
            "Respond to inquiries",
            "Provide AI customer support",
            "Prevent fraud",
            "Meet legal obligations",
          ],
        },
        {
          title: "AI Agent",
          body: [
            "Our AI Agent may process your messages to answer questions about products, pricing, shipping, and customer support.",
            "Do not share passwords, OTPs, or complete payment card details through the chatbot.",
          ],
        },
        {
          title: "Payments",
          body: [
            "Payments may be processed by third-party payment providers. Their privacy policies also apply to information they process.",
          ],
        },
        {
          title: "Sharing Information",
          body: [
            "We may share necessary information with authorized payment processors, shipping partners, hosting providers, and AI service providers.",
            "We do not sell personal information to third parties.",
          ],
        },
        {
          title: "Cookies and Security",
          body: [
            "We may use cookies to maintain login sessions, improve website performance, and support analytics or marketing where applicable.",
            "We take reasonable measures to protect personal information.",
          ],
        },
        {
          title: "Data Retention and Rights",
          body: [
            "We retain information as reasonably necessary for business and legal purposes.",
            "Subject to applicable law, you may request access to, correction of, or deletion of your personal information.",
          ],
        },
        {
          title: "Third-Party Services",
          body: ["External services may process information under their own privacy policies."],
        },
        {
          title: "Updates",
          body: ["Updates to this policy will be published on this page."],
        },
      ]}
    />
  );
}
