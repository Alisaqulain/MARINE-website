import type { Metadata } from "next";
import { getStorefrontProduct } from "@/lib/storefront-catalog";

type Props = { params: Promise<{ slug: string }>; children: React.ReactNode };

function absoluteImage(src: string | undefined) {
  if (!src) return undefined;
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.AUTH_URL ||
    "https://marinamuseinternational.com";
  return `${base.replace(/\/$/, "")}${src.startsWith("/") ? src : `/${src}`}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getStorefrontProduct(slug);
  const title = product?.name ?? "Product";
  const description = (product?.description || product?.story || title).slice(0, 160);
  const image = absoluteImage(product?.image) || absoluteImage("/newlogo.png");

  return {
    title,
    description,
    openGraph: {
      title: `${title} · Marina Muse International`,
      description,
      type: "website",
      url: absoluteImage(`/product/${slug}`),
      images: image
        ? [
            {
              url: image,
              width: 1200,
              height: 1200,
              alt: title,
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default function ProductLayout({ children }: Props) {
  return children;
}
