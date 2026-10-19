import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductImage } from "@/components/ProductImage";
import { findPublishedPost } from "@/lib/blog-store";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await findPublishedPost(slug);
  return { title: post?.title ?? "Blog", description: post?.excerpt };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await findPublishedPost(slug);
  if (!post) notFound();

  return (
    <article className="bg-[#FAF7F2] pb-12">
      <div className="relative h-[28vh] min-h-[200px] overflow-hidden bg-navy-950">
        <ProductImage src={post.image} alt={post.title} fill sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-[#081525]/55" />
      </div>
      <div className="mx-auto max-w-[720px] px-5">
        <p className="mt-8 text-[11px] uppercase tracking-[0.22em] text-[#8C6E28]">{post.date}</p>
        <h1 className="mt-3 font-serif text-3xl md:text-5xl">{post.title}</h1>
        <div className="mt-8 space-y-5 text-[17px] leading-relaxed text-navy-700">
          {post.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <Link href="/blog" className="mt-10 inline-block text-sm text-[#8C6E28] underline">
          Back to blog
        </Link>
      </div>
    </article>
  );
}
