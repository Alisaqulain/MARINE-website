"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { BulkActions, deleteUrls, useRowSelection } from "@/components/AdminSelection";

type StaffRow = {
  id: string;
  name: string;
  email: string;
  access: "full" | "limited";
  canAddProduct: boolean;
  canDelete: boolean;
  restricted: boolean;
  createdAt: string;
};

export function AdminTeamPanel() {
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [access, setAccess] = useState<"full" | "limited">("limited");
  const [canAddProduct, setCanAddProduct] = useState(true);
  const [canDelete, setCanDelete] = useState(false);
  const selection = useRowSelection(rows.map((row) => row.id));

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/staff");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not load team accounts.");
      return;
    }
    setError("");
    setRows(data.items ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createAccount(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
        access,
        canAddProduct: access === "full" ? true : canAddProduct,
        canDelete: access === "full" ? true : canDelete,
        restricted: false,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Could not create the account.");
      return;
    }
    e.currentTarget.reset();
    setAccess("limited");
    setCanAddProduct(true);
    setCanDelete(false);
    setNotice("Subadmin account created. They sign in on the admin login page.");
    void load();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    setError("");
    const res = await fetch(`/api/admin/staff/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.error === "string" ? data.error : "Update failed.");
      return;
    }
    void load();
  }

  async function removeSelected(ids: string[]) {
    if (!ids.length) return;
    if (!window.confirm(`Delete ${ids.length} team account${ids.length === 1 ? "" : "s"}?`)) return;
    const failed = await deleteUrls(ids.map((id) => `/api/admin/staff/${id}`));
    if (failed) setError(`${failed} account${failed === 1 ? "" : "s"} could not be deleted.`);
    selection.clear();
    void load();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <div className="border-b bg-[#FAF7F2] px-4 py-3 text-xs text-navy-600">
          Subadmin accounts that can list products. Full access can add and delete. Limited access only does what you allow.
        </div>
        <BulkActions
          allSelected={selection.allSelected}
          selectedCount={selection.selected.length}
          onToggleAll={selection.toggleAll}
          onDeleteSelected={() => void removeSelected(selection.selected)}
          onDeleteAll={() => void removeSelected(rows.map((row) => row.id))}
          deleteAllLabel="Delete all"
        />
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-[#FAF7F2] text-xs uppercase tracking-wide text-navy-600">
            <tr>
              <th className="px-4 py-3"> </th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Access</th>
              <th className="px-4 py-3">Add product</th>
              <th className="px-4 py-3">Delete</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-navy-600">
                  No subadmin accounts yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-[#f0ebe3]">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selection.selected.includes(row.id)}
                      onChange={() => selection.toggle(row.id)}
                      aria-label={`Select ${row.email}`}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="max-w-[180px] truncate px-4 py-3">{row.email}</td>
                  <td className="px-4 py-3 capitalize">{row.access}</td>
                  <td className="px-4 py-3">{row.canAddProduct ? "Yes" : "No"}</td>
                  <td className="px-4 py-3">{row.canDelete ? "Yes" : "No"}</td>
                  <td className="px-4 py-3">{row.restricted ? "Restricted" : "Active"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="text-xs font-semibold text-[#8C6E28] underline"
                        onClick={() =>
                          void patch(row.id, {
                            access: row.access === "full" ? "limited" : "full",
                            canAddProduct: row.access === "full" ? row.canAddProduct : true,
                            canDelete: row.access === "full" ? row.canDelete : true,
                          })
                        }
                      >
                        {row.access === "full" ? "Make limited" : "Make full"}
                      </button>
                      {row.access === "limited" ? (
                        <>
                          <button
                            type="button"
                            className="text-xs font-semibold text-navy-800 underline"
                            onClick={() => void patch(row.id, { canAddProduct: !row.canAddProduct })}
                          >
                            {row.canAddProduct ? "Block add" : "Allow add"}
                          </button>
                          <button
                            type="button"
                            className="text-xs font-semibold text-navy-800 underline"
                            onClick={() => void patch(row.id, { canDelete: !row.canDelete })}
                          >
                            {row.canDelete ? "Block delete" : "Allow delete"}
                          </button>
                        </>
                      ) : null}
                      <button
                        type="button"
                        className="text-xs font-semibold text-amber-800 underline"
                        onClick={() => void patch(row.id, { restricted: !row.restricted })}
                      >
                        {row.restricted ? "Unrestrict" : "Restrict"}
                      </button>
                      <button
                        type="button"
                        className="text-xs font-semibold text-red-700 underline"
                        onClick={() => void removeSelected([row.id])}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <form onSubmit={createAccount} className="space-y-3 rounded-xl bg-white p-5 shadow-sm">
        <h2 className="font-serif text-lg">Create subadmin</h2>
        <p className="text-xs text-navy-600">
          They sign in at the admin login with this email and password. Full access can add and delete. Limited access follows the switches below.
        </p>
        <input className="input" name="name" placeholder="Name" required />
        <input className="input" name="email" type="email" placeholder="Email" required />
        <input className="input" name="password" type="password" placeholder="Password (8+ characters)" minLength={8} required />
        <label className="block text-xs text-navy-700">
          Access
          <select
            className="input mt-1"
            value={access}
            onChange={(e) => setAccess(e.target.value as "full" | "limited")}
          >
            <option value="full">Full access</option>
            <option value="limited">Limited access</option>
          </select>
        </label>
        {access === "limited" ? (
          <div className="space-y-2 text-sm text-navy-800">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={canAddProduct} onChange={(e) => setCanAddProduct(e.target.checked)} />
              Can add products
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={canDelete} onChange={(e) => setCanDelete(e.target.checked)} />
              Can delete
            </label>
          </div>
        ) : (
          <p className="text-xs text-navy-600">Full access can add products, edit them, and delete records. They cannot create other admins.</p>
        )}
        {notice ? <p className="text-xs text-emerald-800">{notice}</p> : null}
        {error ? <p className="text-xs text-red-700">{error}</p> : null}
        <button type="submit" className="btn-gold w-full" disabled={saving}>
          {saving ? "Saving…" : "Create account"}
        </button>
      </form>
    </div>
  );
}
