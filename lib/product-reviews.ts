import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

/** A customer's star rating and review for one product. */
export type ProductReview = {
  id: string;
  productSlug: string;
  productName: string;
  rating: number;
  body: string;
  name: string;
  email?: string;
  published: boolean;
  /** Ticked in admin to feature the review in "What Our Customers Say" on the home page. */
  showOnHome: boolean;
  createdAt: string;
};

type ReviewDoc = Omit<ProductReview, "id" | "createdAt"> & {
  _id?: ObjectId;
  userId?: string;
  createdAt: Date;
};

const COLLECTION = "product_reviews";

function toReview(doc: ReviewDoc, withEmail = false): ProductReview {
  return {
    id: String(doc._id),
    productSlug: doc.productSlug,
    productName: doc.productName,
    rating: doc.rating,
    body: doc.body,
    name: doc.name,
    email: withEmail ? doc.email : undefined,
    published: doc.published !== false,
    showOnHome: doc.showOnHome === true,
    createdAt: new Date(doc.createdAt).toISOString(),
  };
}

export async function listProductReviews(slug: string) {
  const db = await getDb();
  const docs = await db
    .collection<ReviewDoc>(COLLECTION)
    .find({ productSlug: slug, published: { $ne: false } })
    .sort({ createdAt: -1 })
    .limit(200)
    .toArray();
  const items = docs.map((doc) => toReview(doc));
  const average = items.length ? items.reduce((sum, r) => sum + r.rating, 0) / items.length : 0;
  return { items, count: items.length, average: Number(average.toFixed(1)) };
}

export async function addProductReview(input: {
  productSlug: string;
  productName: string;
  rating: number;
  body: string;
  name: string;
  email?: string;
  userId?: string;
}) {
  const db = await getDb();
  const doc: ReviewDoc = { ...input, published: true, showOnHome: false, createdAt: new Date() };
  const result = await db.collection<ReviewDoc>(COLLECTION).insertOne(doc);
  return toReview({ ...doc, _id: result.insertedId });
}

export async function listAllProductReviews() {
  const db = await getDb();
  const docs = await db.collection<ReviewDoc>(COLLECTION).find({}).sort({ createdAt: -1 }).limit(1000).toArray();
  return docs.map((doc) => toReview(doc, true));
}

export async function updateProductReview(id: string, flags: { published?: boolean; showOnHome?: boolean }) {
  if (!ObjectId.isValid(id)) return false;
  const db = await getDb();
  const result = await db.collection<ReviewDoc>(COLLECTION).updateOne({ _id: new ObjectId(id) }, { $set: flags });
  return result.matchedCount > 0;
}

/** Published reviews the admin ticked for the home page, newest first. */
export async function listHomeProductReviews(limit = 12) {
  const db = await getDb();
  const docs = await db
    .collection<ReviewDoc>(COLLECTION)
    .find({ showOnHome: true, published: { $ne: false } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map((doc) => toReview(doc));
}

export async function deleteProductReview(id: string) {
  if (!ObjectId.isValid(id)) return false;
  const db = await getDb();
  const result = await db.collection<ReviewDoc>(COLLECTION).deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount > 0;
}
