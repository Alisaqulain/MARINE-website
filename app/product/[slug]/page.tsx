"use client";

import {
  B2B_MIN_ORDER_QTY,
  formatPrice,
  getCollection,
  getProduct,
  products,
  showsFreeShipping,
  type Product,
} from "@/lib/products";
import { getProductCategory } from "@/lib/catalog";
import { findShopNowLabel, shopNowTree } from "@/lib/shop-now-data";
import { useCart } from "@/lib/cart-context";
import { useWishlist } from "@/lib/wishlist-context";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { canAccessWholesale, isRetailCustomer } from "@/lib/wholesale-access";
import { useWholesaleGate } from "@/components/WholesaleGateProvider";
import { WholesaleNavLink } from "@/components/WholesaleNavLink";
import {
  Check,
  Factory,
  Heart,
  MessageCircle,
  Package,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
} from "lucide-react";
import { ShopTabs } from "@/components/ShopTabs";
import { companyWhatsApp } from "@/lib/company";
import { FreeShippingTag } from "@/components/FreeShippingTag";
import { PriceRow } from "@/components/PriceRow";
import { ProductGalleryViewer } from "@/components/ProductGalleryViewer";
import { imageAdjustStyle, lowStockMessage } from "@/lib/product-display";
import { imageIndexForColor } from "@/lib/listing-images";

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<Product | undefined>(() => getProduct(slug));

  useEffect(() => {
    const local = getProduct(slug);
    setProduct(local);
    void fetch(`/api/catalog/product/${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.product) setProduct(data.product);
      })
      .catch(() => {});
  }, [slug]);
  const b2bQuery = useSearchParams().get("b2b") === "1";
  const router = useRouter();
  const { data: session, status } = useSession();
  const wholesaleOk = canAccessWholesale(session?.user);
  const b2b = b2bQuery && wholesaleOk;
  const { promptSwitchToWholesale } = useWholesaleGate();
  const { add } = useCart();

  useEffect(() => {
    if (!b2bQuery || wholesaleOk || status === "loading" || !slug) return;
    const back = `/product/${slug}?b2b=1`;
    if (isRetailCustomer(session?.user)) {
      promptSwitchToWholesale(back);
      router.replace(`/product/${slug}`);
      return;
    }
    router.replace(
      `/login?mode=wholesale&view=register&callbackUrl=${encodeURIComponent(back)}`
    );
  }, [b2bQuery, wholesaleOk, status, slug, router, session?.user, promptSwitchToWholesale]);
  const { has, toggle } = useWishlist();
  const [active, setActive] = useState(0);
  const [added, setAdded] = useState(false);
  const [color, setColor] = useState("");
  const [material, setMaterial] = useState("");
  const [size, setSize] = useState("");
  const [personalisation, setPersonalisation] = useState<"" | "yes" | "no">("");
  const [personalisationMessage, setPersonalisationMessage] = useState("");

  const category = useMemo(() => {
    if (!product) return null;
    const slug = getProductCategory(product);
    const inTree = shopNowTree.some((c) => c.slug === slug);
    if (inTree) {
      return {
        label: findShopNowLabel(slug),
        href: getCollection(slug) ? `/collections/${slug}` : `/collections/${product.collection}`,
        items: products.filter((p) => getProductCategory(p) === slug),
      };
    }
    const col = getCollection(product.collection);
    return col
      ? {
          label: col.name,
          href: `/collections/${col.slug}`,
          items: products.filter((p) => p.collection === product.collection),
        }
      : null;
  }, [product]);

  if (!product) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="font-serif text-3xl md:text-4xl">Piece not found</h1>
        <Link href="/shop" className="btn-navy mt-6">
          Back to shop
        </Link>
      </div>
    );
  }

  const stockAlert = lowStockMessage(product.quantity);
  const stockLabel = stockAlert
    ? stockAlert
    : product.stock === "in-stock"
      ? "In Stock"
      : product.stock === "low"
        ? "Low stock"
        : "Made to order";

  const personalisationCharge =
    product.personalisationPrice != null && Number.isFinite(product.personalisationPrice)
      ? product.personalisationPrice
      : null;
  const displayPrice = product.price + (personalisation === "yes" && personalisationCharge != null ? personalisationCharge : 0);

  const handleAdd = () => {
    add(product.slug, b2b ? B2B_MIN_ORDER_QTY : 1, {
      b2b,
      personalisation: personalisation === "yes" || personalisation === "no" ? personalisation : undefined,
      message: personalisationMessage,
      personalisationPrice: personalisationCharge ?? undefined,
      name: product.name,
      price: product.price,
      image: product.image,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-[1320px] px-5 py-4 lg:py-8">
        <p className="no-scrollbar -mx-5 overflow-x-auto whitespace-nowrap px-5 pb-3 text-[11px] text-navy-600 lg:mx-0 lg:px-0 lg:pb-0">
          <Link href="/">Home</Link>
          <span className="mx-1.5 text-navy-400">/</span>
          <Link href="/shop">Shop</Link>
          {category && (
            <>
              <span className="mx-1.5 text-navy-400">/</span>
              <Link href={category.href} className="font-medium text-[#8C6E28] lg:font-normal lg:text-inherit">
                {category.label}
              </Link>
            </>
          )}
          <span className="mx-1.5 text-navy-400">/</span>
          {product.name}
        </p>

        <div className="mt-0 grid items-start gap-6 lg:mt-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-stretch lg:gap-10">
          <div>
            <div className="-mx-5 lg:mx-0">
            <div className="relative">
              <ProductGalleryViewer
                images={product.gallery.length ? product.gallery : [product.image]}
                alt={product.listingImages?.[active]?.name || product.name}
                active={active}
                onActiveChange={(index) => {
                  setActive(index);
                  const nextColor = product.listingImages?.[index]?.color;
                  if (nextColor) setColor(nextColor);
                }}
                imageStyle={imageAdjustStyle(product.imageAdjust)}
                caption={product.listingImages?.[active]?.text}
              />
              <button
                type="button"
                aria-label={has(product.slug) ? "Remove from wishlist" : "Add to wishlist"}
                onClick={() => toggle(product.slug)}
                className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/95 shadow"
              >
                <Heart
                  className={`h-5 w-5 ${has(product.slug) ? "fill-red-500 text-red-500" : "text-navy-800"}`}
                />
              </button>
            </div>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2.5">
              {product.gallery.map((src, i) => (
                <button
                  key={src + i}
                  onClick={() => {
                    setActive(i);
                    const nextColor = product.listingImages?.[i]?.color;
                    if (nextColor) setColor(nextColor);
                  }}
                  className={`relative aspect-square overflow-hidden rounded-lg ${
                    active === i ? "ring-2 ring-[#C9A84C]" : "ring-1 ring-black/5"
                  }`}
                >
                  <Image src={src} alt="" fill className="object-cover" />
                </button>
              ))}
            </div>
          </div>

          <div className="flex min-h-0 flex-col">
            <h1 className="text-[1.35rem] font-normal leading-tight text-[#222222] md:text-[2.15rem]">{product.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="flex items-center gap-0.5 text-[#C9A84C]">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-3.5 w-3.5 ${i < Math.round(product.rating) ? "fill-[#C9A84C]" : ""}`}
                  />
                ))}
              </span>
              <span className="text-navy-600">{product.rating.toFixed(1)} · {product.reviews} reviews</span>
              <span className="text-navy-400">|</span>
              <span className="text-navy-500">{product.sku}</span>
            </div>
            <PriceRow price={displayPrice} size="page" className="mt-3 md:mt-4" />
            {b2b && (
              <p className="mt-1 text-[13px] font-medium text-[#595959]">Min. Order: {B2B_MIN_ORDER_QTY}</p>
            )}
            {!b2b && showsFreeShipping(product) ? <FreeShippingTag /> : null}
            <ColorSelect
              options={product.colors}
              value={color}
              onChange={(next) => {
                setColor(next);
                const index = imageIndexForColor(product.listingImages, next);
                if (index >= 0) setActive(index);
              }}
            />
            <OptionRow label="Material" options={product.materials} value={material} onChange={setMaterial} />
            <OptionRow label="Size" options={product.sizes} value={size} onChange={setSize} />
            {personalisationCharge != null ? (
              <div className="mt-4">
                <label className="block text-[13px] font-medium text-navy-800">
                  Personalisation
                  <select
                    className="input mt-2 font-normal"
                    value={personalisation}
                    onChange={(e) => setPersonalisation(e.target.value as "" | "yes" | "no")}
                  >
                    <option value="">Select an option</option>
                    <option value="no">No Personalisation ({formatPrice(0)})</option>
                    <option value="yes">Yes Personalisation ({formatPrice(personalisationCharge)})</option>
                  </select>
                </label>
                {personalisation === "yes" ? (
                  <label className="mt-3 block text-[13px] font-medium text-navy-800">
                    Add your message
                    <textarea
                      className="input mt-2 min-h-20 font-normal"
                      value={personalisationMessage}
                      onChange={(e) => setPersonalisationMessage(e.target.value)}
                      placeholder="Message to engrave or print"
                      maxLength={300}
                    />
                  </label>
                ) : null}
              </div>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
              <span
                className={`inline-flex items-center gap-1.5 ${stockAlert ? "font-medium text-[#9a3412]" : "text-emerald-700"}`}
              >
                <Check className="h-4 w-4" /> {stockLabel}
              </span>
              <span className="inline-flex items-center gap-1.5 text-navy-600">
                <Truck className="h-4 w-4 text-[#C9A84C]" />
                Estimated delivery 5–7 business days
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button onClick={handleAdd} className="btn-navy">
                {added ? "Added to Cart" : "Add to Cart"}
              </button>
              <Link href="/checkout" onClick={handleAdd} className="btn-gold text-center">
                Buy Now
              </Link>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("marina-chat-open", { detail: { product: product.slug } })
                  )
                }
                className="inline-flex h-11 min-w-0 items-center justify-center gap-1 rounded-full border border-navy-800 px-2.5 text-center text-[9px] font-semibold uppercase leading-tight tracking-tight sm:h-12 sm:gap-1.5 sm:px-3 sm:text-[10px]"
              >
                <Sparkles className="h-3 w-3 shrink-0 text-[#C9A84C]" />
                <span className="min-w-0">Ask Marina About This Product</span>
              </button>
              <a
                href={companyWhatsApp}
                className="inline-flex h-11 min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-full bg-[#25D366] px-2 text-[8px] font-semibold uppercase tracking-[0.04em] text-white sm:h-12 sm:gap-2 sm:px-4 sm:text-[11px] sm:tracking-[0.14em]"
              >
                <MessageCircle className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
                WhatsApp Us
              </a>
            </div>

            <div className="mt-6 grid grid-cols-2 items-center gap-3 border-t border-[#e6dfd2] pt-5 text-center text-[11px] text-navy-700 sm:grid-cols-3 sm:gap-4">
              <div>
                <ShieldCheck className="mx-auto h-5 w-5 text-[#C9A84C]" />
                <Link href="/payment" className="mt-1 block hover:text-[#8C6E28]">
                  Secure Payment
                </Link>
              </div>
              <div>
                <RotateCcw className="mx-auto h-5 w-5 text-[#C9A84C]" />
                <Link href="/returns" className="mt-1 block hover:text-[#8C6E28]">
                  Return in 14 Days
                </Link>
              </div>
              <Link
                href="/returns"
                className="btn-gold col-span-2 w-full sm:col-span-1"
              >
                Start a Return
              </Link>
            </div>

            <div className="mt-5 hidden flex-1 rounded-2xl border border-[#e6dfd2] bg-[#FAF7F2] p-4 md:p-5 lg:block">
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[#8C6E28]">
                What&apos;s included
              </h2>
              <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(product.included.length ? product.included : ["Product", "Export packing"]).map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[13px] text-navy-800">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A84C]" />
                    {item}
                  </li>
                ))}
              </ul>

              <h2 className="mt-5 text-[13px] font-semibold uppercase tracking-[0.16em] text-[#8C6E28]">
                Order protection
              </h2>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  { icon: ShieldCheck, label: "Inspected before dispatch" },
                  { icon: Package, label: "Export carton packing" },
                  { icon: Truck, label: "Worldwide shipping options" },
                  { icon: Factory, label: "Made in Roorkee, India" },
                ].map((f) => (
                  <div key={f.label} className="flex items-start gap-2 rounded-lg bg-white px-3 py-2.5">
                    <f.icon className="mt-0.5 h-4 w-4 shrink-0 text-[#C9A84C]" />
                    <p className="text-[12px] leading-snug text-navy-800">{f.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/shipping" className="rounded-full border border-[#C9A84C]/50 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-800 hover:bg-[#C9A84C]/15">
                  Shipping
                </Link>
                <Link href="/custom-manufacturing" className="rounded-full border border-[#C9A84C]/50 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-800 hover:bg-[#C9A84C]/15">
                  Custom manufacturing
                </Link>
                <WholesaleNavLink
                  callbackUrl={b2b ? "/wholesale/quote" : "/wholesale"}
                  className="rounded-full border border-[#C9A84C]/50 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-800 hover:bg-[#C9A84C]/15"
                >
                  {b2b ? "Bulk quote" : "Wholesale"}
                </WholesaleNavLink>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:mx-auto lg:max-w-[1320px] lg:px-5 lg:pb-14">
        <ShopTabs
          items={products}
          categoryItems={category?.items}
          categoryLabel={category?.label}
          currentProduct={product}
          wholesale={b2b}
        />
      </div>
    </div>
  );
}

function ColorSelect({
  options,
  value,
  onChange,
}: {
  options?: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  if (!options?.length) return null;
  return (
    <label className="mt-4 block text-[13px] font-medium text-navy-800">
      Color
      <select
        className="input mt-2 font-normal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select a color</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function OptionRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options?: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  if (!options?.length) return null;
  return (
    <div className="mt-4">
      <p className="text-[13px] font-medium text-navy-800">
        {label}
        {value ? <span className="font-normal text-navy-600">: {value}</span> : null}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = value === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option)}
              className={`rounded-full border px-3 py-1.5 text-[13px] ${
                selected
                  ? "border-[#C9A84C] bg-[#C9A84C] text-[#1a1408]"
                  : "border-[#e6dfd2] bg-white text-navy-800 hover:border-[#C9A84C]"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
