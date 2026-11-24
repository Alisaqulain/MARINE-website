export const company = {
  name: "Marina Muse International",
  role: "Exporter, Manufacturer & Supplier",
  address: [
    "Ground Floor, Building / Flat No. 85, Bajheri",
    "Bagowali Road, Near Bajheri, Muzaffarnagar",
    "Muzaffarnagar, Uttar Pradesh 251311, India",
  ],
  city: "Muzaffarnagar",
  district: "Muzaffarnagar",
  state: "Uttar Pradesh",
  pin: "251311",
  country: "India",
  mapLat: 29.5463,
  mapLng: 77.5948,
  email: "info@marinamuseinternational.com",
  phone: "+91 74570 99540",
  phoneTel: "+917457099540",
  whatsapp: "919068349540",
  instagram: "https://www.instagram.com/marinamuseinternational/",
  etsy: "https://marinamusestore.etsy.com",
  /** Address shown to visitors (footer, Contact page, map). The ShipGlobal pickup address above is separate. */
  displayAddress: "Roorkee-247667, Uttarakhand, India",
  youtube: "https://www.youtube.com/@MuhammadMuaaz-k2n",
  facebook: "https://www.facebook.com/profile.php?id=61584041445930",
} as const;

export const companyMailto = `mailto:${company.email}`;
export const companyTel = `tel:${company.phoneTel}`;
export const companyWhatsApp = `https://wa.me/${company.whatsapp}`;

/** Click-to-chat link that opens WhatsApp with the message already typed (no WhatsApp API needed). */
export function whatsAppChat(message: string) {
  return `${companyWhatsApp}?text=${encodeURIComponent(message)}`;
}

export const companyAddress = company.address.join(", ");
const mapQuery = encodeURIComponent(company.displayAddress);
export const companyMapSrc = `https://maps.google.com/maps?q=${mapQuery}&z=13&hl=en&output=embed&iwloc=`;
export const companyDirections = `https://www.google.com/maps/dir/?api=1&destination=${mapQuery}`;
