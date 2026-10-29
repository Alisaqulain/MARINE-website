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
