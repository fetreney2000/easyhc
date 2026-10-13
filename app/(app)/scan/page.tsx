"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Title,
  Paper,
  Text,
  Alert,
  Stack,
  Center,
  Group,
  Loader,
  Button,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconCamera,
  IconCheck,
  IconQrcode,
  IconRefresh,
} from "@tabler/icons-react";
import type { Html5Qrcode } from "html5-qrcode";
import { strings } from "@/lib/i18n/strings";
import { PageHeader } from "@/components/ui/PageHeader";
import { notifications } from "@mantine/notifications";
import { useRouter } from "next/navigation";

export default function ScanPage() {
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  // Guards the async check-in path. A ref (not state): the scanner callback
  // is created once, so reading state there would always see the first value.
  const processingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  // On-screen status card under the camera (three states). Toasts still
  // fire, but they are no longer the only channel: the card is durable,
  // readable at arm's length, and survives the camera resuming behind it.
  const [scanState, setScanState] = useState<
    "idle" | "processing" | "success" | "error"
  >("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  // Cooldown for the same rejected code still held in front of the camera,
  // so a poster in frame cannot spam toasts every few hundred ms
  const lastRejectedRef = useRef<{ text: string; at: number } | null>(null);
  // Bumping this restarts the camera effect (the only recovery path after a
  // failed start — previously the page required a full reload)
  const [startAttempt, setStartAttempt] = useState(0);
  const router = useRouter();

  const retryScan = () => {
    setError(null);
    setScanning(false);
    setScanState("idle");
    setStatusMessage(null);
    setStartAttempt((attempt) => attempt + 1);
  };

  /**
   * html5-qrcode injects its own overlay div ("Scanner paused", toggled by
   * pause/resume) into our camera box. Every visible pixel there must be
   * ours, so the element is removed from the DOM after start — the library's
   * later display toggles then write to a detached node, which is harmless.
   * Matched by its text so a library-internal id change cannot break it.
   */
  const removeLibraryOverlay = (root: HTMLElement | null) => {
    if (!root) return;
    for (const child of Array.from(root.children)) {
      if (
        child instanceof HTMLDivElement &&
        child.textContent?.trim() === "Scanner paused"
      ) {
        child.remove();
      }
    }
  };

  const handleCheckIn = useCallback(
    async (qrToken: string, scannedText: string) => {
      try {
        // Stop scanner temporarily
        const scanner = html5QrCodeRef.current;
        if (scanner?.isScanning) {
          await scanner.pause(true);
          // The pause overlay is guaranteed to exist by now — make sure it
          // is gone (our own processing overlay owns this space instead)
          removeLibraryOverlay(scannerRef.current);
        }
        setScanState("processing");
        setStatusMessage(null);

        const res = await fetch("/api/attendance/checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qrToken }),
        });

        const data = await res.json();

        if (res.ok) {
          notifications.show({
            title: strings.success,
            message: data.message,
            color: "success",
            icon: <IconCheck size={16} />,
          });
          // Hold the success state briefly so the message is readable, then
          // let the dashboard itself be the proof (you appear on the board)
          setScanState("success");
          setStatusMessage(data.message);
          setTimeout(() => router.push("/dashboard"), 1000);
          return;
        } else {
          // Deterministic server rejection (rotated poster, wrong code):
          // remember the code so a poster sitting in frame cannot toast-
          // loop while the camera re-decodes it every few hundred ms
          lastRejectedRef.current = { text: scannedText, at: Date.now() };
          notifications.show({
            title: strings.error,
            message: data.error || strings.checkInError,
            color: "danger",
          });
          // The card STAYS red while the camera resumes behind it —
          // the toast is no longer the only place this was said
          setScanState("error");
          setStatusMessage(data.error || strings.checkInError);
        }

        // Resume scanner after a short delay
        setTimeout(async () => {
          if (scanner?.isScanning) {
            try {
              await scanner.resume();
            } catch {}
          }
        }, 2000);
      } catch {
        lastRejectedRef.current = { text: scannedText, at: Date.now() };
        notifications.show({
          title: strings.error,
          message: strings.serverError,
          color: "danger",
        });
        setScanState("error");
        setStatusMessage(strings.serverError);
        // Resume scanner
        const scanner = html5QrCodeRef.current;
        if (scanner?.isScanning) {
          try {
            await scanner.resume();
          } catch {}
        }
      }
    },
    [router]
  );

  useEffect(() => {
    let mounted = true;
    let scanner: Html5Qrcode | null = null;

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");

        if (!mounted || !scannerRef.current) return;

        scanner = new Html5Qrcode("qr-reader");
        html5QrCodeRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
          qrbox: { width: 300, height: 300 },
          aspectRatio: 1.0,
          },
          async (decodedText: string) => {
            if (processingRef.current) return;
            // A code that just FAILED deterministically (rotated poster,
            // wrong code, server error) stays quiet while it sits in frame:
            // the camera re-decodes it every few hundred ms, and without
            // this the error card would toast-loop until it moves
            const lastFail = lastRejectedRef.current;
            if (
              lastFail &&
              lastFail.text === decodedText &&
              Date.now() - lastFail.at < 3000
            ) {
              return;
            }
            processingRef.current = true;

            try {
              // Extract QR token from URL or use raw text
              let qrToken = decodedText;
              let ownAppUrlWithoutToken = false;

              // If it's a URL, extract the token
              try {
                const url = new URL(decodedText);
                const tokenParam = url.searchParams.get("token");
                if (tokenParam) {
                  qrToken = tokenParam;
                } else {
                  // Maybe it's the path segment
                  const pathParts = url.pathname.split("/");
                  const lastPart = pathParts[pathParts.length - 1];
                  if (lastPart && lastPart !== "scan") {
                    qrToken = lastPart;
                  } else if (url.host === window.location.host) {
                    // Our own app address WITHOUT a floor token: the
                    // staff-access poster QR (or a plain link to the app).
                    // The most likely wrong code now that posters are on
                    // the walls — say so instantly, with no server round
                    // trip, and keep the camera running for the right code.
                    ownAppUrlWithoutToken = true;
                  }
                }
              } catch {
                // Not a URL, use raw text as token
              }

              if (ownAppUrlWithoutToken) {
                lastRejectedRef.current = { text: decodedText, at: Date.now() };

                notifications.show({
                  title: strings.error,
                  message: strings.scanWrongQrApp,
                  color: "danger",
                });
                setScanState("error");
                setStatusMessage(strings.scanWrongQrApp);
                // The camera never paused — the user can rescan the
                // correct floor QR immediately
                return;
              }

              lastRejectedRef.current = null;
              // Physical "locked on" confirmation — no-op on iOS, invaluable
              // at a noisy muster point on Android. Only for a code we will
              // actually process, so the poster QR never buzzes and then
              // tells you it was wrong.
              if (typeof navigator.vibrate === "function") {
                navigator.vibrate(200);
              }
              await handleCheckIn(qrToken, decodedText);
            } catch (err) {
              console.error("QR processing error:", err);
            } finally {
              processingRef.current = false;
            }
          },
          () => {
            // QR code not found in frame - ignore
          }
        );

        // The user may have left while the camera was still starting: the
        // cleanup's isScanning check ran too early to stop anything, so
        // release the track here — otherwise the camera light stays on with
        // no UI controlling it, and the next visit fights it for the device
        if (!mounted) {
          try {
            await scanner.stop();
          } catch {}
          return;
        }

        if (mounted) {
          setScanning(true);
          setError(null);
          // Remove the library's own status overlay — from here on the box
          // shows only our state
          removeLibraryOverlay(scannerRef.current);
        }
      } catch (err) {
        console.error("Scanner error:", err);
        if (mounted) {
          const message = err instanceof Error ? err.message : "";
          const name = err instanceof Error ? err.name : "";
          if (message.includes("Permission") || name === "NotAllowedError") {
            setError(strings.cameraPermissionDenied);
          } else {
            setError(strings.cameraError);
          }
        }
      }
    };

    startScanner();

    return () => {
      mounted = false;
      if (scanner && scanner.isScanning) {
        scanner.stop().catch(() => {});
      }
    };
    // handleCheckIn is memoised on the stable router; startAttempt re-runs
    // this after retryScan() so a camera failure is recoverable
  }, [handleCheckIn, startAttempt]);

  return (
    <Stack gap="lg">
      <PageHeader title={strings.scanQRTitle} />

      {error && (
        <Stack gap="sm">
          <Alert icon={<IconAlertCircle size={16} />} color="danger">
            {error}
          </Alert>
          <Button
            variant="light"
            leftSection={<IconRefresh size={16} />}
            onClick={retryScan}
          >
            {strings.retry}
          </Button>
        </Stack>
      )}

      <Paper p="md" radius="md" withBorder>
        <Text size="sm" c="var(--app-text-secondary)" ta="center" mb="md">
          {strings.scanQRInstruction}
        </Text>

        <Center>
          {/* Radius/overflow live on OUR wrapper: it also clips our
              processing overlay, so nothing of the library's can peek
              through from underneath */}
          <div
            style={{
              position: "relative",
              width: "100%",
              maxWidth: 400,
              borderRadius: "var(--mantine-radius-md)",
              overflow: "hidden",
            }}
          >
            <div
              id="qr-reader"
              ref={scannerRef}
              style={{ width: "100%" }}
            />
            {scanState === "processing" && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 2,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.75rem",
                  background: "rgba(9, 9, 9, 0.6)",
                  color: "#ffffff",
                }}
              >
                <Loader size="md" color="#ffffff" />
                <Text size="sm" fw={500} style={{ color: "#ffffff" }}>
                  {strings.scanProcessing}
                </Text>
              </div>
            )}
          </div>
        </Center>

        {/* The status card: durable, in the user's language, and it outlives
            the toast — success flashes briefly before the dashboard redirect,
            errors stay red while the camera resumes behind them */}
        {scanState === "processing" && (
          <Group justify="center" gap="sm" mt="md">
            <Loader size="sm" />
            <Text size="sm" fw={500}>
              {strings.scanProcessing}
            </Text>
          </Group>
        )}
        {scanState === "success" && (
          <Alert icon={<IconCheck size={16} />} color="success" mt="md">
            {statusMessage}
          </Alert>
        )}
        {scanState === "error" && (
          <Alert icon={<IconAlertCircle size={16} />} color="danger" mt="md">
            {statusMessage}
          </Alert>
        )}

        {!scanning && !error && (
          <Center py="xl">
            <Stack align="center" gap="sm">
              <Loader />
              <Text size="sm" c="var(--app-text-secondary)">
                {strings.loading}
              </Text>
            </Stack>
          </Center>
        )}
      </Paper>

      <Button
        variant="light"
        leftSection={<IconQrcode size={16} />}
        onClick={() => router.push("/dashboard")}
        fullWidth
      >
        {strings.back} - {strings.dashboard}
      </Button>
    </Stack>
  );
}