"use client";

import { ProductImage } from "@/components/ProductImage";
import { imageAdjustStyle, lowStockMessage } from "@/lib/product-display";
import { ChevronDown, Settings, Star } from "lucide-react";
import { useState } from "react";

type Row = Record<string, unknown>;

function money(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return `US$${n.toFixed(2)}`;
}

function renewLabel(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function AdminProductList({
  products,
  canDelete,
  canEdit,
  selected,
  onToggle,
  onToggleAll,
  onEdit,
  onDelete,
  onDeleteSelected,
  onChanged,
  onRunSale,
}: {
  products: Row[];
  canDelete: boolean;
  canEdit: boolean;
  selected: string[];
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onEdit: (product: Row) => void;
  onDelete: (product: Row) => void;
  onDeleteSelected: (ids: string[]) => void;
  onChanged: () => void;
  onRunSale: () => void;
}) {
  const [menu, setMenu] = useState<"select" | "edit" | string | null>(null);
  const [busy, setBusy] = useState(false);
  const ids = products.map((product) => String(product.id));
  const allSelected = ids.length > 0 && ids.every((id) => selected.includes(id));

  async function run(action: "renew" | "deactivate" | "activate" | "feature" | "unfeature", targetIds: string[]) {
    const mongoIds = targetIds.filter((id) => !id.startsWith("catalog-"));
    if (!mongoIds.length) {
      window.alert("Select saved listings. Catalogue items need to be edited and saved before renew, deactivate, or feature.");
      return;
    }
    setBusy(true);
    setMenu(null);
    try {
      const res = await fetch("/api/admin/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids: mongoIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        window.alert(typeof data.error === "string" ? data.error : "Could not update those listings.");
        return;
      }
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b bg-[#faf8f4] px-4 py-3">
        <div className="relative">
          <div className="flex overflow-hidden rounded-full border border-[#ddd] bg-white">
            <button type="button" className="grid h-9 w-9 place-items-center" onClick={onToggleAll} aria-label="Select all listings">
              <input readOnly type="checkbox" checked={allSelected} className="h-4 w-4 pointer-events-none" />
            </button>
            <button type="button" className="grid h-9 w-7 place-items-center border-l border-[#eee]" onClick={() => setMenu(menu === "select" ? null : "select")} aria-label="Selection options">
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
          {menu === "select" ? (
            <div className="absolute left-0 z-20 mt-1 w-36 rounded-xl border bg-white py-1 text-sm shadow-lg">
              <button type="button" className="block w-full px-3 py-2 text-left hover:bg-[#faf8f4]" onClick={() => { onToggleAll(); setMenu(null); }}>
                {allSelected ? "Clear page" : "Select page"}
              </button>
            </div>
          ) : null}
        </div>
        <button type="button" disabled={busy || !canEdit} className="rounded-full border border-[#ddd] bg-white px-4 py-2 text-sm disabled:opacity-40" onClick={() => void run("renew", selected)}>
          Renew
        </button>
        <button type="button" disabled={busy || !canEdit} className="rounded-full border border-[#ddd] bg-white px-4 py-2 text-sm disabled:opacity-40" onClick={() => void run("deactivate", selected)}>
          Deactivate
        </button>
        {canDelete ? (
          <button
            type="button"
            className="rounded-full border border-[#ddd] bg-white px-4 py-2 text-sm"
            onClick={() => {
              if (!selected.length) {
                window.alert("Select listings to delete.");
                return;
              }
              onDeleteSelected(selected);
            }}
          >
            Delete
          </button>
        ) : null}
        <div className="relative">
          <button type="button" className="inline-flex items-center gap-1 rounded-full border border-[#ddd] bg-white px-4 py-2 text-sm" onClick={() => setMenu(menu === "edit" ? null : "edit")}>
            Editing options <ChevronDown className="h-4 w-4" />
          </button>
          {menu === "edit" ? (
            <div className="absolute left-0 z-20 mt-1 w-44 rounded-xl border bg-white py-1 text-sm shadow-lg">
              <button
                type="button"
                className="block w-full px-3 py-2 text-left hover:bg-[#faf8f4]"
                onClick={() => {
                  const chosen = products.find((product) => selected.includes(String(product.id)));
                  setMenu(null);
                  if (!chosen || !canEdit) {
                    window.alert("Select one listing to edit.");
                    return;
                  }
                  onEdit(chosen);
                }}
              >
                Edit listing
              </button>
              <button type="button" className="block w-full px-3 py-2 text-left hover:bg-[#faf8f4]" onClick={() => { setMenu(null); onRunSale(); }}>
                Run a sale
              </button>
            </div>
          ) : null}
        </div>
      </div>
      {products.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-navy-600">No products loaded. Check MongoDB connection on /test</p>
      ) : (
        <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-4">
          {products.map((product) => {
            const id = String(product.id);
            const qty = product.quantity == null || product.quantity === "" ? undefined : Number(product.quantity);
            const stockNote = lowStockMessage(Number.isNaN(Number(qty)) ? undefined : qty);
            const prices = [
              money(product.priceIndia) ? `${money(product.priceIndia)} India` : null,
              money(product.priceUs) ? `${money(product.priceUs)} United States` : null,
              money(product.price) ? `${money(product.price)} Everywhere else` : null,
            ].filter(Boolean);
            const renews = renewLabel(product.renewsAt);
            const featured = product.featured === true;
            return (
              <article key={id} className={`overflow-hidden rounded-xl border border-[#eee] bg-white ${product.active === false ? "opacity-60" : ""}`}>
                <div className="relative aspect-[4/3] bg-[#f6f3ec]">
                  {product.image ? (
                    <ProductImage
                      src={String(product.image)}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="280px"
                      style={imageAdjustStyle(product.imageAdjust as { zoom: number; brightness: number; contrast: number } | undefined)}
                    />
                  ) : null}
                </div>
                <div className="space-y-1 px-3 py-3 text-sm">
                  <p className="truncate font-semibold text-[#222]">{String(product.name)}</p>
                  <p className="truncate text-xs text-navy-600">{String(product.description || product.sku || "")}</p>
                  <p className="text-xs text-navy-800">
                    {qty != null && !Number.isNaN(qty) ? `${qty} in stock` : "Quantity not set"}
                    {stockNote ? ` · ${stockNote}` : ""}
                    {product.active === false ? " · Deactivated" : ""}
                  </p>
                  {product.b2cOutOfStock === true ? (
                    <p className="text-xs font-semibold text-red-700">B2C: Out of stock</p>
                  ) : null}
                  {product.b2bOutOfScope === true ? (
                    <p className="text-xs font-semibold text-amber-800">B2B: Out of scope</p>
                  ) : null}
                  {prices.map((line) => (
                    <p key={line} className="truncate text-xs text-navy-700">{line}</p>
                  ))}
                  {renews ? <p className="text-xs text-navy-500">Auto-renews {renews}</p> : null}
                </div>
                <div className="flex items-center gap-3 border-t border-[#f0ebe3] px-3 py-2 text-navy-500">
                  <input type="checkbox" className="h-4 w-4" checked={selected.includes(id)} onChange={() => onToggle(id)} aria-label={`Select ${String(product.name)}`} />
                  <button
                    type="button"
                    aria-label={featured ? "Unfeature listing" : "Feature listing"}
                    disabled={!canEdit || busy}
                    onClick={() => void run(featured ? "unfeature" : "feature", [id])}
                    className="disabled:opacity-40"
                  >
                    <Star className={`h-4 w-4 ${featured ? "fill-[#C9A84C] text-[#C9A84C]" : ""}`} />
                  </button>
                  <div className="relative ml-auto">
                    <button type="button" aria-label="Listing actions" className="grid h-8 w-8 place-items-center rounded-full hover:bg-[#faf8f4]" onClick={() => setMenu(menu === id ? null : id)}>
                      <Settings className="h-4 w-4" />
                    </button>
                    {menu === id ? (
                      <div className="absolute right-0 z-20 mt-1 w-36 rounded-xl border bg-white py-1 text-sm text-navy-900 shadow-lg">
                        {canEdit ? (
                          <button type="button" className="block w-full px-3 py-2 text-left hover:bg-[#faf8f4]" onClick={() => { setMenu(null); onEdit(product); }}>
                            Edit
                          </button>
                        ) : null}
                        {canEdit ? (
                          <button type="button" className="block w-full px-3 py-2 text-left hover:bg-[#faf8f4]" onClick={() => void run("renew", [id])}>
                            Renew
                          </button>
                        ) : null}
                        {canEdit ? (
                          <button type="button" className="block w-full px-3 py-2 text-left hover:bg-[#faf8f4]" onClick={() => void run(product.active === false ? "activate" : "deactivate", [id])}>
                            {product.active === false ? "Activate" : "Deactivate"}
                          </button>
                        ) : null}
                        {canDelete ? (
                          <button type="button" className="block w-full px-3 py-2 text-left text-red-700 hover:bg-[#faf8f4]" onClick={() => { setMenu(null); onDelete(product); }}>
                            Delete
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
