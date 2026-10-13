import type { ObjectId } from "mongodb";

export type UserRole = "customer" | "wholesale" | "admin" | "staff";

export type StaffPermissions = {
  access: "full" | "limited";
  canAddProduct: boolean;
  canDelete: boolean;
  restricted: boolean;
};

export type DbUser = {
  _id?: ObjectId;
  email: string;
  name: string;
  passwordHash?: string;
  role: UserRole;
  googleId?: string;
  wholesaleProfileComplete?: boolean;
  /** Blocks storefront and admin sign-in. */
  restricted?: boolean;
  permissions?: StaffPermissions;
  createdAt: Date;
  updatedAt: Date;
};

export type WholesaleApplication = {
  _id?: ObjectId;
  userId: ObjectId;
  email: string;
  company: string;
  contact: string;
  phone: string;
  website?: string;
  businessType: string;
  taxId: string;
  productInterest: string;
  productInterestOther?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
};

export type BulkQuote = {
  _id?: ObjectId;
  userId: ObjectId;
  email: string;
  product: string;
  productOther?: string;
  quantity: number;
  logoEngraving?: string;
  packaging: string;
  destinationCountry: string;
  requiredDeliveryDate?: string;
  incoterm: string;
  status: "new" | "quoted" | "won" | "closed";
  createdAt: Date;
};

export type ContactMessage = {
  _id?: ObjectId;
  userId?: ObjectId;
  kind: "retail" | "wholesale";
  name: string;
  email: string;
  phone?: string;
  company?: string;
  subject: string;
  message: string;
  createdAt: Date;
};

export type ReturnRequest = {
  _id?: ObjectId;
  userId?: ObjectId;
  orderNumber: string;
  customerName: string;
  productName: string;
  reason: string;
  email: string;
  status: "new" | "approved" | "received" | "refunded" | "closed";
  createdAt: Date;
};

export type Testimonial = {
  _id?: ObjectId;
  title: string;
  body: string;
  name: string;
  location: string;
  product: string;
  published: boolean;
  /** When true, review appears on the home page carousel. */
  showOnHome: boolean;
  sortOrder: number;
  createdAt: Date;
};

export type AdminProduct = {
  _id?: ObjectId;
  slug: string;
  name: string;
  sku: string;
  price: number;
  compareAt?: number;
  wholesaleFrom?: number;
  quantity?: number;
  image: string;
  description: string;
  channel: "retail" | "wholesale" | "both";
  stock: "in-stock" | "low" | "made-to-order";
  active: boolean;
  /** Show “FREE shipping” badge on retail listings. Default true when unset. */
  freeShipping?: boolean;
  categories?: string[];
  imageAdjust?: { zoom: number; brightness: number; contrast: number };
  colors?: string[];
  materials?: string[];
  sizes?: string[];
  images?: { url: string; name: string; color: string; text: string; textX?: number; textY?: number }[];
  personalisationPrice?: number | null;
  listedBy?: { userId: string; name: string; email: string };
  createdAt: Date;
  updatedAt: Date;
};
