import type { Metadata } from "next";
import Image from "next/image";
import { Box, Factory, FileText, Handshake, Home, MapPin, Plane, Ship } from "lucide-react";
import { BannerHero } from "@/components/BannerHero";

export const metadata: Metadata = {
  title: "Shipping",
  description:
    "Marina Muse delivers worldwide by air and sea from India — DHL, FedEx, TNT, UPS, FOB, Ex-Works, port-to-port and door-to-door.",
};

const ports = ["Mumbai", "New Delhi", "Roorkee", "TKD", "Etc..."];

const options = [
  { icon: Plane, title: "Port to Port", body: "(Sea Freight)" },
  { icon: Home, title: "Door to Door", body: "(Home Delivery)" },
  { icon: FileText, title: "FOB Shipping", body: "" },
  { icon: Factory, title: "Ex-Works", body: "" },
];

const markets = [
  { name: "Europe", src: "https://flagcdn.com/w160/eu.png" },
  { name: "USA", src: "https://flagcdn.com/w160/us.png" },
  { name: "UK", src: "https://flagcdn.com/w160/gb.png" },
  { name: "Canada", src: "https://flagcdn.com/w160/ca.png" },
  { name: "Australia", src: "https://flagcdn.com/w160/au.png" },
  { name: "Middle East", src: "https://flagcdn.com/w160/ae.png" },
  { name: "& More", src: "/globe-more.png" },
];

function CircleIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-[#0B1D36] text-white shadow-[0_6px_16px_rgba(11,29,54,0.18)] md:h-[78px] md:w-[78px] [&_svg]:h-6 [&_svg]:w-6 md:[&_svg]:h-8 md:[&_svg]:w-8">
      {children}
    </div>
  );
}

export default function ShippingPage() {
  return (
    <div className="bg-white">
      <BannerHero
        src="/shipping-banner.jpeg"
        mobileSrc="/mobile/shipping.png"
        alt="Shipping — we deliver your orders worldwide by air and sea. Cargo ship, aircraft and truck at port"
        title="Shipping — We deliver your orders worldwide"
      />

      <section className="px-5 pt-8 pb-3 md:pt-10 md:pb-4">
        <div className="mx-auto max-w-[1180px] space-y-7">
          <div className="grid items-center gap-6 lg:grid-cols-[300px_1fr]">
            <div className="flex items-center gap-4">
              <CircleIcon>
                <Plane className="h-8 w-8" strokeWidth={1.7} />
              </CircleIcon>
              <div>
                <h2 className="text-[17px] font-bold text-[#0B1D36]">Air Shipping</h2>
                <p className="mt-1 max-w-[210px] text-[13px] leading-relaxed text-navy-600">
                  Fast, reliable and secure air freight for urgent and time-sensitive shipments.
                </p>
              </div>
            </div>
            <div>
              <p className="text-[13px] text-navy-700">We use trusted couriers for air shipments</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 md:gap-4">
                <div className="flex h-11 items-center bg-[#FFCC00] px-3 text-[22px] font-black italic tracking-tight text-[#D40511]">
                  DHL
                </div>
                <div className="flex h-11 items-center px-1 text-[22px] font-black tracking-tight">
                  <span className="text-[#4D148C]">Fed</span>
                  <span className="text-[#FF6600]">Ex</span>
                </div>
                <div className="flex h-11 items-center rounded-full bg-[#FF6600] px-5 text-[20px] font-black tracking-widest text-white">
                  TNT
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[#351C15] text-[11px] font-black text-[#FFB500]">
                  UPS
                </div>
              </div>
              <p className="mt-2 text-[11px] tracking-[0.12em] text-navy-500">
                DHL EXPRESS &nbsp;|&nbsp; FedEx EXPRESS &nbsp;|&nbsp; TNT &nbsp;|&nbsp; UPS &nbsp;|&nbsp; Etc...
              </p>
            </div>
          </div>

          <div className="grid items-center gap-6 lg:grid-cols-[300px_1fr]">
            <div className="flex items-center gap-4">
              <CircleIcon>
                <Ship className="h-8 w-8" strokeWidth={1.7} />
              </CircleIcon>
              <div>
                <h2 className="text-[17px] font-bold text-[#0B1D36]">Sea Shipping</h2>
                <p className="mt-1 max-w-[210px] text-[13px] leading-relaxed text-navy-600">
                  Cost-effective and reliable sea freight for larger consignments.
                </p>
              </div>
            </div>
            <div>
              <p className="text-[13px] text-navy-700">We offer shipping by Sea from</p>
              <div className="mt-3 flex flex-wrap items-center gap-2.5">
                {ports.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#0B1D36] px-3.5 py-[7px] text-[13px] text-white"
                  >
                    <MapPin className="h-3.5 w-3.5 text-white" />
                    {p}
                  </span>
                ))}
                <span className="ml-2 inline-flex items-center gap-2 text-[13px] font-semibold text-[#0B1D36]">
                  <Ship className="h-9 w-9" strokeWidth={1.4} />
                  Major Indian Ports
                </span>
              </div>
            </div>
          </div>

          <div className="grid items-center gap-6 lg:grid-cols-[300px_1fr]">
            <div className="flex items-center gap-4">
              <CircleIcon>
                <Box className="h-8 w-8" strokeWidth={1.7} />
              </CircleIcon>
              <div>
                <h2 className="text-[17px] font-bold text-[#0B1D36]">Shipping Options</h2>
                <p className="mt-1 max-w-[210px] text-[13px] leading-relaxed text-navy-600">
                  We provide flexible shipping solutions according to your needs.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {options.map((o) => (
                <div key={o.title} className="flex items-center gap-3 sm:flex-col sm:text-center">
                  <o.icon className="h-9 w-9 shrink-0 text-[#0B1D36]" strokeWidth={1.45} />
                  <div>
                    <p className="text-[14px] font-semibold text-[#0B1D36]">{o.title}</p>
                    {o.body ? <p className="text-[12px] text-navy-500">{o.body}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[#e8eef5] bg-[#F3F7FB] px-5 py-3">
        <div className="mx-auto flex max-w-[1180px] flex-col items-center gap-5 lg:flex-row lg:items-center lg:gap-6">
          <div className="w-full shrink-0 lg:w-[280px]">
            <h2 className="font-serif text-[1.65rem] leading-tight text-[#0B1D36] md:text-[2rem]">Our Global Reach</h2>
            <p className="mt-2 text-[13px] leading-relaxed text-navy-600">
              We export to our valued customers around the world. Our main markets include Europe, USA, UK,
              Canada, Australia and Middle East, along with other international clients.
            </p>
          </div>
          <div className="flex w-full min-w-0 flex-1 flex-wrap items-center justify-center gap-x-3 gap-y-3 sm:flex-nowrap sm:justify-between sm:gap-4">
            <div className="grid grid-cols-4 justify-items-center gap-x-2 gap-y-3 sm:flex sm:items-start sm:gap-3">
              {markets.map((m) => (
                <div key={m.name} className="flex w-[64px] flex-col items-center sm:w-[68px]">
                  <div className="relative h-[48px] w-[48px] overflow-hidden rounded-full bg-white shadow-[0_4px_12px_rgba(11,29,54,0.12)] ring-1 ring-[#d7e2ee] sm:h-[52px] sm:w-[52px]">
                    <Image src={m.src} alt={`${m.name} flag`} fill className="object-cover" sizes="52px" />
                  </div>
                  <p className="mt-1.5 text-center text-[10px] font-medium leading-tight text-[#0B1D36] sm:text-[11px]">
                    {m.name}
                  </p>
                </div>
              ))}
            </div>
            <div className="relative h-[108px] w-[220px] shrink-0 overflow-hidden sm:h-[118px] sm:w-[250px]">
              <Image
                src="/shipping-world-map.png"
                alt="Worldwide shipping routes from India"
                width={1280}
                height={720}
                className="pointer-events-none absolute right-0 top-1/2 h-[220px] w-auto max-w-none -translate-y-1/2"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#0B1D36] px-5 py-3">
        <div className="mx-auto flex max-w-[900px] flex-col items-center justify-center gap-3 text-center sm:flex-row sm:gap-4">
          <Handshake className="h-10 w-10 shrink-0 text-[#C9A84C]" strokeWidth={1.5} />
          <p className="font-serif text-[1.35rem] italic leading-snug text-[#C9A84C] md:text-[1.55rem]">
            We request you to give us a chance to prove our capabilities
            <span className="mt-0.5 block font-sans text-[13px] not-italic text-white/70">
              &amp; we hope that we will have a good business relationship.
            </span>
          </p>
        </div>
      </section>
    </div>
  );
}
