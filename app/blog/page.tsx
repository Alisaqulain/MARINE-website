import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { BLOG_PAGE_SIZE } from "@/lib/blog";
import { listBlogCategories, listPublishedPosts } from "@/lib/blog-store";
import { ProductImage } from "@/components/ProductImage";
import { BannerHero } from "@/components/BannerHero";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog",
  description: "Tips, stories and guides from the world of brass, travel and timeless craftsmanship.",
};

type Props = { searchParams: Promise<{ category?: string; page?: string }> };

function blogHref(category: string, page = 1) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/blog?${qs}` : "/blog";
}

export default async function BlogPage({ searchParams }: Props) {
  const { category = "", page: pageParam } = await searchParams;
  const [posts, categories] = await Promise.all([listPublishedPosts(), listBlogCategories()]);
  const names = new Map(categories.map((c) => [c.slug, c.name]));
  const filtered = category ? posts.filter((p) => p.category === category) : posts;
  const pages = Math.max(1, Math.ceil(filtered.length / BLOG_PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1));
  const shown = filtered.slice((page - 1) * BLOG_PAGE_SIZE, page * BLOG_PAGE_SIZE);

  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-4 py-2 text-[13px] font-medium transition ${
      active
        ? "border-[#B8892F] bg-[#B8892F] text-white"
        : "border-[#e6dfd2] bg-white text-navy-800 hover:border-[#C9A84C]"
    }`;

  return (
    <div className="bg-white">
      <BannerHero
        src="/blog-slide.jpeg"
        mobileSrc="/mobile/blog.png"
        alt="Marina Muse blog — craft, collections and trade from the atelier"
        title="Blog"
      />

      <section className="mx-auto max-w-[1200px] px-5 py-8 md:py-10">
        <nav aria-label="Blog categories" className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:px-0">
          <Link href="/blog" className={chip(!category)}>
            All
          </Link>
          {categories.map((c) => (
            <Link key={c.slug} href={blogHref(c.slug)} className={chip(category === c.slug)}>
              {c.name}
            </Link>
          ))}
        </nav>

        {shown.length === 0 ? (
          <p className="py-16 text-center text-sm text-navy-600">No articles in this category yet.</p>
        ) : (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((post) => (
              <article
                key={post.slug}
                className="flex flex-col overflow-hidden rounded-xl border border-[#eee7db] bg-white shadow-sm transition hover:shadow-md"
              >
                <Link href={`/blog/${post.slug}`} className="relative block aspect-[16/10] bg-[#f4f1ea]">
                  <ProductImage
                    src={post.image}
                    alt={post.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover"
                  />
                  {post.category && names.get(post.category) ? (
                    <span className="absolute bottom-0 left-3 translate-y-1/2 rounded-full bg-[#B8892F] px-3 py-1 text-[11px] font-medium text-white shadow">
                      {names.get(post.category)}
                    </span>
                  ) : null}
                </Link>
                <div className="flex flex-1 flex-col px-5 pb-5 pt-6">
                  <h2 className="font-serif text-lg font-semibold leading-snug text-navy-900">
                    <Link href={`/blog/${post.slug}`} className="hover:text-[#8C6E28]">
                      {post.title}
                    </Link>
                  </h2>
                  <p className="mt-3 line-clamp-3 flex-1 text-sm leading-relaxed text-navy-600">{post.excerpt}</p>
                  <div className="mt-5 flex items-center justify-between text-[13px]">
                    <span className="inline-flex items-center gap-1.5 text-navy-500">
                      <CalendarDays className="h-4 w-4" />
                      {post.date}
                    </span>
                    <Link
                      href={`/blog/${post.slug}`}
                      className="inline-flex items-center gap-1 font-medium text-[#B8892F] hover:text-[#8C6E28]"
                    >
                      Read More <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {pages > 1 ? (
          <nav aria-label="Pagination" className="mt-10 flex items-center justify-center gap-2">
            <PageLink href={blogHref(category, page - 1)} disabled={page <= 1} label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </PageLink>
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <Link
                key={n}
                href={blogHref(category, n)}
                aria-current={n === page ? "page" : undefined}
                className={`grid h-9 w-9 place-items-center rounded-md text-sm ${
                  n === page ? "bg-[#B8892F] font-semibold text-white" : "text-navy-800 hover:bg-[#FAF7F2]"
                }`}
              >
                {n}
              </Link>
            ))}
            <PageLink href={blogHref(category, page + 1)} disabled={page >= pages} label="Next page">
              <ChevronRight className="h-4 w-4" />
            </PageLink>
          </nav>
        ) : null}
      </section>
    </div>
  );
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const cls = "grid h-9 w-9 place-items-center rounded-md border border-[#e6dfd2] text-navy-800";
  return disabled ? (
    <span aria-hidden className={`${cls} opacity-40`}>
      {children}
    </span>
  ) : (
    <Link href={href} aria-label={label} className={`${cls} hover:border-[#C9A84C]`}>
      {children}
    </Link>
  );
}
