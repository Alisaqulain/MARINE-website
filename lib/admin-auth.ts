import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { accessForUser, isDashboardRole, type AccessFlags, type DashboardAction } from "@/lib/staff-access";

export async function requireAdminSession(action: DashboardAction = "view") {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || !isDashboardRole(role)) {
    return {
      session: null as null,
      perms: null as AccessFlags | null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const perms = accessForUser({
    email: session.user.email,
    role: session.user.role,
    permissions: session.user.role === "staff"
      ? {
          access: session.user.canAddProduct && session.user.canDelete ? "full" : "limited",
          canAddProduct: Boolean(session.user.canAddProduct),
          canDelete: Boolean(session.user.canDelete),
          restricted: false,
        }
      : null,
  });

  if (perms.restricted) {
    return {
      session: null as null,
      perms,
      error: NextResponse.json({ error: "This account is restricted." }, { status: 403 }),
    };
  }
  if (action === "addProduct" && !perms.canAddProduct) {
    return {
      session: null as null,
      perms,
      error: NextResponse.json({ error: "You cannot add or edit products." }, { status: 403 }),
    };
  }
  if (action === "delete" && !perms.canDelete) {
    return {
      session: null as null,
      perms,
      error: NextResponse.json({ error: "You cannot delete records." }, { status: 403 }),
    };
  }
  if (action === "team" && !perms.manageTeam) {
    return {
      session: null as null,
      perms,
      error: NextResponse.json({ error: "Only the main admin can manage team accounts." }, { status: 403 }),
    };
  }

  return { session, perms, error: null as null };
}
