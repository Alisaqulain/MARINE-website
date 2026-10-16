import Link from "next/link";
import type { ReactNode } from "react";
import { company } from "@/lib/company";

export type PolicySection = {
  title: string;
  body?: ReactNode[];
  list?: string[];
};

const SITE = "https://marinamuseinternational.com";

export function PolicyDocument({
  title,
  intro,
  sections,
}: {
  title: string;
  intro: string;
  sections: PolicySection[];
}) {
  return (
    <div className="bg-[#FAF7F2]">
      <article className="px-5 py-10 md:py-14">
        <div className="mx-auto max-w-[860px]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#C9A84C]">Policy</p>
          <h1 className="mt-2 font-serif text-[1.65rem] text-navy-900 md:text-4xl">{title}</h1>
          <p className="mt-2 text-sm font-semibold uppercase tracking-[0.16em] text-[#8C6E28]">{company.name}</p>
          <p className="mt-5 leading-relaxed text-navy-600">{intro}</p>

          {sections.map((section) => (
            <section key={section.title} className="mt-9">
              <h2 className="font-serif text-xl text-navy-900 md:text-2xl">{section.title}</h2>
              {section.body?.map((paragraph, index) => (
                <p key={`${section.title}-${index}`} className="mt-3 leading-relaxed text-navy-600">
                  {paragraph}
                </p>
              ))}
              {section.list ? (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-navy-700">
                  {section.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}

          <section className="mt-9">
            <h2 className="font-serif text-xl text-navy-900 md:text-2xl">Contact Us</h2>
            <p className="mt-3 font-semibold uppercase tracking-[0.08em] text-navy-900">{company.name}</p>
            <p className="mt-1 text-navy-600">Roorkee, Uttarakhand, India</p>
            <p className="mt-1 text-navy-600">
              Email:{" "}
              <a href={`mailto:${company.email}`} className="text-[#8C6E28] underline">
                {company.email}
              </a>
            </p>
            <p className="mt-1 text-navy-600">
              Website:{" "}
              <a href={SITE} className="text-[#8C6E28] underline">
                {SITE}
              </a>
            </p>
          </section>

          <nav className="mt-12 flex flex-wrap gap-x-4 gap-y-2 border-t border-[#e6dfd2] pt-6 text-sm">
            <Link href="/privacy" className="text-[#8C6E28] underline">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-[#8C6E28] underline">
              Terms of Service
            </Link>
            <Link href="/data-deletion" className="text-[#8C6E28] underline">
              User Data Deletion
            </Link>
            <Link href="/returns" className="text-[#8C6E28] underline">
              Return and Refund Policy
            </Link>
          </nav>
        </div>
      </article>
    </div>
  );
}
