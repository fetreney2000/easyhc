import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { connectDB } from "@/lib/db/mongoose";
import Evacuation from "@/lib/db/models/Evacuation";
import {
  evacuationResponse,
  type EvacuationResponse,
} from "@/lib/evacuation";
import { AppShellLayout } from "@/components/shell/AppShellLayout";
import { SessionProvider } from "@/components/providers/SessionProvider";

/**
 * SSR the evacuation state (same shape as GET ?roster=1&closed=1) so the
 * full-screen takeover renders on the very first paint — no flash of the
 * normal shell. The client revalidates the same SWR key; on any DB error it
 * just starts undefined and the client fetch takes over.
 */
async function initialEvacuation(user: {
  id: string;
  role: string;
  unitId?: string;
  jabatanId?: string;
}): Promise<EvacuationResponse | undefined> {
  try {
    await connectDB();
    return await evacuationResponse(
      user as Parameters<typeof evacuationResponse>[0],
      { roster: true, closed: true }
    );
  } catch {
    return undefined;
  }
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const evacuation = await initialEvacuation(session.user);

  return (
    <SessionProvider>
      <AppShellLayout
        initialEvacuation={evacuation}
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
