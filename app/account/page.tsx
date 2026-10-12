import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AccountDashboard } from "@/components/AccountDashboard";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login?callbackUrl=/account");
  }

  return (
    <AccountDashboard
      fallbackName={session.user.name ?? "Customer"}
      fallbackEmail={session.user.email ?? ""}
      role={session.user.role ?? "customer"}
    />
  );
}
