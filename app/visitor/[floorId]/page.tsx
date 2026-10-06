"use client";

import { Suspense, useEffect, useState } from "react";
import {
  Center,
  Paper,
  TextInput,
  Button,
  Title,
  Text,
  Stack,
  Alert,
  Loader,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { useSearchParams } from "next/navigation";
import { IconAlertCircle, IconCheck, IconLogin } from "@tabler/icons-react";
import { strings } from "@/lib/i18n/strings";
import { notifications } from "@mantine/notifications";

/**
 * What we keep on the visitor's own device, so a reload doesn't offer the
 * check-in form again while they are still signed in somewhere.
 * The server enforces the same rule independently (one open check-in per
 * phone), this only makes the same-device case behave nicely.
 *
 * Written to BOTH sessionStorage (survives a reload in this tab, including
 * private windows) and localStorage (survives a new tab).
 */
interface StoredVisit {
  floorId: string;
  attendanceId: string;
  checkoutToken: string;
  visitorName: string;
  checkedInAt: string;
  floorName?: string;
}

const STORAGE_PREFIX = "easyhc:visitor:";

function allStoredVisits(): StoredVisit[] {
  const found: StoredVisit[] = [];

  for (const store of [window.sessionStorage, window.localStorage]) {
    try {
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i);
        if (!key || !key.startsWith(STORAGE_PREFIX)) continue;

        const raw = store.getItem(key);
        if (!raw) continue;

        const parsed = JSON.parse(raw) as StoredVisit;
        if (parsed && parsed.attendanceId && parsed.checkoutToken) {
          found.push(parsed);
        }
      }
    } catch {
      // Storage disabled (private mode / quota) — the server rule still applies
    }
  }

  return found;
}

/** The visit signed in on THIS floor, if it is still from today. */
function readStoredVisit(floorId: string): StoredVisit | null {
  const match = allStoredVisits().find((visit) => visit.floorId === floorId);
  if (!match) return null;

  // The daily cron closes every record at 03:00, so a marker from an earlier
  // day describes a closed record — showing "you are checked in" would be
  // wrong for today's muster. The entry is kept (not deleted) because its
  // token may still be needed if the visitor re-submits (see below).
  if (new Date(match.checkedInAt).toDateString() !== new Date().toDateString()) {
    return null;
  }

  return match;
}

/** The check-out token this device already holds for a given record. */
function findTokenFor(attendanceId: unknown): string | null {
  if (typeof attendanceId !== "string") return null;
  const match = allStoredVisits().find(
    (visit) => visit.attendanceId === attendanceId
  );
  return match ? match.checkoutToken : null;
}

function storeVisit(visit: StoredVisit): void {
  const payload = JSON.stringify(visit);
  for (const store of [window.sessionStorage, window.localStorage]) {
    try {
      store.setItem(STORAGE_PREFIX + visit.floorId, payload);
    } catch {
      // Private mode / quota — ignore, the server rule still applies
    }
  }
}

/** One visitor can only be signed in once, so any match clears every key. */
function clearStoredVisits(): void {
  for (const store of [window.sessionStorage, window.localStorage]) {
    try {
      for (let i = store.length - 1; i >= 0; i--) {
        const key = store.key(i);
        if (key && key.startsWith(STORAGE_PREFIX)) store.removeItem(key);
      }
    } catch {
      // Ignore
    }
  }
}

function VisitorCheckInContent({ floorId }: { floorId: string }) {
  const searchParams = useSearchParams();
  // Capability token carried by the printed visitor QR (?token=<qrToken>).
  // The API rejects check-in without the current token for this floor.
  const token = searchParams.get("token") ?? "";

  const [loading, setLoading] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [attendanceId, setAttendanceId] = useState<string | null>(null);
  const [checkoutToken, setCheckoutToken] = useState<string | null>(null);
  const [checkedInName, setCheckedInName] = useState("");
  const [checkedInFloor, setCheckedInFloor] = useState("");
  const [panelNote, setPanelNote] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    initialValues: {
      visitorName: "",
      visitorPhone: "",
    },
    validate: {
      visitorName: (value) =>
        value.trim().length < 1 ? strings.required : null,
      visitorPhone: (value) =>
        value.replace(/\D/g, "").length < 7 ? strings.invalidPhone : null,
    },
  });

  // Restore an existing sign-in after a reload (same device)
  useEffect(() => {
    const stored = readStoredVisit(floorId);
    if (!stored) return;

    setAttendanceId(stored.attendanceId);
    setCheckoutToken(stored.checkoutToken);
    setCheckedInName(stored.visitorName);
    setCheckedInFloor(stored.floorName ?? "");
    setPanelNote(null);
    setCheckedIn(true);
  }, [floorId]);

  /** Apply a checked-in panel for a record this device can see. */
  const applyVisit = (visit: StoredVisit, note: string | null) => {
    setAttendanceId(visit.attendanceId);
    setCheckoutToken(visit.checkoutToken);
    setCheckedInName(visit.visitorName);
    setCheckedInFloor(visit.floorName ?? "");
    setPanelNote(note);
    setError(null);
    setCheckedIn(true);
  };

  /** Only for records this device actually created (it owns the token). */
  const enterCheckedInState = (visit: StoredVisit, note: string | null) => {
    storeVisit(visit);
    applyVisit(visit, note);
  };

  const resetToForm = () => {
    clearStoredVisits();
    setCheckedIn(false);
    setAttendanceId(null);
    setCheckoutToken(null);
    setCheckedInName("");
    setCheckedInFloor("");
    setPanelNote(null);
    form.reset();
  };

  const handleSubmit = async (values: typeof form.values) => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/visitor/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          floorId,
          token,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        enterCheckedInState(
          {
            floorId,
            attendanceId: data.attendance?._id,
            checkoutToken: data.checkoutToken,
            visitorName: values.visitorName,
            checkedInAt: data.attendance?.checkedInAt,
            floorName: data.attendance?.floorName,
          },
          null
        );
        notifications.show({
          title: strings.success,
          message: strings.visitorCheckInSuccess,
          color: "success",
        });
      } else if (res.status === 409 && data.alreadyCheckedIn) {
        // Already present somewhere in the building → switch to the
        // check-out panel instead of leaving them stuck on an error.
        // The server does NOT hand out a token here (knowing a phone number
        // must not let you sign someone else out); we only get check-out if
        // THIS device already holds the token from when they signed in.
        const attendance = data.attendance ?? {};
        applyVisit(
          {
            floorId: attendance.floorId ?? floorId,
            attendanceId: attendance._id,
            checkoutToken: findTokenFor(attendance._id) ?? "",
            visitorName: values.visitorName,
            checkedInAt: attendance.checkedInAt,
            floorName: attendance.floorName,
          },
          data.error || strings.visitorAlreadyCheckedIn
        );
      } else {
        setError(data.error || strings.checkInError);
      }
    } catch {
      setError(strings.serverError);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async () => {
    if (!attendanceId || !checkoutToken) return;
    setCheckoutLoading(true);

    try {
      const res = await fetch("/api/visitor/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceId, checkoutToken }),
      });

      if (res.ok) {
        notifications.show({
          title: strings.success,
          message: strings.visitorCheckOutSuccess,
          color: "success",
        });
        resetToForm();
      } else {
        const data = await res.json();
        notifications.show({
          title: strings.error,
          message: data.error || strings.checkOutError,
          color: "danger",
        });
        // The record is no longer usable (closed by the daily cron, or the
        // token no longer matches): drop the local marker so the form works
        // again instead of being stuck on a dead panel.
        resetToForm();
      }
    } catch {
      notifications.show({
        title: strings.error,
        message: strings.serverError,
        color: "danger",
      });
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <Center mih="100vh" bg="var(--mantine-color-default-bg)">
      <Paper
        shadow="md"
        p="xl"
        radius="md"
        w={{ base: "100%", xs: 400 }}
        maw={400}
        mx="md"
      >
        <Title order={1} size="h3" ta="center" mb="lg">
          {strings.visitorCheckInTitle}
        </Title>

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="danger" mb="md">
            {error}
          </Alert>
        )}

        {checkedIn ? (
          <Stack gap="md">
            {panelNote ? (
              <Alert icon={<IconAlertCircle size={16} />} color="warning">
                {panelNote}
              </Alert>
            ) : (
              <Alert icon={<IconCheck size={16} />} color="success">
                {strings.visitorCheckInSuccess}
              </Alert>
            )}
            <Text size="sm" c="dimmed" ta="center">
              {checkedInName}
            </Text>
            {checkedInFloor && (
              <Text size="xs" c="dimmed" ta="center">
                {strings.checkedInAtFloor} {checkedInFloor}
              </Text>
            )}
            {checkoutToken ? (
              <Button
                fullWidth
                color="danger"
                variant="light"
                loading={checkoutLoading}
                onClick={handleCheckOut}
              >
                {strings.checkOut}
              </Button>
            ) : (
              // No token on this device → it never checked this record in
              <Text size="xs" c="dimmed" ta="center">
                {strings.visitorUseOriginalDevice}
              </Text>
            )}
          </Stack>
        ) : (
          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="md">
              <TextInput
                label={strings.visitorName}
                placeholder={strings.visitorName}
                required
                {...form.getInputProps("visitorName")}
              />
              <TextInput
                label={strings.visitorPhone}
                placeholder={strings.visitorPhonePlaceholder}
                required
                {...form.getInputProps("visitorPhone")}
              />
              <Button
                type="submit"
                fullWidth
                loading={loading}
                leftSection={<IconLogin size={18} />}
                mt="sm"
              >
                {strings.checkIn}
              </Button>
            </Stack>
          </form>
        )}
      </Paper>
    </Center>
  );
}

export default function VisitorCheckInPage({
  params,
}: {
  params: { floorId: string };
}) {
  // useSearchParams() (for ?token=) must sit under a Suspense boundary
  return (
    <Suspense
      fallback={
        <Center mih="100vh" bg="var(--mantine-color-default-bg)">
          <Loader />
        </Center>
      }
    >
      <VisitorCheckInContent floorId={params.floorId} />
    </Suspense>
  );
}
