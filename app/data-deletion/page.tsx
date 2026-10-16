import type { Metadata } from "next";
import { PolicyDocument } from "@/components/PolicyDocument";
import { company } from "@/lib/company";

export const metadata: Metadata = {
  title: "User Data Deletion Policy",
  description:
    "How to request deletion of your Marina Muse International account and eligible personal information.",
};

export default function DataDeletionPage() {
  return (
    <PolicyDocument
      title="User Data Deletion Policy"
      intro="MARINA MUSE INTERNATIONAL respects users' rights to request deletion of their accounts and eligible personal information."
      sections={[
        {
          title: "How to Request Deletion",
          body: [
            `Email our official business email, ${company.email}, with the subject User Data Deletion Request.`,
            "Include the email address registered with your account and specify what information you want deleted.",
          ],
        },
        {
          title: "Information That May Be Deleted",
          body: [
            "Subject to applicable law and technical availability, we may delete or anonymize:",
          ],
          list: [
            "Account details",
            "Saved preferences",
            "Eligible customer support messages",
            "AI Agent conversation records",
          ],
        },
        {
          title: "Information We May Retain",
          body: [
            "Certain records may need to be retained for tax, accounting, transaction records, fraud prevention, dispute resolution, regulatory compliance, or legal claims.",
          ],
        },
        {
          title: "Identity Verification",
          body: ["We may verify your identity to prevent unauthorized deletion requests."],
        },
        {
          title: "Processing Time",
          body: [
            "We aim to acknowledge requests within 7 business days and complete eligible deletion requests within 30 days.",
            "If additional time is needed, we will inform you where appropriate.",
          ],
        },
        {
          title: "Third-Party Services",
          body: [
            "Where appropriate and technically feasible, we will request deletion of eligible information held by service providers, subject to applicable legal requirements.",
          ],
        },
      ]}
    />
  );
}