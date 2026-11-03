import Image from "next/image";
import Link from "next/link";
import { BannerHero } from "@/components/BannerHero";
import { WholesaleNavLink } from "@/components/WholesaleNavLink";
import { img } from "@/lib/images";

const pillars = [
  {
    title: "Authentic craftsmanship",
    body: "Skilled artisans in our own facility, combining traditional handwork with modern production.",
  },
  {
    title: "Premium materials",
    body: "Solid brass, steel and selected woods — specified for finish, weight and lasting use.",
  },
  {
    title: "Detailed finishing",
    body: "Patina, polish, assembly and optics checked piece by piece before anything is packed.",
  },
  {
    title: "Export-ready quality",
    body: "Inspection, secure packing and worldwide dispatch for retail, wholesale and OEM orders.",
  },
];

const facts = [
  { value: "2011", label: "Established" },
  { value: "India", label: "Manufacturing & export" },
  { value: "Own facility", label: "Artisan production" },
  { value: "Worldwide", label: "Retail, wholesale & OEM" },
];

export default function AboutPage() {
  return (
    <div className="bg-[#FAF7F2]">
      <BannerHero
        src="/about-banner.jpeg"
        mobileSrc="/mobile/about.png"
        alt="About Marina Muse International — exporter, manufacturer & supplier of handcrafted nautical, brass and armour products from Roorkee, India"
        title="About Marina Muse International"
      />

      <section className="px-5 py-10 md:py-14">
        <div className="mx-auto grid max-w-[1320px] items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative overflow-hidden rounded-3xl bg-[#081525] px-6 py-8 text-cream-50 md:px-12 md:py-12">
            <Image src={img.compassMap} alt="" fill className="object-cover opacity-20" />
            <div className="relative">
              <div className="grid h-16 w-16 place-items-center rounded-full border border-[#C9A84C] font-serif text-2xl text-[#C9A84C] md:h-24 md:w-24 md:text-3xl">
                MM
              </div>
              <p className="mt-5 text-[11px] uppercase tracking-[0.28em] text-[#C9A84C] md:mt-8">
                CEO &amp; Founder
              </p>
              <h2 className="mt-3 font-serif text-3xl leading-tight md:text-[2.6rem]">
                Mr. Mohammad Muaaz
              </h2>
              <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/70">
                Directing Marina Muse International with a focus on authentic craft, premium materials and
                reliable export quality.
              </p>
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#8C6E28]">Our house</p>
              <h2 className="mt-2 font-serif text-[1.65rem] md:text-5xl">Dedicated since 2011</h2>
            <p className="mt-5 leading-relaxed text-navy-700">
              Since 2011, Marina Muse International has been dedicated to the manufacturing and export of
              handcrafted products from India. Under the guidance of our Founder, Mr. Mohammad Muaaz,
              the company focuses on authentic craftsmanship, premium materials, detailed finishing
              and reliable quality.
            </p>
            <p className="mt-4 leading-relaxed text-navy-700">
              Our products are handcrafted by skilled artisans in our own manufacturing facility,
              combining traditional craftsmanship with modern production and quality-control methods.
              We serve customers worldwide and offer both standard collections and customised
              manufacturing according to individual requirements.
            </p>
            <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap">
              <Link href="/retail" className="btn-gold w-full sm:w-auto">
                Retail Collection
              </Link>
              <WholesaleNavLink callbackUrl="/wholesale" className="btn-navy w-full sm:w-auto">
                Wholesale Collection
              </WholesaleNavLink>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white px-5 py-10 md:py-14">
        <div className="mx-auto max-w-[1320px]">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-[#8C6E28]">The house, worldwide</p>
            <h2 className="mt-2 font-serif text-[1.65rem] md:text-[2.75rem]">
              Marina Muse International
            </h2>
            <p className="mt-5 leading-relaxed text-navy-700">
              Marina Muse International is an exporter, manufacturer and supplier from India specialising
              in handcrafted nautical, maritime, brass, armour, vintage, decorative and functional
              products. Every line is made with careful attention to quality, craftsmanship, finishing
              and durability.
            </p>
          </div>
        </div>
      </section>

      <section className="px-5 py-10 md:py-14">
        {/* Centred, comfortable reading width (~850px) instead of the full 1320px. */}
        <div className="mx-auto max-w-[850px] text-center">
          <div>
            <h2 className="font-serif text-[1.65rem] leading-snug md:text-4xl">Authentic Craftsmanship. Quality You Can Trust.</h2>
            <p className="mt-4 leading-relaxed text-navy-700">
              At MARINA MUSE INTERNATIONAL, we bring together traditional craftsmanship, timeless design and practical
              functionality. Our collection spans handcrafted brass homeware, kitchenware, optical instruments, nautical
              décor, lighting, jewellery and heritage-inspired creations.
            </p>
            <h3 className="mt-7 font-serif text-xl leading-snug md:text-2xl">Made with Care. Backed by Craftsmanship.</h3>
            <p className="mt-3 leading-relaxed text-navy-700">
              As manufacturers, we offer custom production and bulk orders, with options for tailored designs, sizes,
              materials and finishes according to product requirements.
            </p>
            <p className="mt-4 leading-relaxed text-navy-700">
              Every product is carefully inspected and securely packed before dispatch. We welcome individual customers,
              retailers, wholesalers and international business partners, offering personalized service and worldwide
              shipping.
            </p>
            <p className="mt-4 leading-relaxed text-navy-700">Discover distinctive craftsmanship from our own manufacturing workshop.</p>
            <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap sm:justify-center">
              <Link href="/custom-manufacturing" className="btn-gold w-full sm:w-auto">
                Custom manufacturing
              </Link>
              <Link href="/contact" className="btn-navy w-full sm:w-auto">
                Speak with us
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#0B1D36]">
        {/* The four values are part of the image; the same text stays readable for screen readers and search. */}
        <h2 className="sr-only">What we stand for</h2>
        <ul className="sr-only">
          {pillars.map((v) => (
            <li key={v.title}>
              {v.title}: {v.body}
            </li>
          ))}
        </ul>
        <div className="relative mx-auto aspect-[1600/533] w-full max-w-[1600px]">
          <Image
            src="/about-bottom.jpeg"
            alt="Authentic craftsmanship, premium materials, detailed finishing and export-ready quality"
            fill
            sizes="(min-width: 1600px) 1600px, 100vw"
            className="object-cover"
          />
        </div>
      </section>

      <section className="relative overflow-hidden bg-navy-950 py-10 text-cream-50 md:py-12">
        <Image src={img.compassMap} alt="" fill className="object-cover opacity-25" />
        <div className="relative mx-auto grid max-w-[1320px] grid-cols-2 gap-6 px-5 md:grid-cols-4">
          {facts.map((s) => (
            <div key={s.label} className="text-center">
              <p className="font-serif text-3xl text-[#C9A84C] md:text-4xl">{s.value}</p>
              <p className="mt-2 text-sm text-cream-100/70">{s.label}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
