import Image from "next/image";
import Link from "next/link";
import {
  Aperture,
  PackageCheck,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { BannerHero } from "@/components/BannerHero";
import { WholesaleNavLink } from "@/components/WholesaleNavLink";
import { heroImg, img } from "@/lib/images";

const pillars = [
  {
    icon: Sparkles,
    title: "Authentic craftsmanship",
    body: "Skilled artisans in our own facility, combining traditional handwork with modern production.",
  },
  {
    icon: ShieldCheck,
    title: "Premium materials",
    body: "Solid brass, steel and selected woods — specified for finish, weight and lasting use.",
  },
  {
    icon: Aperture,
    title: "Detailed finishing",
    body: "Patina, polish, assembly and optics checked piece by piece before anything is packed.",
  },
  {
    icon: PackageCheck,
    title: "Export-ready quality",
    body: "Inspection, secure packing and worldwide dispatch for retail, wholesale and OEM orders.",
  },
];

const ranges = [
  {
    title: "Armour",
    image: img.knight,
    items: [
      { name: "Armor Breast Plates & Jackets", href: "/collections/armor-breast-plate" },
      { name: "Armor Helmets", href: "/collections/armor-helmets" },
      { name: "Muscle Armour", href: "/collections/muscle-armour" },
      { name: "Full Suit of Armor", href: "/collections/full-suit-of-armor" },
      { name: "Armory Props", href: "/collections/armory-props" },
    ],
  },
  {
    title: "Nautical instruments",
    image: img.telescope,
    items: [
      { name: "Diving Helmets", href: "/collections/diving-helmets" },
      { name: "Brass Nautical Telescopes", href: "/collections/telescopes" },
      { name: "Brass Nautical Binoculars", href: "/collections/brass-binoculars" },
      { name: "Compasses", href: "/collections/brass-compasses" },
      { name: "Spotlights & Searchlights", href: "/collections/spotlight-searchlight" },
      { name: "Nautical Brass Sextants", href: "/collections/nautical-instruments" },
      { name: "Magnifying Glasses", href: "/collections/magnifying-glass" },
    ],
  },
  {
    title: "Maritime décor & gifts",
    image: img.ship,
    items: [
      { name: "Sand Timers", href: "/collections/nautical-instruments" },
      { name: "Clocks", href: "/collections/clocks" },
      { name: "Ship Wheels", href: "/collections/ship-wheels" },
      { name: "Ship Bells", href: "/collections/ship-bell" },
      { name: "Ship Telegraphs", href: "/collections/nautical-decor" },
      { name: "Walking Sticks & Shoe Horns", href: "/collections/walking-canes" },
      { name: "Keyrings, Keychains & Pendants", href: "/collections/nautical-decor" },
      { name: "Nautical Décor & Gifts", href: "/collections/nautical-decor" },
    ],
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
              <Link href="/shop" className="btn-gold w-full sm:w-auto">
                B2C Retail Collection
              </Link>
              <WholesaleNavLink callbackUrl="/wholesale" className="btn-navy w-full sm:w-auto">
                B2B Wholesale Collection
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
          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {ranges.map((range) => (
              <article
                key={range.title}
                className="overflow-hidden rounded-3xl border border-[#eee7db] bg-[#FAF7F2]"
              >
                <div className="relative h-44">
                  <Image src={range.image} alt={range.title} fill className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#081525]/80 to-transparent" />
                  <h3 className="absolute bottom-4 left-5 font-serif text-2xl text-white">{range.title}</h3>
                </div>
                <ul className="space-y-2 p-5">
                  {range.items.map((item) => (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className="text-sm text-navy-700 transition hover:text-[#8C6E28]"
                      >
                        {item.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-navy-600">
            Additional handcrafted products are available on request, including custom sizes, materials
            and finishes.
          </p>
        </div>
      </section>

      <section className="px-5 py-10 md:py-14">
        <div className="mx-auto grid max-w-[1320px] items-center gap-8 md:grid-cols-2">
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl">
            <Image
              src={heroImg.telescope}
              alt="Brass nautical telescope"
              fill
              className="object-cover"
            />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#8C6E28]">Instruments &amp; programmes</p>
            <h2 className="mt-2 font-serif text-[1.65rem] md:text-4xl">Built to view, finished to last</h2>
            <p className="mt-5 leading-relaxed text-navy-700">
              Our telescopes and binoculars are designed for actual viewing as well as premium
              presentation, with different models, lens sizes and specifications available.
            </p>
            <p className="mt-4 leading-relaxed text-navy-700">
              We also undertake custom manufacturing and bulk orders, allowing customers to request
              specific designs, sizes, materials, finishes and specifications. Every product is
              carefully checked and securely packed before dispatch. We provide worldwide shipping
              and aim to deliver authentic handcrafted products with professional service and
              customer satisfaction.
            </p>
            <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap">
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

      <section className="bg-white px-5 py-10 md:py-14">
        <div className="mx-auto max-w-[1320px]">
          <h2 className="text-center font-serif text-[1.65rem] md:text-4xl">What we stand for</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {pillars.map((v) => (
              <div key={v.title} className="rounded-2xl border border-[#eee7db] bg-[#FAF7F2] p-6">
                <v.icon className="h-6 w-6 text-[#C9A84C]" strokeWidth={1.5} />
                <h3 className="mt-4 font-serif text-xl md:text-2xl">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-navy-600">{v.body}</p>
              </div>
            ))}
          </div>
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
