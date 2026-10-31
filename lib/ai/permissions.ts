export type AiAction =
  | "read_catalog"
  | "recommend_product"
  | "answer_policy"
  | "guide_checkout"
  | "capture_enquiry"
  | "notify_owner"
  | "discount"
  | "payment_terms"
  | "custom_commitment"
  | "outbound_call"
  | "publish_content"
  | "change_ad_budget";

export type PermissionClass = "read" | "customer_message" | "reversible" | "restricted";

const MATRIX: Record<AiAction, PermissionClass> = {
  read_catalog: "read",
  recommend_product: "read",
  answer_policy: "read",
  guide_checkout: "customer_message",
  capture_enquiry: "reversible",
  notify_owner: "reversible",
  discount: "restricted",
  payment_terms: "restricted",
  custom_commitment: "restricted",
  outbound_call: "restricted",
  publish_content: "restricted",
  change_ad_budget: "restricted",
};

export function permissionClass(action: AiAction): PermissionClass {
  return MATRIX[action];
}

export function requiresOwnerApproval(action: AiAction): boolean {
  return MATRIX[action] === "restricted";
}

export function approvalStillValid(input: {
  status: "pending" | "approved" | "rejected" | "expired";
  action: AiAction;
  termsHash: string;
  requestedHash: string;
  expiresAt?: string;
  now?: number;
}): boolean {
  if (input.status !== "approved") return false;
  if (input.termsHash !== input.requestedHash) return false;
  if (input.expiresAt && Date.parse(input.expiresAt) <= (input.now ?? Date.now())) return false;
  return requiresOwnerApproval(input.action);
}

export type SessionApproval = {
  status: "pending" | "approved" | "rejected" | "expired";
  action: AiAction;
  termsHash: string;
  /** Owner's message to the customer, entered when deciding. */
  reason?: string;
  createdAt: string;
  decidedAt?: string;
};

export const APPROVAL_TTL_HOURS = 72;

/**
 * What the AI may say about a restricted request on this session. Only the latest request counts,
 * and an approval is released only while it is still valid for the exact terms the owner saw.
 * Returns null when there is no request yet (the caller then opens one).
 */
export function approvalReply(approvals: SessionApproval[], now = Date.now()): { text: string; released: boolean } | null {
  const latest = [...approvals].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!latest) return null;
  if (latest.status === "pending") {
    return {
      text: "Your request is with our team for approval. I'll keep helping you meanwhile, and I'll share the decision here as soon as it is made.",
      released: false,
    };
  }
  if (latest.status === "approved") {
    const expiresAt = latest.decidedAt
      ? new Date(Date.parse(latest.decidedAt) + APPROVAL_TTL_HOURS * 3_600_000).toISOString()
      : undefined;
    const valid = approvalStillValid({
      status: latest.status,
      action: latest.action,
      termsHash: latest.termsHash,
      requestedHash: latest.termsHash,
      expiresAt,
      now,
    });
    if (valid) {
      return {
        text: `Good news — our team approved your request.${latest.reason ? ` ${latest.reason}` : ""}`,
        released: true,
      };
    }
    return null;
  }
  if (latest.status === "rejected") {
    return {
      text: "Our team reviewed your request and could not approve it, so the listed catalogue price applies. I'm happy to help with anything else.",
      released: false,
    };
  }
  return null;
}
