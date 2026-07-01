import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { AppShellLayout } from "@/components/shell/AppShellLayout";
import { SessionProvider } from "@/components/providers/SessionProvider";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <SessionProvider>
      <AppShellLayout
        user={{
          id: session.user.id,
          name: session.user.name,
          role: session.user.role,
          username: session.user.username,
        }}
      >
        {children}
      </AppShellLayout>
    </SessionProvider>
  );
}