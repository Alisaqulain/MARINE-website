import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/mongodb";
import type { DbUser, UserRole } from "@/lib/db/types";
import { resolveRole } from "@/lib/roles";

export { resolveRole };

export async function findUserByEmail(email: string) {
  const db = await getDb();
  return db.collection<DbUser>("users").findOne({ email: email.toLowerCase() });
}

export async function findUserById(id: string) {
  const db = await getDb();
  if (!ObjectId.isValid(id)) return null;
  return db.collection<DbUser>("users").findOne({ _id: new ObjectId(id) });
}

export async function createUser(input: {
  email: string;
  name: string;
  password?: string;
  role?: UserRole;
  googleId?: string;
  emailVerified?: boolean;
  phone?: string;
  address?: string;
}) {
  const db = await getDb();
  const email = input.email.toLowerCase();
  const now = new Date();
  const role = resolveRole(email, input.role);
  const doc: DbUser = {
    email,
    name: input.name,
    role,
    googleId: input.googleId,
    emailVerified: input.googleId ? true : input.emailVerified,
    phone: input.phone?.trim() || undefined,
    address: input.address?.trim() || undefined,
    wholesaleProfileComplete: role === "wholesale" ? false : undefined,
    createdAt: now,
    updatedAt: now,
  };
  if (input.password) {
    doc.passwordHash = await bcrypt.hash(input.password, 12);
  }
  const result = await db.collection<DbUser>("users").insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

export async function verifyPassword(user: DbUser, password: string) {
  if (!user.passwordHash) return false;
  return bcrypt.compare(password, user.passwordHash);
}
