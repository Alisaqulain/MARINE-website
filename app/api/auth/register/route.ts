import { NextResponse } from "next/server";
import { createUser, findUserByEmail, resolveRole } from "@/lib/auth-helpers";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const name = String(body.name ?? "").trim();
    const password = String(body.password ?? "");
    const mode = body.mode === "wholesale" ? "wholesale" : "customer";

    if (!email || !name || password.length < 8) {
      return NextResponse.json(
        { error: "Name, email and password (8+ characters) are required." },
        { status: 400 }
      );
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    const user = await createUser({
      email,
      name,
      password,
      role: resolveRole(email, mode),
    });

    return NextResponse.json({
      ok: true,
      user: { id: String(user._id), email: user.email, role: user.role },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Registration failed";
    const dbDown =
      /Mongo|ECONNREFUSED|SSL|connection|timed out|Atlas/i.test(message) ||
      message.includes("MONGODB_URI");
    return NextResponse.json(
      {
        error: dbDown
          ? "We could not reach the account database. Please try again in a few minutes or contact support at info@marinamuseinternational.com."
          : message,
      },
      { status: dbDown ? 503 : 500 }
    );
  }
}
