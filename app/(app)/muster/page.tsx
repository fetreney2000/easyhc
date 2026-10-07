"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Title,
  Paper,
  Text,
  Group,
  Stack,
  Button,
  Badge,
  Loader,
  Center,
  SimpleGrid,
  Alert,
} from "@mantine/core";
import {
  IconRefresh,
  IconMaximize,
  IconMinimize,
  IconAlertCircle,
} from "@tabler/icons-react";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { fetcher } from "@/lib/api/fetcher";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingScreen } from "@/components/shell/LoadingScreen";
import { strings } from "@/lib/i18n/strings";

interface PresenceRecord {
  _id: string;
  type: "employee" | "visitor";
  visitorName?: string;
  floorId: { _id: string; name: string };
  checkedInAt: string;
}

interface MusterData {
  attendance: PresenceRecord[];
  totalEmployees: number;
  totalVisitors: number;
  totalPresent: number;
  lastUpdated: string;
  rowCount: number;
  pageSize: number;
  total: number;
}

interface FloorTally {
  floorId: string;
  name: string;
  employees: number;
  visitors: number;
  total: number;
}

function StatCard({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: number;
  emphasis?: boolean;
}) {
  return (
    <Paper p="lg" radius="md" withBorder shadow={emphasis ? "sm" : undefined}>
      <Stack gap={4} align="center">
        <Text className="muster-label" c="var(--app-text-secondary)">
          {label}
        </Text>
        <Text className="muster-number" c={emphasis ? "brandPrimary" : undefined}>
          {value}
        </Text>
      </Stack>
    </Paper>
  );
}

/**
 * Muster mode — the view used DURING an evacuation or drill, not for admin
 * work: numbers sized for reading at arm's length (or projected), the whole
 * building's floor tallies, a browser-fullscreen toggle that hides the app
 * chrome, 10s refresh instead of 25s, a stale-data warning, and aria-live so
 * screen readers announce count changes.
 *
 * It reads the same scoped /api/attendance endpoint as the dashboard, so a
 * role only ever sees the floors its scope allows.
 */
export default function MusterPage() {
  const { data: session } = useSession();
  const [fullscreen, setFullscreen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const { data, error, isLoading, mutate } = useSWR<MusterData>(
    "/api/attendance?active=true&pageSize=1000",
    fetcher,
    { refreshInterval: 10000, revalidateOnFocus: true }
  );

  // Track browser fullscreen so the button label/state stays truthful
  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = () => {
    const element = contentRef.current;
    if (!element) return;

    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void element.requestFullscreen().catch(() => {
        // Permission denied (or unsupported) — stay in the page
      });
    }
  };

  // Per-floor tallies, biggest first (where people are concentrated)
  const tallies = useMemo<FloorTally[]>(() => {
    const byFloor = new Map<string, FloorTally>();

    for (const record of data?.attendance ?? []) {
      const id = record.floorId?._id;
      if (!id) continue;

      const tally = byFloor.get(id) ?? {
        floorId: id,
        name: record.floorId?.name || strings.unknownFloor,
        employees: 0,
        visitors: 0,
        total: 0,
      };

      if (record.type === "employee") tally.employees += 1;
      else tally.visitors += 1;
      tally.total += 1;
      byFloor.set(id, tally);
    }

    return Array.from(byFloor.values()).sort(
      (a, b) => b.total - a.total || a.name.localeCompare(b.name)
    );
  }, [data?.attendance]);

  const ageSeconds = data
    ? Math.round((Date.now() - new Date(data.lastUpdated).getTime()) / 1000)
    : null;
  // The view refreshes every 10s — anything older than two ticks is stale
  const isStale = ageSeconds !== null && ageSeconds > 25;

  if (!session?.user) return <LoadingScreen />;

  return (
    <Stack gap="lg">
      <PageHeader
        title={strings.musterMode}
        description={strings.musterModeDesc}
        actions={
          <>
            <Button
              variant="light"
              leftSection={<IconRefresh size={16} />}
              loading={isLoading}
              onClick={() => mutate()}
            >
              {strings.refresh}
            </Button>
            <Button
              leftSection={
                fullscreen ? <IconMinimize size={16} /> : <IconMaximize size={16} />
              }
              onClick={toggleFullscreen}
            >
              {fullscreen ? strings.musterExitFullscreen : strings.musterFullscreen}
            </Button>
          </>
        }
      />

      {/* The stage: the only thing on screen in fullscreen */}
      <div ref={contentRef}>
        {isLoading ? (
          <Center py="xl">
            <Loader size="xl" />
          </Center>
        ) : error ? (
          <ErrorState error={error} onRetry={mutate} />
        ) : (
          <Stack gap="xl">
            {/* role=status + aria-live: count changes are announced */}
            <SimpleGrid
              cols={{ base: 1, sm: 3 }}
              role="status"
              aria-live="polite"
            >
              <StatCard
                label={strings.totalPresent}
                value={data?.totalPresent ?? 0}
                emphasis
              />
              <StatCard
                label={strings.totalEmployees}
                value={data?.totalEmployees ?? 0}
              />
              <StatCard
                label={strings.totalVisitors}
                value={data?.totalVisitors ?? 0}
              />
            </SimpleGrid>

            {isStale && (
              <Alert icon={<IconAlertCircle size={16} />} color="warning">
                {strings.musterStale}
              </Alert>
            )}

            <Title order={2} size="h3">
              {strings.musterByFloor}
            </Title>

            {tallies.length === 0 ? (
              <Center py="xl">
                <Text className="muster-floor-name">
                  {strings.noOnePresent}
                </Text>
              </Center>
            ) : (
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                {tallies.map((tally) => (
                  <Paper key={tally.floorId} p="lg" radius="md" withBorder>
                    <Stack gap="xs" align="center">
                      <Text className="muster-floor-name" ta="center">
                        {tally.name}
                      </Text>
                      <Text className="muster-number" c="brandPrimary">
                        {tally.total}
                      </Text>
                      <Group gap="md">
                        <Badge size="lg" color="blue" variant="light">
                          {tally.employees} {strings.employee}
                        </Badge>
                        <Badge size="lg" color="warning" variant="light">
                          {tally.visitors} {strings.visitor}
                        </Badge>
                      </Group>
                    </Stack>
                  </Paper>
                ))}
              </SimpleGrid>
            )}

            <Text
              className="muster-label"
              c="var(--app-text-secondary)"
              ta="center"
            >
              {strings.lastUpdated}:{" "}
              {data
                ? new Date(data.lastUpdated).toLocaleTimeString("ms-MY")
                : "—"}
              {data && data.rowCount < data.total
                ? ` · ${strings.showingXofY(data.rowCount, data.total)}`
                : ""}
            </Text>
          </Stack>
        )}
      </div>
    </Stack>
  );
}
