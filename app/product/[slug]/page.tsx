"use client";

import {
  B2B_MIN_ORDER_QTY,
  formatPrice,
  getCollection,
  getProduct,
  products,
  saleInfo,
  showsFreeShipping,
  type Product,
} from "@/lib/products";
import { getProductCategory } from "@/lib/catalog";
import { findNamedCategory } from "@/lib/category-label";
import { findShopNowLabel, shopNowTree } from "@/lib/shop-now-data";
import { useCart } from "@/lib/cart-context";
import { useWishlist } from "@/lib/wishlist-context";
import Image from "next/image";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { canAccessWholesale, isRetailCustomer } from "@/lib/wholesale-access";
import { useWholesaleGate } from "@/components/WholesaleGateProvider";
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
import { ShopTabs, type ShopTab } from "@/components/ShopTabs";
import { useProductReviews } from "@/components/ProductReviews";
import { WholesaleNavLink } from "@/components/WholesaleNavLink";
import { ProductShareButtons } from "@/components/ProductShare";
import { companyWhatsApp } from "@/lib/company";
import { FreeShippingTag } from "@/components/FreeShippingTag";
import { PriceRow } from "@/components/PriceRow";
import { SaleEndsIn } from "@/components/SaleEndsIn";
import { ProductGalleryViewer } from "@/components/ProductGalleryViewer";
import { imageAdjustStyle, lowStockMessage } from "@/lib/product-display";
import { imageIndexForColor } from "@/lib/listing-images";
import { useRegion } from "@/lib/region-context";

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const [product, setProduct] = useState<Product | undefined>(() => getProduct(slug));

  useEffect(() => {
    const local = getProduct(slug);
    setProduct(local);
    void fetch(`/api/catalog/product/${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.product) setProduct(data.product);
      })
      .catch(() => {});
  }, [slug]);
  const b2bQuery = useSearchParams().get("b2b") === "1";
  const pathname = usePathname();
  const wholesalePath = pathname?.startsWith("/wholesale/product/") === true;
  const router = useRouter();
  const { data: session, status } = useSession();
  const wholesaleOk = canAccessWholesale(session?.user);
  const wantsWholesale = b2bQuery || wholesalePath;
  const b2b = wantsWholesale && wholesaleOk;
  const { promptSwitchToWholesale } = useWholesaleGate();
  const { add, buyNow } = useCart();
  const { priceFor } = useRegion();

  useEffect(() => {
    if (!wantsWholesale || wholesaleOk || status === "loading" || !slug) return;
    const back = `/wholesale/product/${slug}`;
    if (isRetailCustomer(session?.user)) {
      promptSwitchToWholesale(back);
      router.replace(`/product/${slug}`);
      return;
    }
    router.replace(
      `/login?mode=wholesale&view=register&callbackUrl=${encodeURIComponent(back)}`
    );
  }, [wantsWholesale, wholesaleOk, status, slug, router, session?.user, promptSwitchToWholesale]);
  const { has, toggle } = useWishlist();
  const [active, setActive] = useState(0);
  const [added, setAdded] = useState(false);
  const [color, setColor] = useState("");
  const [material, setMaterial] = useState("");
  const [size, setSize] = useState("");
  const [personalisation, setPersonalisation] = useState<"" | "yes" | "no">("");
  const [personalisationMessage, setPersonalisationMessage] = useState("");
  const [shopTab, setShopTab] = useState<ShopTab>("Items");
  const productReviews = useProductReviews(slug);
  const [qty, setQty] = useState(1);
  const [liveCategoryName, setLiveCategoryName] = useState<string | null>(null);

  useEffect(() => {
    setQty(b2b ? B2B_MIN_ORDER_QTY : 1);
  }, [slug, b2b]);

  useEffect(() => {
    if (!product) return;
    const categorySlug = getProductCategory(product);
    let cancelled = false;
    void fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setLiveCategoryName(findNamedCategory(Array.isArray(data.tree) ? data.tree : [], categorySlug));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [product]);

  const category = useMemo(() => {
    if (!product) return null;
    const slug = getProductCategory(product);
    const inTree = shopNowTree.some((c) => c.slug === slug);
    if (inTree) {
      return {
        label: findShopNowLabel(slug),
        href: `/retail?category=${slug}`,
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
        <Link href={wholesalePath ? "/wholesale" : "/retail"} className="btn-navy mt-6">
          {wholesalePath ? "Back to wholesale" : "Back to retail"}
        </Link>
      </div>
    );
  }

  const manuallyUnavailable = b2b ? product.b2bOutOfScope === true : product.b2cOutOfStock === true;
  const quantityAlert = lowStockMessage(product.quantity);
  const unavailableLabel = "Out of stock";
  const stockAlert = manuallyUnavailable
    ? unavailableLabel
    : b2b
      ? quantityAlert === "Out of stock"
        ? "Out of stock"
        : null
      : quantityAlert;
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
  const basePrice = priceFor(product, b2b);
  const sale = saleInfo(product, b2b);
  const shownRating = productReviews.count ? productReviews.average : product.rating;
  const shownReviewCount = productReviews.count || product.reviews;
  const displayPrice = basePrice + (personalisation === "yes" && personalisationCharge != null ? personalisationCharge : 0);
  const minQty = b2b ? B2B_MIN_ORDER_QTY : 1;
  const maxQty = product.quantity != null && product.quantity > 0 ? product.quantity : 99;
  const outOfStock = manuallyUnavailable || (product.quantity != null && product.quantity <= 0);
  const orderQty = Math.min(maxQty, Math.max(minQty, qty));

  const lineOptions = {
    b2b,
    personalisation: personalisation === "yes" || personalisation === "no" ? personalisation : undefined,
    message: personalisationMessage,
    personalisationPrice: personalisationCharge ?? undefined,
    name: product.name,
    price: product.price,
    priceIndia: product.priceIndia,
    priceUs: product.priceUs,
    image: product.image,
  } as const;

  const handleAdd = () => {
    if (outOfStock) return;
    add(product.slug, orderQty, lineOptions);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  // Buy now checks out only this product; the bag is left as it is.
  const handleBuyNow = () => {
    if (outOfStock) return;
    buyNow(product.slug, orderQty, lineOptions);
    router.push("/checkout?buy=now");
  };

  return (
    <div className="bg-white">
      <div className="mx-auto max-w-[1320px] px-5 py-4 lg:py-8">
        <p className="no-scrollbar -mx-5 overflow-x-auto whitespace-nowrap px-5 pb-3 text-[11px] text-navy-600 lg:mx-0 lg:px-0 lg:pb-0">
          <Link href="/">Home</Link>
          <span className="mx-1.5 text-navy-400">/</span>
          {b2b ? (
            <Link href="/wholesale">Wholesale</Link>
          ) : (
            <Link href="/retail">Retail</Link>
          )}
          {category && (
            <>
              <span className="mx-1.5 text-navy-400">/</span>
              <Link
                href={b2b ? `/wholesale?category=${getProductCategory(product)}` : category.href}
                className="font-medium text-[#8C6E28] lg:font-normal lg:text-inherit"
              >
                {liveCategoryName || category.label}
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
                imageStyle={imageAdjustStyle(product.listingImages?.[active]?.adjust ?? product.imageAdjust)}
                caption={product.listingImages?.[active]?.text}
                textX={product.listingImages?.[active]?.textX}
                textY={product.listingImages?.[active]?.textY}
                title={product.name}
                priceLabel={formatPrice(displayPrice)}
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
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify({
                  "@context": "https://schema.org",
                  "@type": "Product",
                  name: product.name,
                  sku: product.sku,
                  description: product.description,
                  image: product.image,
                  offers: {
                    "@type": "Offer",
                    priceCurrency: "USD",
                    price: basePrice,
                    availability: product.quantity === 0 ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
                  },
                }),
              }}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <Link href="/about" className="font-semibold text-[#222] underline underline-offset-2 hover:text-[#8C6E28]">
                MarinaMuseInternational
              </Link>
              <button
                type="button"
                onClick={() => {
                  setShopTab("Reviews");
                  requestAnimationFrame(() =>
                    document.getElementById("product-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" })
                  );
                }}
                aria-label="See reviews"
                className="inline-flex items-center gap-2"
              >
                <span className="flex items-center gap-0.5 text-[#C9A84C]">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3.5 w-3.5 ${i < Math.round(shownRating) ? "fill-[#C9A84C]" : ""}`}
                    />
                  ))}
                </span>
                <span className="text-navy-600 underline-offset-2 hover:underline">
                  {shownRating.toFixed(1)} · {shownReviewCount} reviews
                </span>
              </button>
              {product.sku && product.sku !== product.slug ? (
                <>
                  <span className="text-navy-400">|</span>
                  <span className="text-navy-500">SKU {product.sku}</span>
                </>
              ) : null}
            </div>
            <div className="mt-3">
              <ProductShareButtons
                path={b2b ? `/wholesale/product/${product.slug}` : `/product/${product.slug}`}
                title={product.name}
              />
            </div>
            <PriceRow
              price={displayPrice}
              salePercent={sale.percent}
              size="page"
              className="mt-3 md:mt-4"
              trailing={!b2b && showsFreeShipping(product) ? <FreeShippingTag /> : null}
            />
            {sale.percent ? (
              <SaleEndsIn endsAt={sale.endsAt} percent={sale.percent} className="mt-1 text-sm" />
            ) : null}
            {sale.terms ? <p className="mt-2 text-sm text-navy-700">{sale.terms}</p> : null}
            {personalisation === "no" ? (
              <p className="mt-1 text-xs text-navy-600">No personalisation · {formatPrice(basePrice)}</p>
            ) : personalisation === "yes" && personalisationCharge != null ? (
              <p className="mt-1 text-xs text-navy-600">
                
              </p>
            ) : null}
            {b2b && (
              <p className="mt-1 text-[13px] font-semibold text-red-700">Min. Order: {B2B_MIN_ORDER_QTY}</p>
            )}
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
                    <option value="no">No Personalisation ({formatPrice(basePrice)})</option>
                    <option value="yes">Yes Personalisation ({formatPrice(personalisationCharge)})</option>
                  </select>
                </label>
                {personalisation === "yes" ? (
                  <div className="mt-3 rounded-xl border border-[#e6dfd2] bg-[#FAF7F2] p-4 text-[14px] text-[#222]">
                    <p className="font-semibold">Personalization</p>
                    <p className="mt-1 font-medium">Personalize It Your Way</p>
                    <p className="mt-1 text-navy-700">
                      Whatever you want—your logo, name, initials, or a special message—we can engrave it directly on
                      the binoculars or tripod
                    </p>
                    <ul className="mt-2 space-y-1">
                      {["Company Logo", "Event Name", "Anniversary Date", "Personalized Message", "Custom Branding"].map(
                        (item) => (
                          <li key={item}>✅ {item}</li>
                        )
                      )}
                    </ul>
                  </div>
                ) : null}
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
            {b2b ? (
              <ul className="mt-4 space-y-1.5 text-[15px] text-[#222]">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-[#2563eb]" strokeWidth={2.5} />
                  <span>Delivery timeline confirmed after order review and communication.</span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-[#2563eb]" strokeWidth={2.5} />
                  <span>
                    Returns and refunds are subject to the agreed order terms and applicable{" "}
                    <Link href="/returns#wholesale" className="underline hover:text-[#8C6E28]">
                      return policy
                    </Link>
                    .
                  </span>
                </li>
              </ul>
            ) : (
              <ul className="mt-4 space-y-1.5 text-[15px] text-[#222]">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-[#2563eb]" strokeWidth={2.5} />
                  <span>
                    Arrives soon! Estimated delivery by{" "}
                    <span className="border-b border-dashed border-[#222]">7-12 business days</span>, if you order today
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-[#2563eb]" strokeWidth={2.5} />
                  <Link href="/returns" className="hover:underline">
                    Returns &amp; exchanges accepted
                  </Link>
                </li>
              </ul>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
              <span
                className={`inline-flex items-center gap-1.5 ${stockAlert ? "font-medium text-[#9a3412]" : "text-emerald-700"}`}
              >
                <Check className="h-4 w-4" /> {stockLabel}
              </span>
            </div>

            <div className="mt-5">
              <p className="text-[13px] font-medium text-navy-800">Quantity</p>
              <div className="mt-2 flex w-fit items-center rounded-full border border-[#e6dfd2]">
                <button
                  type="button"
                  className="px-4 py-2 text-lg disabled:opacity-30"
                  aria-label="Decrease quantity"
                  disabled={orderQty <= minQty || outOfStock}
                  onClick={() => setQty(Math.max(minQty, orderQty - 1))}
                >
                  −
                </button>
                <input
                  type="number"
                  min={minQty}
                  max={maxQty}
                  value={orderQty}
                  aria-label="Quantity"
                  disabled={outOfStock}
                  onChange={(e) => {
                    const next = Number.parseInt(e.target.value, 10);
                    if (!Number.isFinite(next)) return;
                    setQty(Math.min(maxQty, Math.max(minQty, next)));
                  }}
                  className="w-14 border-0 bg-transparent text-center text-sm outline-none"
                />
                <button
                  type="button"
                  className="px-4 py-2 text-lg disabled:opacity-30"
                  aria-label="Increase quantity"
                  disabled={orderQty >= maxQty || outOfStock}
                  onClick={() => setQty(Math.min(maxQty, orderQty + 1))}
                >
                  +
                </button>
              </div>
              {product.quantity != null && product.quantity > 0 ? (
                <p className="mt-1 text-[11px] text-navy-500">{product.quantity} available</p>
              ) : null}
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button onClick={handleAdd} className="btn-navy" disabled={outOfStock}>
                {outOfStock ? unavailableLabel : added ? "Added to Cart" : "Add to Cart"}
              </button>
              {outOfStock ? (
                <span className="btn-gold text-center opacity-50">Buy Now</span>
              ) : (
                <button type="button" onClick={handleBuyNow} className="btn-gold text-center">
                  Buy Now
                </button>
              )}
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("marina-chat-open", { detail: { product: product.slug } })
                  )
                }
                className="inline-flex h-11 w-full min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-[#031D38] px-3 text-[11px] font-semibold uppercase tracking-[0.02em] text-white transition hover:bg-[#0a3358] sm:h-12 sm:gap-1.5 sm:px-3 sm:text-[10px]"
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#C9A84C] sm:h-3 sm:w-3" />
                <span className="whitespace-nowrap">Ask Marina About This Product</span>
              </button>
              <a
                href={companyWhatsApp}
                className="inline-flex h-11 w-full min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full bg-[#25D366] px-3 text-[11px] font-semibold uppercase tracking-[0.04em] text-white sm:h-12 sm:gap-2 sm:px-4 sm:text-[11px] sm:tracking-[0.14em]"
              >
                <MessageCircle className="h-3.5 w-3.5 shrink-0 sm:h-3.5 sm:w-3.5" />
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

            <ItemDetailsPreview wholesale={b2b} />

            <ProductDescription text={product.description} />

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
            </div>
          </div>
        </div>
      </div>

      <div id="product-tabs" className="scroll-mt-[var(--site-nav)] lg:mx-auto lg:max-w-[1320px] lg:px-5 lg:pb-14">
        <ShopTabs
          items={products}
          categoryItems={category?.items}
          categoryLabel={liveCategoryName || category?.label}
          wholesale={b2b}
          currentProduct={product}
          productReviews={productReviews}
          tab={shopTab}
          onTabChange={setShopTab}
        />
      </div>
    </div>
  );
}

function formatDescription(text: string) {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-[#222222]">$1</strong>')
    .replace(/__(.+?)__/g, '<span class="underline underline-offset-2">$1</span>');
}

function ProductDescription({ text }: { text?: string }) {
  const [open, setOpen] = useState(false);
  const body = (text ?? "").trim();
  if (!body) return null;
  const long = body.length > 320;
  return (
    <section className="mt-5 border-t border-[#e6dfd2] pt-5">
      <h2 className="text-[15px] font-semibold text-[#222222]">Item details</h2>
      <div className={`relative mt-3 ${long && !open ? "max-h-56 overflow-hidden" : ""}`}>
        <p
          className="whitespace-pre-wrap text-[14px] leading-relaxed text-navy-700"
          dangerouslySetInnerHTML={{ __html: formatDescription(body) }}
        />
        {long && !open ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent" />
        ) : null}
      </div>
      {long ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-3 text-[14px] font-medium text-[#222222] underline underline-offset-4"
        >
          {open ? "Show less" : "Show more"}
        </button>
      ) : null}
    </section>
  );
}

function ItemDetailsPreview({ wholesale }: { wholesale: boolean }) {
  const pill =
    "rounded-full border border-[#C9A84C]/50 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-navy-800 hover:bg-[#C9A84C]/15";
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      <Link href="/shipping" className={pill}>
        Shipping
      </Link>
      <Link href="/custom-manufacturing" className={pill}>
        Custom manufacturing
      </Link>
      <WholesaleNavLink callbackUrl={wholesale ? "/wholesale/quote" : "/wholesale"} className={pill}>
        {wholesale ? "Bulk quote" : "Wholesale"}
      </WholesaleNavLink>
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
