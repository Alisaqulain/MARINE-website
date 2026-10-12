import Image from "next/image";

const frames = {
  header: "h-14 max-w-[46vw] sm:h-16 sm:max-w-none lg:h-16 xl:h-[4.25rem] 2xl:h-20",
  footer: "h-10 max-w-[180px] overflow-hidden sm:h-12 sm:max-w-[220px] md:h-14",
  hero: "mx-auto h-24 max-w-full overflow-hidden rounded-2xl sm:h-36 md:h-48",
  admin: "h-14 max-w-full overflow-hidden rounded-lg",
  auth: "mx-auto h-24 max-w-full overflow-hidden rounded-2xl shadow-soft sm:h-28",
};

export function BrandLogo({
  size = "header",
  priority = false,
}: {
  size?: keyof typeof frames;
  priority?: boolean;
}) {
  return (
    <span className={`relative inline-block leading-none ${frames[size]}`}>
      <Image
        src="/logo-navy.jpg"
        alt="Marina Muse International — Timeless Craftsmanship, Global Reach"
        width={1460}
        height={510}
        priority={priority}
        sizes={size === "hero" ? "(max-width: 768px) 90vw, 576px" : "240px"}
        className="h-full w-auto max-w-full object-contain"
      />
    </span>
  );
}

export function BrandWordmark({
  stacked = false,
  light = true,
}: {
  stacked?: boolean;
  light?: boolean;
}) {
  return (
    <BrandLogo
      size={stacked ? "hero" : light ? "header" : "footer"}
      priority={stacked || light}
    />
  );
}
