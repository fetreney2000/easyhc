"use client";

import { useState } from "react";
import { Alert, Badge, Button, Group, Text } from "@mantine/core";
import { IconAlertTriangle, IconCircleCheck } from "@tabler/icons-react";
import Link from "next/link";
import useSWR from "swr";
import { notifications } from "@mantine/notifications";
import { fetcher } from "@/lib/api/fetcher";
import { strings } from "@/lib/i18n/strings";
import { clock } from "@/lib/format";
import type { EvacuationResponse } from "@/lib/evacuation";

/**
 * Sticky "an evacuation session is running" banner shown on EVERY app page
 * while a session is active. Its whole job is one tap: "Saya Selamat" →
 * self-confirm at the muster point (atomic, idempotent, retryable when the
 * site's mobile network is congested).
 *
 * Polls the light projection (/api/evacuation, no roster) every 10s; renders
 * nothing at all when no session is active, which is the normal state.
 */
export function EvacuationBar() {
  const { data, mutate } = useSWR<EvacuationResponse>("/api/evacuation", fetcher, {
    refreshInterval: 10000,
    revalidateOnFocus: true,
  });
  const [submitting, setSubmitting] = useState(false);

  const session = data?.session ?? null;
  if (!session) return null;

  const confirmed = !!session.mine.confirmedAt;

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
        await mutate();
      } else {
        const err = await res.json().catch(() => ({}));
        notifications.show({
          title: strings.error,
          message: err.error || strings.serverError,
          color: "danger",
        });
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

  return (
    <div className="evac-bar">
      <Alert
        color="danger"
        role="alert"
        icon={<IconAlertTriangle size={20} />}
        p="md"
      >
        <Group justify="space-between" gap="sm" wrap="wrap">
          <Group gap="xs">
            <Text fw={800} className="evac-title">
              {strings.evacSessionActive}
            </Text>
            <Text size="sm" c="var(--app-text-secondary)">
              {strings.evacStartedAt(clock(session.startedAt))}
            </Text>
            <Badge color={session.counts.missing > 0 ? "danger" : "success"} size="lg">
              {strings.evacSafe}: {session.counts.confirmed}/
              {session.counts.total}
            </Badge>
          </Group>

          <Group gap="xs">
            {confirmed ? (
              <Badge
                color="success"
                size="lg"
                leftSection={<IconCircleCheck size={16} />}
              >
                {strings.evacYouAreSafe}
                {session.mine.confirmedAt
                  ? ` · ${clock(session.mine.confirmedAt)}`
                  : ""}
              </Badge>
            ) : session.mine.inRoster ? (
              <Button
                color="danger"
                size="md"
                loading={submitting}
                leftSection={<IconCircleCheck size={18} />}
                onClick={confirmSelf}
              >
                {strings.evacImSafe}
              </Button>
            ) : (
              <Text size="sm" fw={500}>
                {strings.evacNotInRoster}
              </Text>
            )}
            <Button
              component={Link}
              href="/muster"
              color="danger"
              variant="light"
              size="md"
            >
              {strings.evacOpenMuster}
            </Button>
          </Group>
        </Group>
      </Alert>
    </div>
  );
}
