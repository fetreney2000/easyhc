"use client";

import { useSession } from "next-auth/react";
import { Center, Stack, Text, Button } from "@mantine/core";
import Link from "next/link";
import { can, type Action } from "@/lib/auth/rbac";
import { strings } from "@/lib/i18n/strings";
import { LoadingScreen } from "./LoadingScreen";

/**
 * Client-side page access check.
 *
 * The API remains the authority (it returns 401/403/empty for anything the
 * role may not see); this only stops an unauthorised URL from rendering an
 * admin-looking page with a visible "add" button behind it.
 *
 * Call it with the other hooks, BEFORE the first conditional return:
 *
 *   const access = useAccess(["users:manage"]);
 *   if (!session?.user) return <LoadingScreen />;
 *   if (access) return access;
 */
export function useAccess(actions: Action[]): React.ReactNode | null {
  const { data: session } = useSession();

  if (!session?.user) return <LoadingScreen />;

  const allowed = actions.some((action) => can(session.user.role, action));
  if (allowed) return null;

  return (
    <Center mih="50vh">
      <Stack align="center" gap="md">
        <Text fw={700}>{strings.forbidden}</Text>
        <Text size="sm" c="var(--app-text-secondary)" ta="center">
          {strings.unauthorized}
        </Text>
        <Button component={Link} href="/dashboard" variant="light">
          {strings.dashboard}
        </Button>
      </Stack>
    </Center>
  );
}
