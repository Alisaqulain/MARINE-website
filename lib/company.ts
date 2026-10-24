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
  whatsapp: "917457099540",
  instagram: "https://www.instagram.com/marinamusestore1/",
} as const;

export const companyMailto = `mailto:${company.email}`;
export const companyTel = `tel:${company.phoneTel}`;
export const companyWhatsApp = `https://wa.me/${company.whatsapp}`;

export const companyAddress = company.address.join(", ");
export const companyMapSrc = `https://maps.google.com/maps?q=${company.mapLat},${company.mapLng}&ll=${company.mapLat},${company.mapLng}&z=17&hl=en&output=embed&iwloc=`;
export const companyDirections = `https://www.google.com/maps/dir/?api=1&destination=${company.mapLat},${company.mapLng}`;
