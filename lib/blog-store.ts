import { ObjectId } from "mongodb";
import { blogPosts, defaultBlogCategories, type BlogCategory, type BlogPost } from "@/lib/blog";
import { getDb } from "@/lib/mongodb";
import { slugify } from "@/lib/slugify";
import { isHtml, sanitizeArticleHtml } from "@/lib/blog-html";

export type BlogDoc = BlogPost & {
  _id?: ObjectId;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminBlogPost = BlogPost & { id: string; published: boolean };

type BlogCategoryDoc = { _id?: ObjectId; name: string; slug: string; createdAt: Date };

const COLLECTION = "blog_posts";
const CATEGORY_COLLECTION = "blog_categories";

/** Copy the built-in posts into Mongo once so admins can edit or remove them. */
async function ensureSeeded() {
  const db = await getDb();
  const col = db.collection<BlogDoc>(COLLECTION);
  if ((await col.estimatedDocumentCount()) > 0) return col;
  const now = new Date();
  await col
    .insertMany(
      blogPosts.map((post, i) => ({
        ...post,
        published: true,
        // Keep the original order: newest first.
        createdAt: new Date(now.getTime() - i * 1000),
        updatedAt: now,
      }))
    )
    .catch(() => {});
  return col;
}

async function ensureCategoriesSeeded() {
  const db = await getDb();
  const col = db.collection<BlogCategoryDoc>(CATEGORY_COLLECTION);
  if ((await col.estimatedDocumentCount()) > 0) return col;
  const now = new Date();
  await col
    .insertMany(defaultBlogCategories.map((c, i) => ({ ...c, createdAt: new Date(now.getTime() + i) })))
    .catch(() => {});
  return col;
}

function toAdmin(doc: BlogDoc): AdminBlogPost {
  return {
    id: String(doc._id),
    slug: doc.slug,
    title: doc.title,
    excerpt: doc.excerpt,
    date: doc.date,
    image: doc.image,
    body: doc.body ?? [],
    category: doc.category || undefined,
    link: doc.link || undefined,
    linkNewTab: doc.linkNewTab === true,
    published: doc.published !== false,
  };
}

/** Published posts for the storefront; falls back to the built-in posts if Mongo is unreachable. */
export async function listPublishedPosts(): Promise<BlogPost[]> {
  try {
    const col = await ensureSeeded();
    const docs = await col.find({ published: { $ne: false } }).sort({ createdAt: -1 }).toArray();
    return docs.map(toAdmin);
  } catch {
    return blogPosts;
  }
}

export async function findPublishedPost(slug: string): Promise<BlogPost | null> {
  try {
    const col = await ensureSeeded();
    const doc = await col.findOne({ slug, published: { $ne: false } });
    return doc ? toAdmin(doc) : null;
  } catch {
    return blogPosts.find((p) => p.slug === slug) ?? null;
  }
}

export async function listAllPosts(): Promise<AdminBlogPost[]> {
  const col = await ensureSeeded();
  const docs = await col.find({}).sort({ createdAt: -1 }).toArray();
  return docs.map(toAdmin);
}

export async function listBlogCategories(): Promise<BlogCategory[]> {
  try {
    const col = await ensureCategoriesSeeded();
    const docs = await col.find({}).sort({ createdAt: 1 }).toArray();
    return docs.map((d) => ({ id: String(d._id), name: d.name, slug: d.slug }));
  } catch {
    return defaultBlogCategories.map((c) => ({ id: c.slug, ...c }));
  }
}

export async function blogCategoryCollection() {
  return ensureCategoriesSeeded();
}

export function readBlogInput(body: Record<string, unknown>) {
  const title = String(body.title ?? "").trim();
  const bodyText = Array.isArray(body.body) ? body.body.map(String).join("\n\n") : String(body.body ?? "");
  const link = String(body.link ?? "").trim();
  return {
    title,
    slug: slugify(String(body.slug ?? "").trim() || title),
    excerpt: String(body.excerpt ?? "").trim().slice(0, 160),
    date:
      String(body.date ?? "").trim() ||
      new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
    image: String(body.image ?? "").trim() || "/blog-slide.jpeg",
    category: slugify(String(body.category ?? "")),
    link,
    linkNewTab: link ? body.linkNewTab === true : false,
    // The visual editor sends HTML (stored cleaned, as one block); older text posts split on blank lines.
    body: isHtml(bodyText)
      ? [sanitizeArticleHtml(bodyText)].filter((html) => html.replace(/<[^>]+>|&nbsp;|\s/g, "") || /<(img|div data-product)/.test(html))
      : bodyText
          .split(/\n\s*\n/)
          .map((p) => p.trim())
          .filter(Boolean),
    published: body.published !== false,
  };
}

export async function blogCollection() {
  return ensureSeeded();
}
