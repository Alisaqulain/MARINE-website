import { adminEmailsList } from "@/lib/roles";

export type StaffAccess = "full" | "limited";

export type StaffPermissions = {
  access: StaffAccess;
  canAddProduct: boolean;
  canDelete: boolean;
  restricted: boolean;
};

export type DashboardAction = "view" | "addProduct" | "delete" | "team";

export type AccessFlags = {
  role: "customer" | "wholesale" | "admin" | "staff";
  canAddProduct: boolean;
  canDelete: boolean;
  manageTeam: boolean;
  restricted: boolean;
};

export function isSuperAdminEmail(email?: string | null) {
  if (!email) return false;
  return adminEmailsList().includes(email.toLowerCase());
}

export function isDashboardRole(role?: string | null) {
  return role === "admin" || role === "staff";
}

export function accessForUser(user: {
  email?: string | null;
  role?: string | null;
  restricted?: boolean | null;
  permissions?: StaffPermissions | null;
}): AccessFlags {
  if (isSuperAdminEmail(user.email)) {
    return {
      role: "admin",
      canAddProduct: true,
      canDelete: true,
      manageTeam: true,
      restricted: false,
    };
  }

  if (user.role === "staff") {
    const restricted = Boolean(user.restricted || user.permissions?.restricted);
    if (restricted) {
      return {
        role: "customer",
        canAddProduct: false,
        canDelete: false,
        manageTeam: false,
        restricted: true,
      };
    }
    if (user.permissions?.access === "full") {
      return {
        role: "staff",
        canAddProduct: true,
        canDelete: true,
        manageTeam: false,
        restricted: false,
      };
    }
    return {
      role: "staff",
      canAddProduct: Boolean(user.permissions?.canAddProduct),
      canDelete: Boolean(user.permissions?.canDelete),
      manageTeam: false,
      restricted: false,
    };
  }

  if (user.role === "wholesale") {
    return {
      role: "wholesale",
      canAddProduct: false,
      canDelete: false,
      manageTeam: false,
      restricted: Boolean(user.restricted),
    };
  }

  if (user.role === "admin") {
    return {
      role: "admin",
      canAddProduct: true,
      canDelete: true,
      manageTeam: true,
      restricted: false,
    };
  }

  return {
    role: "customer",
    canAddProduct: false,
    canDelete: false,
    manageTeam: false,
    restricted: Boolean(user.restricted),
  };
}

export function normalizeStaffPermissions(input: {
  access?: unknown;
  canAddProduct?: unknown;
  canDelete?: unknown;
  restricted?: unknown;
}): StaffPermissions {
  const access: StaffAccess = input.access === "limited" ? "limited" : "full";
  if (access === "full") {
    return {
      access: "full",
      canAddProduct: true,
      canDelete: true,
      restricted: Boolean(input.restricted),
    };
  }
  return {
    access: "limited",
    canAddProduct: Boolean(input.canAddProduct),
    canDelete: Boolean(input.canDelete),
    restricted: Boolean(input.restricted),
  };
}
