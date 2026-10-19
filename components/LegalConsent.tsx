import Link from "next/link";

const docs = [
  { name: "agreePrivacy", label: "Privacy Policy", href: "/privacy" },
  { name: "agreeTerms", label: "Terms of Service", href: "/terms" },
  { name: "agreeDeletion", label: "Data Deletion", href: "/data-deletion" },
];

/** Three separate required consent checkboxes shown on every sign-up form. */
export function LegalConsent({ className = "" }: { className?: string }) {
  return (
    <div className={`space-y-2 text-[13px] text-navy-700 ${className}`}>
      {docs.map((d) => (
        <label key={d.name} className="flex cursor-pointer items-start gap-2">
          <input type="checkbox" name={d.name} required className="mt-0.5 h-4 w-4 shrink-0 accent-[#C9A84C]" />
          <span>
            I have read and agree to the{" "}
            <Link
              href={d.href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#8C6E28] underline underline-offset-2"
            >
              {d.label}
            </Link>
          </span>
        </label>
      ))}
    </div>
  );
}
