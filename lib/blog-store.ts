import { ObjectId } from "mongodb";
import { blogPosts, type BlogPost } from "@/lib/blog";
import { getDb } from "@/lib/mongodb";
import { slugify } from "@/lib/slugify";

export type BlogDoc = BlogPost & {
  _id?: ObjectId;
  published: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminBlogPost = BlogPost & { id: string; published: boolean };

const COLLECTION = "blog_posts";

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

function toAdmin(doc: BlogDoc): AdminBlogPost {
  return {
    id: String(doc._id),
    slug: doc.slug,
    title: doc.title,
    excerpt: doc.excerpt,
    date: doc.date,
    image: doc.image,
    body: doc.body ?? [],
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

export function readBlogInput(body: Record<string, unknown>) {
  const title = String(body.title ?? "").trim();
  const bodyText = Array.isArray(body.body) ? body.body.map(String).join("\n\n") : String(body.body ?? "");
  return {
    title,
    slug: slugify(String(body.slug ?? "").trim() || title),
    excerpt: String(body.excerpt ?? "").trim(),
    date:
      String(body.date ?? "").trim() ||
      new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
    image: String(body.image ?? "").trim() || "/blog-slide.jpeg",
    // Blank lines separate paragraphs.
    body: bodyText
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean),
    published: body.published !== false,
  };
}

export async function blogCollection() {
  return ensureSeeded();
}
