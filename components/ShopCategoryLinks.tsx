"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { WholesaleNavLink } from "@/components/WholesaleNavLink";

export function ShopCategoryLinks() {
  const [categories, setCategories] = useState<{ slug: string; name: string }[]>([]);

  useEffect(() => {
    void fetch("/api/categories")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.items)) setCategories(data.items);
      })
      .catch(() => {});
  }, []);

  if (!categories.length) return null;

  return (
    <div className="mx-auto mt-8 max-w-3xl text-center">
      <p className="text-xs uppercase tracking-[0.28em] text-[#8C6E28]">Categories</p>
      <ul className="mt-4 flex flex-wrap justify-center gap-2">
        {categories.map((category) => (
          <li key={category.slug} className="flex flex-wrap justify-center gap-2">
            <Link
              href={`/shop?category=${category.slug}`}
              className="rounded-full border border-[#e6dfd2] bg-white px-3 py-1.5 text-sm text-navy-800 hover:border-[#C9A84C]"
            >
              {category.name}
            </Link>
            <WholesaleNavLink
              callbackUrl={`/wholesale?category=${category.slug}`}
              className="rounded-full border border-[#e6dfd2] bg-white px-3 py-1.5 text-sm text-navy-800 hover:border-[#C9A84C]"
            >
              Wholesale · {category.name}
            </WholesaleNavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}
