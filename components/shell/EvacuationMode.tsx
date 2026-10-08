"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  Alert,
  Badge,
  Button,
  Center,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCircleCheck,
  IconMaximize,
  IconMinimize,
} from "@tabler/icons-react";
import { notifications } from "@mantine/notifications";
import { modals } from "@mantine/modals";
import { strings } from "@/lib/i18n/strings";
import { clock, duration } from "@/lib/format";
import { can } from "@/lib/auth/rbac";
import { DataTable } from "@/components/ui/DataTable";
import type { EvacuationResponse } from "@/lib/evacuation";
import type { Role } from "@/lib/db/types";

interface EvacuationModeProps {
  user: { id: string; name: string; role: Role; username: string };
  data: EvacuationResponse;
  /** Revalidate the shared SWR key — flipping back when a session closes. */
  onRefresh: () => Promise<unknown>;
}

/* All colours for the dark emergency ground are explicit here (and in the
   .evac-* classes) so nothing depends on the user's light/dark scheme or on
   Mantine's semantic tokens, whose light shades fail contrast on black. */
const TONE_COLOR = {
  miss: "#ff6b6b",
  ok: "#63e6a0",
  total: "#f1f3f5",
} as const;
const CARD_STYLE: CSSProperties = {
  background: "#14161b",
  borderColor: "#2a2f37",
};
const TABLE_STYLE: CSSProperties = { background: "transparent" };
const TH_STYLE: CSSProperties = {
  background: "#15181d",
  color: "#b7bec7",
  borderColor: "#2a2f37",
};
const TD_STYLE: CSSProperties = { borderColor: "#2a2f37" };
const BADGE_OK: CSSProperties = {
  background: "rgba(81, 207, 102, 0.16)",
  color: "#7ee7a0",
  border: "1px solid rgba(81, 207, 102, 0.45)",
};
const BADGE_MISS: CSSProperties = {
  background: "rgba(255, 82, 82, 0.16)",
  color: "#ff9b9b",
  border: "1px solid rgba(255, 82, 82, 0.45)",
};
const DARK_WARNING: CSSProperties = {
  background: "rgba(255, 169, 77, 0.12)",
  color: "#ffd8a8",
  border: "1px solid rgba(255, 169, 77, 0.45)",
};

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: keyof typeof TONE_COLOR;
}) {
  return (
    <Paper p="lg" radius="md" withBorder style={CARD_STYLE}>
      <Stack gap={4} align="center">
        <Text className="evac-label">{label}</Text>
        <Text className="evac-number" style={{ color: TONE_COLOR[tone] }}>
          {value}
        </Text>
      </Stack>
    </Paper>
  );
}

/**
 * The ENTIRE app while an evacuation session is active (spec): this component
 * replaces the shell — no header, no sidebar, no footer, no page content —
 * at every route, until the session is closed. Restyled as an emergency
 * display: dark takeover, hazard band, pulsing alarm, giant numbers.
 *
 * Three states, decided by the roster SNAPSHOT (which now contains only
 * people with an OPEN check-in at alarm time):
 *  1. NOT on the roster (was never checked in) → informational page only:
 *     no button, no stats — they were never counted as expected;
 *  2. on the roster, not confirmed → one giant "Saya Selamat" button;
 *  3. confirmed → building-wide stats (missing count first), scoped floor
 *     locations and — for warden roles — the name list.
 * Visitors never reach this component: they confirm from their own public
 * check-in page and see no stats at all.
 */
export function EvacuationMode({ user, data, onRefresh }: EvacuationModeProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pendingRosterId, setPendingRosterId] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const session = data.session;

  // Client-only staleness check: computing Date.now() during SSR would put
  // the 2h boundary in a DIFFERENT place server vs client → a STRUCTURAL
  // hydration mismatch (Alert present on one side only), far worse than a
  // text mismatch. Evaluated after mount instead.
  const [sessionTooLong, setSessionTooLong] = useState(false);
  useEffect(() => {
    if (session?.startedAt) {
      setSessionTooLong(
        Date.now() - new Date(session.startedAt).getTime() >
          2 * 60 * 60 * 1000
      );
    }
  }, [session?.startedAt]);

  // Gate → stats transition: the giant button unmounts, so focus would drop
  // to <body>. Move it to the stats block instead. The ref is seeded with
  // the CURRENT state, so a session already confirmed at mount never steals
  // focus (only real transitions do).
  const statsRef = useRef<HTMLDivElement>(null);
  const wasConfirmed = useRef(!!session?.mine.confirmedAt);
  useEffect(() => {
    const confirmedNow = !!session?.mine.confirmedAt;
    if (confirmedNow && !wasConfirmed.current) {
      statsRef.current?.focus();
    }
    wasConfirmed.current = confirmedNow;
  }, [session?.mine.confirmedAt]);

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
        // Permission denied — the display already fills the viewport
      });
    }
  };

  const notifyError = async (res: Response) => {
    const err = await res.json().catch(() => ({}));
    notifications.show({
      title: strings.error,
      message: err.error || strings.serverError,
      color: "danger",
    });
  };

  /** One tap: "I reached the assembly point" — atomic + idempotent. */
  const confirmSelf = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/evacuation/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (res.ok) {
        notifications.show({
          title: strings.success,
          message: strings.evacSafeRecorded,
          color: "success",
        });
        await onRefresh();
      } else {
        await notifyError(res);
      }
    } catch {
      notifications.show({
        title: strings.error,
        message: strings.serverError,
        color: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  };

  /** Warden tap on the roster (own floor only — the API enforces it). */
  const handleRosterConfirm = async (rosterId: string, confirm: boolean) => {
    setPendingRosterId(rosterId);
    try {
      const res = await fetch("/api/evacuation/confirm", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rosterId, confirm }),
      });
      if (!res.ok) await notifyError(res);
      await onRefresh();
    } catch {
      notifications.show({
        title: strings.error,
        message: strings.serverError,
        color: "danger",
      });
    } finally {
      setPendingRosterId(null);
    }
  };

  const handleClose = () => {
    modals.openConfirmModal({
      title: strings.evacClose,
      children: <Text size="sm">{strings.evacCloseConfirm}</Text>,
      labels: { confirm: strings.confirm, cancel: strings.cancel },
      confirmProps: { color: "danger" },
      onConfirm: async () => {
        try {
          const res = await fetch("/api/evacuation", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          });
          if (res.ok) {
            notifications.show({
              title: strings.success,
              message: strings.evacCloseSuccess,
              color: "success",
            });
          } else {
            await notifyError(res);
          }
          await onRefresh(); // session gone → the shell comes back
        } catch {
          notifications.show({
            title: strings.error,
            message: strings.serverError,
            color: "danger",
          });
        }
      },
    });
  };

  if (!session) return null;

  // On the roster ⇔ had an open check-in when the alarm went off
  const checkedIn = session.mine.inRoster;
  const confirmed = !!session.mine.confirmedAt;
  const canClose = can(user.role, "evacuation:close");
  const canConfirmOthers = can(user.role, "evacuation:confirm_others");
  const counts = session.counts;
  const floors = session.floors ?? [];
  const roster = session.roster ?? [];
  const elapsed = duration(session.startedAt, new Date().toISOString());

  return (
    <div ref={contentRef} className="evac-fullscreen">
      {/* The signature hazard band */}
      <div className="evac-hazard" aria-hidden="true" />

      <Stack
        gap="xl"
        py={{ base: "md", md: "xl" }}
        px={{ base: "md", md: "xl" }}
      >
        {/* Header: alarm dot, headline, meta (with live elapsed chip), controls */}
        <Group justify="space-between" gap="md" wrap="wrap">
          <Group gap="md" align="center">
            <span className="evac-pulse" aria-hidden="true" />
            <Stack gap={4}>
              <Title order={1} className="evac-headline">
                {strings.evacSessionActive}
              </Title>
              {/* clock() renders in the VIEWER's timezone but this line is
                  server-rendered (UTC on Vercel) — let hydration take the
                  client's value instead of erroring on the mismatch */}
              <Text
                className="evac-label"
                suppressHydrationWarning
              >
                {strings.evacStartedAt(clock(session.startedAt))} ·{" "}
                {session.startedByName}
                <span className="evac-chip">
                  {strings.evacElapsed(elapsed)}
                </span>
              </Text>
            </Stack>
          </Group>
          <Group gap="xs">
            <Button
              variant="light"
              leftSection={
                fullscreen ? <IconMinimize size={18} /> : <IconMaximize size={18} />
              }
              onClick={toggleFullscreen}
            >
              {fullscreen ? strings.evacExitFullscreen : strings.evacFullscreen}
            </Button>
            {canClose && (
              <Button
                color="danger"
                leftSection={<IconAlertTriangle size={18} />}
                onClick={handleClose}
              >
                {strings.evacClose}
              </Button>
            )}
          </Group>
        </Group>

        {sessionTooLong && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            color="warning"
            style={DARK_WARNING}
          >
            {strings.evacSessionOld}
          </Alert>
        )}

        {/* Always mounted across ALL states: a live region created together
            with its content announces nothing, and the pollable counts must
            not be aria-live (they would re-announce every 3s). This text
            changes exactly at the state transitions. */}
        <div role="status" aria-live="polite" className="sr-only">
          {!checkedIn
            ? strings.evacNotInRoster
            : confirmed
              ? strings.evacYouAreSafe
              : strings.evacSafePrompt}
        </div>

        {!checkedIn ? (
          /* STATE 1 — not on the roster: informational only. No button,
             no stats: this person was never in the building (as far as the
             app knows) and is not counted as expected anywhere. */
          <Center mih="55vh">
            <Stack align="center" gap="lg" maw={760}>
              <IconAlertTriangle
                size={96}
                stroke={1.5}
                className="evac-alerticon"
                aria-hidden
              />
              <Title order={2} className="evac-state-title">
                {strings.evacNotInRoster}
              </Title>
              <Text className="evac-prompt" ta="center">
                {strings.evacNotOnRosterDesc}
              </Text>
            </Stack>
          </Center>
        ) : !confirmed ? (
          /* STATE 2 — checked in, not confirmed: one giant button */
          <Center mih="55vh">
            <Stack align="center" gap="xl" w="100%">
              <Text className="evac-prompt" ta="center">
                {strings.evacSafePrompt}
              </Text>
              <Button
                autoFocus
                className="evac-safe-btn"
                color="danger"
                size="xl"
                loading={submitting}
                leftSection={<IconCircleCheck size={32} />}
                onClick={confirmSelf}
              >
                {strings.evacImSafe}
              </Button>
            </Stack>
          </Center>
        ) : (
          /* STATE 3 — confirmed: stats with MISSING FIRST (the emergency
             priority), then scoped locations, then the warden's list */
          <Stack
            gap="xl"
            ref={statsRef}
            tabIndex={-1}
            style={{ outline: "none" }}
          >
            <SimpleGrid cols={{ base: 1, sm: 3 }}>
              <StatCard
                label={strings.evacMissing}
                value={counts.missing}
                tone="miss"
              />
              <StatCard
                label={strings.evacSafe}
                value={counts.confirmed}
                tone="ok"
              />
              <StatCard
                label={strings.evacExpected}
                value={counts.total}
                tone="total"
              />
            </SimpleGrid>

            {floors.length > 0 && (
              <Stack gap="md">
                <Title order={2} size="h2">
                  {strings.evacByFloor}
                </Title>
                <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
                  {floors.map((floor) => (
                    <Paper
                      key={floor.floorId}
                      p="lg"
                      radius="md"
                      withBorder
                      style={CARD_STYLE}
                    >
                      <Stack gap="xs" align="center">
                        <Text className="evac-floor-name" ta="center">
                          {floor.name}
                        </Text>
                        <Text
                          className="evac-number"
                          style={{
                            color:
                              floor.missing > 0
                                ? TONE_COLOR.miss
                                : TONE_COLOR.ok,
                          }}
                        >
                          {floor.confirmed}/{floor.expected}
                        </Text>
                        <Group gap="md">
                          <Badge size="lg" style={BADGE_OK}>
                            {strings.evacSafe}: {floor.confirmed}
                          </Badge>
                          <Badge size="lg" style={BADGE_MISS}>
                            {strings.evacMissing}: {floor.missing}
                          </Badge>
                        </Group>
                      </Stack>
                    </Paper>
                  ))}
                </SimpleGrid>
              </Stack>
            )}

            {session.rosterVisible ? (
              <Stack gap="xs">
                <Title order={2} size="h2">
                  {strings.evacRosterTitle}
                </Title>
                {/* Explicit cell styles + theme striping/hover off: the dark
                    takeover must not inherit the light table theme */}
                <Table
                  striped={false}
                  highlightOnHover={false}
                  style={TABLE_STYLE}
                >
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th style={TH_STYLE}>{strings.name}</Table.Th>
                      <Table.Th style={TH_STYLE}>{strings.typeLabel}</Table.Th>
                      <Table.Th style={TH_STYLE}>{strings.floors}</Table.Th>
                      <Table.Th style={TH_STYLE}>{strings.status}</Table.Th>
                      {canConfirmOthers && (
                        <Table.Th style={TH_STYLE}>{strings.actions}</Table.Th>
                      )}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {roster.map((row) => (
                      <Table.Tr key={row._id}>
                        <Table.Td style={TD_STYLE}>{row.name}</Table.Td>
                        <Table.Td style={TD_STYLE}>
                          {row.type === "employee"
                            ? strings.employee
                            : strings.visitor}
                        </Table.Td>
                        <Table.Td style={TD_STYLE}>
                          {row.floorName ?? strings.unknownFloor}
                        </Table.Td>
                        <Table.Td style={TD_STYLE}>
                          {row.confirmedAt ? (
                            <Badge style={BADGE_OK} suppressHydrationWarning>
                              {strings.evacSafe} · {clock(row.confirmedAt)}
                            </Badge>
                          ) : (
                            <Badge style={BADGE_MISS}>
                              {strings.evacMissing}
                            </Badge>
                          )}
                        </Table.Td>
                        {canConfirmOthers && (
                          <Table.Td style={TD_STYLE}>
                            <Button
                              size="xs"
                              variant="light"
                              color={row.confirmedAt ? "gray" : "success"}
                              loading={pendingRosterId === row._id}
                              onClick={() =>
                                handleRosterConfirm(row._id, !row.confirmedAt)
                              }
                            >
                              {row.confirmedAt
                                ? strings.evacUnmarkSafe
                                : strings.evacMarkSafe}
                            </Button>
                          </Table.Td>
                        )}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Stack>
            ) : (
              <Text size="sm" className="evac-quiet">
                {strings.evacNamesNote}
              </Text>
            )}
          </Stack>
        )}
      </Stack>
    </div>
  );
}
