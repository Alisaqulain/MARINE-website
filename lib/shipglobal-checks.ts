/** Checks a ShipGlobal label payload before any booking request is sent. */

export type ShipGlobalItemDraft = {
  name: string;
  sku: string;
  qty: number;
  unitPrice: number;
  hsn: string;
};

export type ShipGlobalDraft = {
  customerName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postal: string;
  countryCode: string;
  weightGrams: number;
  service: string;
  items: ShipGlobalItemDraft[];
  sellerPhone: string;
  sellerEmail: string;
  sellerAddress: string;
  sellerCity: string;
  sellerState: string;
  sellerPostal: string;
  sellerCountryCode: string;
};

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function emailOk(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function shipGlobalDraftErrors(draft: ShipGlobalDraft): string[] {
  const errors: string[] = [];
  const service = draft.service.trim().toUpperCase();

  if (!draft.customerName.trim()) errors.push("Customer name is required.");
  if (!emailOk(draft.email)) errors.push("A valid customer email is required.");
  if (digits(draft.phone).length < 8) errors.push("Customer phone must include at least 8 digits.");
  if (draft.address.trim().length < 3) errors.push("Customer street address is required.");
  if (!draft.city.trim()) errors.push("Customer city is required.");
  if (!draft.state.trim()) errors.push("Customer state is required.");
  if (!draft.postal.trim()) errors.push("Customer postal code is required.");
  if (!/^[A-Z]{2}$/.test(draft.countryCode.trim().toUpperCase())) {
    errors.push("Customer country must be a 2-letter code.");
  }

  if (!emailOk(draft.sellerEmail)) errors.push("Seller email is required.");
  if (digits(draft.sellerPhone).length < 8) errors.push("Seller phone must include at least 8 digits.");
  if (draft.sellerAddress.trim().length < 3) errors.push("Seller street address is required.");
  if (!draft.sellerCity.trim()) errors.push("Seller city is required.");
  if (!draft.sellerState.trim()) errors.push("Seller state is required.");
  if (!draft.sellerPostal.trim()) errors.push("Seller postal code is required.");
  if (!/^[A-Z]{2}$/.test(draft.sellerCountryCode.trim().toUpperCase())) {
    errors.push("Seller country must be a 2-letter code.");
  }

  if (!Number.isFinite(draft.weightGrams) || draft.weightGrams <= 0) {
    errors.push("Package weight must be greater than 0 grams.");
  }
  if (!draft.items.length) errors.push("At least one item is required for customs.");

  for (const item of draft.items) {
    if (!item.name.trim()) errors.push("Each customs item needs a name.");
    if (!item.sku.trim()) errors.push("Each customs item needs a SKU.");
    if (!Number.isInteger(item.qty) || item.qty < 1) errors.push("Each customs item quantity must be at least 1.");
    if (!Number.isFinite(item.unitPrice) || item.unitPrice <= 0) {
      errors.push("Each customs item needs a declared value greater than 0 USD.");
    }
    if (!/^\d{6,8}$/.test(item.hsn.trim())) errors.push("Each customs item needs a 6 to 8 digit HSN code.");
  }

  if ((service === "USPS" || service === "UPS") && draft.countryCode.trim().toUpperCase() !== "US") {
    errors.push(`${service} can only be booked to the United States.`);
  }
  if (service === "USPS" && draft.weightGrams > 5000) errors.push("USPS accepts packages up to 5000 grams.");
  if (service === "UPS" && draft.weightGrams <= 5000) errors.push("UPS is only allowed above 5000 grams.");

  return errors;
}
