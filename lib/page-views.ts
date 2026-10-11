import { getDb } from "@/lib/mongodb";

export type PageViewRecord = {
  _id?: string;
  path: string;
  at: string;
  userAgent?: string;
};

type GlobalViews = typeof globalThis & { __marinaPageViews?: PageViewRecord[] };

function memoryStore() {
  const g = globalThis as GlobalViews;
  if (!g.__marinaPageViews) g.__marinaPageViews = [];
  return g.__marinaPageViews;
}

export async function recordPageView(path: string, userAgent?: string) {
  const doc: PageViewRecord = {
    path: path.slice(0, 512),
    at: new Date().toISOString(),
    userAgent: userAgent?.slice(0, 512),
  };
  try {
    const db = await getDb();
    await db.collection("page_views").insertOne({
      path: doc.path,
      at: doc.at,
      userAgent: doc.userAgent,
    });
  } catch {
    const list = memoryStore();
    list.unshift(doc);
    if (list.length > 5000) list.length = 5000;
  }
}

export async function listPageViews(page: number, pageSize: number) {
  const skip = Math.max(0, (page - 1) * pageSize);
  try {
    const db = await getDb();
    const col = db.collection<PageViewRecord>("page_views");
    const [items, total] = await Promise.all([
      col.find({}).sort({ at: -1 }).skip(skip).limit(pageSize).toArray(),
      col.countDocuments(),
    ]);
    return {
      items: items.map(({ _id, ...rest }) => ({ id: String(_id), ...rest })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  } catch {
    const list = memoryStore();
    const total = list.length;
    const slice = list.slice(skip, skip + pageSize);
    return {
      items: slice.map((v, i) => ({ id: `${skip + i}`, ...v })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }
}
