import Link from "next/link";
import { ExternalLink, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { BannerHero } from "@/components/BannerHero";
import { ContactForm } from "@/components/ContactForm";
import { WholesaleNavLink } from "@/components/WholesaleNavLink";
import { company, companyDirections, companyMapSrc, companyTel, companyWhatsApp } from "@/lib/company";
import { getContactEmails } from "@/lib/contact-emails";

const desks = [
  { title: "Retail", body: "Orders, tracking and product advice." },
  { title: "Wholesale / B2B", body: "Catalogues, MOQs and trade terms." },
  { title: "OEM & custom", body: "Drawings, logos and sampling." },
];

export default function ContactPage() {
  const contactEmails = getContactEmails();

  return (
    <div className="bg-[#FAF7F2]">
      <BannerHero
        src="/contact-banner.jpeg"
        mobileSrc="/mobile/contact.png"
        alt="Contact us — Atelier & trade desk. Brass globe, binoculars and compass on a desk"
        title="Contact us — Atelier & trade desk"
      />

      <section id="contact-form" className="scroll-mt-[var(--site-nav)] px-5 py-10 md:py-14">
        <div className="mx-auto grid max-w-[1320px] gap-10 lg:grid-cols-[1fr_1.05fr]">
          <div>
            <h2 className="font-serif text-[1.65rem] md:text-4xl">Reach {company.name}</h2>
            <p className="mt-4 max-w-md text-navy-600">
              We reply within one business day. For urgent wholesale samples, WhatsApp the trade desk.
            </p>
            <ul className="mt-10 space-y-5 text-navy-800">
              <li className="flex gap-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#C9A84C]" />
                <span>
                  <strong>{company.name}</strong>
                  <br />
                  <span className="text-xs uppercase tracking-[0.16em] text-[#8C6E28]">
                    {company.role}
                  </span>
                  <br />
                  Corporate Office &amp; Factory
                  <br />
                  {company.address[0]}
                  <br />
                  {company.address[1]}
                  <br />
                  {company.address[2]}
                </span>
              </li>
              <li className="flex gap-3">
                <Mail className="mt-0.5 h-5 w-5 shrink-0 text-[#C9A84C]" />
                <span className="space-y-1">
                  {contactEmails.map((email) => (
                    <a key={email} href={`mailto:${email}`} className="block hover:text-[#8C6E28]">
                      {email}
                    </a>
                  ))}
                </span>
              </li>
              <li className="flex gap-3">
                <Phone className="mt-0.5 h-5 w-5 shrink-0 text-[#C9A84C]" />
                <a href={companyTel} className="hover:text-[#8C6E28]">
                  {company.phone}
                </a>
              </li>
            </ul>
            <a
              href={companyWhatsApp}
              target="_blank"
              rel="noreferrer"
              className="btn-gold mt-8 flex w-full justify-center gap-2 sm:inline-flex sm:w-auto"
            >
              <MessageCircle className="h-4 w-4" />
              Chat on WhatsApp
            </a>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {desks.map((d) => (
                <div key={d.title} className="rounded-2xl border border-[#eee7db] bg-white p-4">
                  <p className="font-serif text-xl">{d.title}</p>
                  <p className="mt-1 text-sm text-navy-600">{d.body}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 text-sm text-navy-600">
              Looking for volume?{" "}
              <WholesaleNavLink callbackUrl="/wholesale" className="text-[#8C6E28] underline">
                Open a wholesale account
              </WholesaleNavLink>{" "}
              or{" "}
              <WholesaleNavLink callbackUrl="/wholesale/quote" className="text-[#8C6E28] underline">
                request a bulk quote
              </WholesaleNavLink>
              .
            </p>
          </div>
          <ContactForm />
        </div>
      </section>

      <section className="border-t border-[#eee7db] px-5 pb-10 pt-8 md:pb-14">
        <div className="mx-auto max-w-[1320px]">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#8C6E28]">Visit us</p>
              <h2 className="mt-2 font-serif text-[1.65rem] md:text-4xl">Find the atelier</h2>
              <p className="mt-2 max-w-lg text-navy-600">
                Corporate office &amp; factory — {company.address.join(", ")}. Appointments welcome for
                wholesale buyers and OEM sampling.
              </p>
            </div>
            <a
              href={companyDirections}
              target="_blank"
              rel="noreferrer"
              className="btn-gold inline-flex w-full justify-center gap-2 sm:w-auto"
            >
              Get directions
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
          <div className="relative overflow-hidden rounded-3xl border border-[#eee7db] bg-white shadow-soft">
            <iframe
              title={`${company.name} factory map — Muzaffarnagar, Uttar Pradesh, India`}
              src={companyMapSrc}
              className="h-[280px] w-full md:h-[480px]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <div className="border-t border-[#eee7db] bg-white p-4 md:absolute md:bottom-auto md:left-6 md:right-auto md:top-6 md:z-10 md:max-w-xs md:rounded-2xl md:border-0 md:bg-white/95 md:p-4 md:shadow-soft md:pointer-events-none">
              <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-[#8C6E28]">
                <MapPin className="h-3.5 w-3.5" />
                Factory
              </p>
              <p className="mt-2 font-serif text-2xl text-navy-950">{company.name}</p>
              <p className="mt-1 text-sm leading-relaxed text-navy-600">
                {company.address[0]}
                <br />
                {company.address[1]}
                <br />
                {company.address[2]}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
