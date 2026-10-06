import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { strings } from "@/lib/i18n/strings";

export const metadata: Metadata = {
  title: strings.login,
};

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // If already logged in, redirect to dashboard
  if (session?.user) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}