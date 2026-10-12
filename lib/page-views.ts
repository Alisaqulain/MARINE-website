import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";

export type PageViewRecord = {
  _id?: string;
  path: string;
  at: string;
  userAgent?: string;
  visitorId?: string;
};

export type WebsiteVisitor = {
  id: string;
  firstAt: string;
  lastAt: string;
  visits: number;
  pages: number;
  lastPath: string;
  device: string;
};

export type VisitorSummary = {
  totalVisitors: number;
  today: number;
  last7Days: number;
};

type GlobalViews = typeof globalThis & { __marinaPageViews?: PageViewRecord[] };

function memoryStore() {
  const g = globalThis as GlobalViews;
  if (!g.__marinaPageViews) g.__marinaPageViews = [];
  return g.__marinaPageViews;
}

function startIso(daysAgo: number) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

export function deviceLabel(ua?: string) {
  if (!ua) return "Unknown";
  const mobile = /Mobile|Android|iPhone|iPad/i.test(ua);
  let browser = "Browser";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua)) browser = "Safari";
  return `${browser} · ${mobile ? "Mobile" : "Desktop"}`;
}

function visitorKey(row: PageViewRecord) {
  return row.visitorId || row.userAgent || "unknown";
}

function summarize(rows: WebsiteVisitor[], flags: { today: boolean; week: boolean }[]) {
  const todayIso = startIso(0);
  const weekIso = startIso(6);
  let today = 0;
  let last7Days = 0;
  flags.forEach((flag, i) => {
    if (flag.today || rows[i].lastAt >= todayIso) today += 1;
    if (flag.week || rows[i].lastAt >= weekIso) last7Days += 1;
  });
  return { totalVisitors: rows.length, today, last7Days };
}

function groupRecords(list: PageViewRecord[]) {
  const todayIso = startIso(0);
  const weekIso = startIso(6);
  const map = new Map<string, WebsiteVisitor & { today: boolean; week: boolean }>();
  const sorted = [...list].sort((a, b) => a.at.localeCompare(b.at));
  for (const row of sorted) {
    const id = visitorKey(row);
    const seenToday = row.at >= todayIso;
    const seenWeek = row.at >= weekIso;
    const existing = map.get(id);
    if (!existing) {
      map.set(id, {
        id,
        firstAt: row.at,
        lastAt: row.at,
        visits: 1,
        pages: 1,
        lastPath: row.path,
        device: deviceLabel(row.userAgent),
        today: seenToday,
        week: seenWeek,
      });
      continue;
    }
    existing.lastAt = row.at;
    existing.visits += 1;
    existing.lastPath = row.path;
    existing.device = deviceLabel(row.userAgent);
    existing.today = existing.today || seenToday;
    existing.week = existing.week || seenWeek;
  }
  const pageSets = new Map<string, Set<string>>();
  for (const row of sorted) {
    const id = visitorKey(row);
    const set = pageSets.get(id) ?? new Set<string>();
    set.add(row.path);
    pageSets.set(id, set);
  }
  for (const [id, row] of map) {
    row.pages = pageSets.get(id)?.size ?? row.pages;
  }
  return [...map.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

export async function recordPageView(path: string, userAgent?: string, visitorId?: string) {
  const doc: PageViewRecord = {
    path: path.slice(0, 512),
    at: new Date().toISOString(),
    userAgent: userAgent?.slice(0, 512),
    visitorId: visitorId?.slice(0, 64),
  };
  try {
    const db = await getDb();
    await db.collection("page_views").insertOne({
      path: doc.path,
      at: doc.at,
      userAgent: doc.userAgent,
      visitorId: doc.visitorId,
    });
  } catch {
    const list = memoryStore();
    list.unshift(doc);
    if (list.length > 5000) list.length = 5000;
  }
}

export async function listWebsiteVisitors(page: number, pageSize: number) {
  const skip = Math.max(0, (page - 1) * pageSize);
  try {
    const db = await getDb();
    const todayIso = startIso(0);
    const weekIso = startIso(6);
    const visitorKeyExpr = {
      $cond: [
        { $gt: [{ $strLenCP: { $ifNull: ["$visitorId", ""] } }, 0] },
        "$visitorId",
        { $ifNull: ["$userAgent", "unknown"] },
      ],
    };
    const grouped = await db
      .collection("page_views")
      .aggregate<{
        _id: string;
        firstAt: string;
        lastAt: string;
        visits: number;
        lastPath: string;
        userAgent?: string;
        pages: string[];
        seenToday: number;
        seenWeek: number;
      }>([
        { $sort: { at: 1 } },
        {
          $group: {
            _id: visitorKeyExpr,
            firstAt: { $first: "$at" },
            lastAt: { $last: "$at" },
            visits: { $sum: 1 },
            lastPath: { $last: "$path" },
            userAgent: { $last: "$userAgent" },
            pages: { $addToSet: "$path" },
            seenToday: { $max: { $cond: [{ $gte: ["$at", todayIso] }, 1, 0] } },
            seenWeek: { $max: { $cond: [{ $gte: ["$at", weekIso] }, 1, 0] } },
          },
        },
        { $sort: { lastAt: -1 } },
      ])
      .toArray();

    const summary: VisitorSummary = {
      totalVisitors: grouped.length,
      today: grouped.reduce((n, row) => n + (row.seenToday ? 1 : 0), 0),
      last7Days: grouped.reduce((n, row) => n + (row.seenWeek ? 1 : 0), 0),
    };
    const slice = grouped.slice(skip, skip + pageSize);
    return {
      summary,
      items: slice.map((row) => ({
        id: String(row._id),
        firstAt: row.firstAt,
        lastAt: row.lastAt,
        visits: row.visits,
        pages: row.pages?.length ?? 0,
        lastPath: row.lastPath,
        device: deviceLabel(row.userAgent),
      })),
      pagination: {
        page,
        pageSize,
        total: summary.totalVisitors,
        totalPages: Math.max(1, Math.ceil(summary.totalVisitors / pageSize)),
      },
    };
  } catch {
    const grouped = groupRecords(memoryStore());
    const summary = summarize(
      grouped,
      grouped.map((row) => ({ today: row.today, week: row.week }))
    );
    const slice = grouped.slice(skip, skip + pageSize);
    return {
      summary,
      items: slice.map(({ today: _today, week: _week, ...row }) => row),
      pagination: {
        page,
        pageSize,
        total: summary.totalVisitors,
        totalPages: Math.max(1, Math.ceil(summary.totalVisitors / pageSize)),
      },
    };
  }
}

export async function deleteWebsiteVisitor(id: string) {
  try {
    const db = await getDb();
    const col = db.collection("page_views");
    if (/^[a-f0-9]{24}$/i.test(id)) {
      const result = await col.deleteOne({ _id: new ObjectId(id) });
      if (result.deletedCount > 0) return true;
    }
    const result = await col.deleteMany({ $or: [{ visitorId: id }, { userAgent: id }] });
    return result.deletedCount > 0;
  } catch {
    const list = memoryStore();
    const kept = list.filter((row) => visitorKey(row) !== id);
    if (kept.length === list.length) return false;
    list.length = 0;
    list.push(...kept);
    return true;
  }
}
