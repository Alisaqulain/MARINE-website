import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CalendarDays, ChevronRight, Clock, Tag } from "lucide-react";
import { ProductImage } from "@/components/ProductImage";
import { ArticleBody } from "@/components/ArticleBody";
import { BlogProductCard } from "@/components/BlogProductCard";
import { BlogShare } from "@/components/BlogShare";
import { readMinutes } from "@/lib/blog";
import { findPublishedPost, listBlogCategories, listPublishedPosts } from "@/lib/blog-store";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await findPublishedPost(slug);
  return { title: post?.title ?? "Blog", description: post?.excerpt };
}

/** A link to one of our product pages becomes a product box; anything else is a plain button. */
function productSlugFromLink(link: string) {
  const match = /^(?:https?:\/\/[^/]+)?\/product\/([a-z0-9-]+)/i.exec(link.trim());
  return match ? match[1] : null;
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const [post, categories, allPosts] = await Promise.all([
    findPublishedPost(slug),
    listBlogCategories(),
    listPublishedPosts(),
  ]);
  if (!post) notFound();

  const categoryName = categories.find((c) => c.slug === post.category)?.name;
  const linkedProduct = post.link ? productSlugFromLink(post.link) : null;
  const others = allPosts.filter((p) => p.slug !== post.slug);
  const related = [
    ...others.filter((p) => post.category && p.category === post.category),
    ...others.filter((p) => !post.category || p.category !== post.category),
  ].slice(0, 3);

  return (
    <article className="bg-white pb-14">
      <header className="relative overflow-hidden bg-[#081525]">
        <ProductImage src={post.image} alt={post.title} fill sizes="100vw" className="object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#081525] via-[#081525]/70 to-[#081525]/10" />
        <div className="relative mx-auto max-w-[1100px] px-5 pb-8 pt-16 md:pb-12 md:pt-24">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-[12px] text-white/80">
            <Link href="/" className="hover:text-white">
              Home
            </Link>
            <ChevronRight className="h-3 w-3" />
            <Link href="/blog" className="hover:text-white">
              Blog
            </Link>
            {categoryName ? (
              <>
                <ChevronRight className="h-3 w-3" />
                <Link href={`/blog?category=${post.category}`} className="hover:text-white">
                  {categoryName}
                </Link>
              </>
            ) : null}
          </nav>
          <h1 className="mt-4 max-w-3xl font-serif text-3xl leading-tight text-white md:text-5xl">{post.title}</h1>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-white/85 [&>span+span]:border-l [&>span+span]:border-white/30 [&>span+span]:pl-4">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" /> {post.date}
            </span>
            {categoryName ? (
              <span className="inline-flex items-center gap-1.5">
                <Tag className="h-4 w-4" /> {categoryName}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" /> {readMinutes(post.body)} min read
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[820px] px-5 pt-8 md:pt-10">
        <ArticleBody body={post.body} className="text-[16px] leading-relaxed text-navy-700 md:text-[17px]" />

        {post.link ? (
          <div className="mt-8">
            {linkedProduct ? (
              <BlogProductCard slug={linkedProduct} />
            ) : (
              <a
                href={post.link}
                target={post.linkNewTab ? "_blank" : undefined}
                rel={post.linkNewTab ? "noreferrer" : undefined}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#031D38] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#0a3358]"
              >
                Learn more <ArrowRight className="h-4 w-4" />
              </a>
            )}
          </div>
        ) : null}

        <div className="mt-10 flex flex-wrap items-end justify-between gap-4 border-t border-[#eee7db] pt-6">
          <BlogShare title={post.title} />
          <Link href="/blog" className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-800 hover:text-[#8C6E28]">
            Explore more articles <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {related.length ? (
        <section className="mx-auto mt-12 max-w-[1100px] px-5">
          <h2 className="font-serif text-2xl text-navy-900">Related articles</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="group overflow-hidden rounded-xl border border-[#eee7db] bg-white shadow-sm transition hover:shadow-md"
              >
                <div className="relative aspect-[16/10] bg-[#f4f1ea]">
                  <ProductImage src={p.image} alt={p.title} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover" />
                </div>
                <div className="p-4">
                  <p className="font-serif text-base font-semibold leading-snug text-navy-900 group-hover:text-[#8C6E28]">
                    {p.title}
                  </p>
                  <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-navy-500">
                    <CalendarDays className="h-3.5 w-3.5" /> {p.date}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
