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
 */
interface StoredVisit {
  attendanceId: string;
  checkoutToken: string;
  visitorName: string;
  checkedInAt: string;
  floorName?: string;
}

const storageKey = (floorId: string) => `easyhc:visitor:${floorId}`;

function readStoredVisit(floorId: string): StoredVisit | null {
  try {
    const raw = window.localStorage.getItem(storageKey(floorId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredVisit;
    return parsed && parsed.attendanceId && parsed.checkoutToken
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function storeVisit(floorId: string, visit: StoredVisit): void {
  try {
    window.localStorage.setItem(storageKey(floorId), JSON.stringify(visit));
  } catch {
    // Private mode / quota — the server-side rule still applies
  }
}

function clearStoredVisit(floorId: string): void {
  try {
    window.localStorage.removeItem(storageKey(floorId));
  } catch {
    // Ignore
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

  const enterCheckedInState = (visit: StoredVisit, note: string | null) => {
    storeVisit(floorId, visit);
    setAttendanceId(visit.attendanceId);
    setCheckoutToken(visit.checkoutToken);
    setCheckedInName(visit.visitorName);
    setCheckedInFloor(visit.floorName ?? "");
    setPanelNote(note);
    setError(null);
    setCheckedIn(true);
  };

  const resetToForm = () => {
    clearStoredVisit(floorId);
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
          color: "green",
        });
      } else if (res.status === 409 && data.alreadyCheckedIn) {
        // Already present somewhere in the building → switch straight to the
        // check-out panel instead of leaving them stuck on an error.
        const attendance = data.attendance ?? {};
        enterCheckedInState(
          {
            attendanceId: attendance._id,
            checkoutToken: data.checkoutToken,
            visitorName: attendance.visitorName || values.visitorName,
            checkedInAt: attendance.checkedInAt,
            floorName: attendance.floorName,
          },
          data.error || strings.visitorAlreadyOnThisFloor
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
          color: "green",
        });
        resetToForm();
      } else {
        const data = await res.json();
        notifications.show({
          title: strings.error,
          message: data.error || strings.checkOutError,
          color: "red",
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
        color: "red",
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
        <Title order={3} ta="center" mb="lg">
          {strings.visitorCheckInTitle}
        </Title>

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
            {error}
          </Alert>
        )}

        {checkedIn ? (
          <Stack gap="md">
            {panelNote ? (
              <Alert icon={<IconAlertCircle size={16} />} color="orange">
                {panelNote}
              </Alert>
            ) : (
              <Alert icon={<IconCheck size={16} />} color="green">
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
            <Button
              fullWidth
              color="red"
              variant="light"
              loading={checkoutLoading}
              disabled={!checkoutToken}
              onClick={handleCheckOut}
            >
              {strings.checkOut}
            </Button>
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
