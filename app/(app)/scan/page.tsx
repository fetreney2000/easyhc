"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Title,
  Paper,
  Text,
  Alert,
  Stack,
  Center,
  Loader,
  Button,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconCamera,
  IconCheck,
  IconQrcode,
} from "@tabler/icons-react";
import type { Html5Qrcode } from "html5-qrcode";
import { strings } from "@/lib/i18n/strings";
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
  const [lastResult, setLastResult] = useState<string | null>(null);
  const router = useRouter();

  const handleCheckIn = useCallback(
    async (qrToken: string) => {
      try {
        // Stop scanner temporarily
        const scanner = html5QrCodeRef.current;
        if (scanner?.isScanning) {
          await scanner.pause(true);
        }

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
            color: "green",
            icon: <IconCheck size={16} />,
          });
          // Redirect to dashboard after successful check-in
          router.push("/dashboard");
          return;
        } else {
          notifications.show({
            title: strings.error,
            message: data.error || strings.checkInError,
            color: "red",
          });
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
        notifications.show({
          title: strings.error,
          message: strings.serverError,
          color: "red",
        });
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
            processingRef.current = true;

            try {
              // Extract QR token from URL or use raw text
              let qrToken = decodedText;

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
                  }
                }
              } catch {
                // Not a URL, use raw text as token
              }

              await handleCheckIn(qrToken);
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

        if (mounted) {
          setScanning(true);
          setError(null);
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
    // handleCheckIn is memoised on the stable router, so the camera starts once
  }, [handleCheckIn]);

  return (
    <Stack gap="lg">
      <Title order={2}>{strings.scanQRTitle}</Title>

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red">
          {error}
        </Alert>
      )}

      {lastResult && (
        <Alert icon={<IconCheck size={16} />} color="green">
          {lastResult}
        </Alert>
      )}

      <Paper p="md" radius="md" withBorder>
        <Text size="sm" c="dimmed" ta="center" mb="md">
          {strings.scanQRInstruction}
        </Text>

        <Center>
          <div
            id="qr-reader"
            ref={scannerRef}
            style={{
              width: "100%",
              maxWidth: 400,
              borderRadius: "var(--mantine-radius-md)",
              overflow: "hidden",
            }}
          />
        </Center>

        {!scanning && !error && (
          <Center py="xl">
            <Stack align="center" gap="sm">
              <Loader />
              <Text size="sm" c="dimmed">
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