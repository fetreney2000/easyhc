"use client";

import { useEffect, useState } from "react";
import { Button } from "@mantine/core";
import { IconDownload } from "@tabler/icons-react";
import { strings } from "@/lib/i18n/strings";

/**
 * The `beforeinstallprompt` event is Chromium-only (Android/desktop) and is
 * never fired on the server or before the PWA installability criteria are
 * met — so this button exists ONLY when the browser says it can install, and
 * disappears again after a successful install. iOS/Safari (and any browser
 * without the event) keeps the printed/login-page "Add to Home Screen"
 * instructions instead, which is why the text tip stays alongside it.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallAppButton() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(
    null
  );
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      // Keep the event: Chrome's own mini-bar is otherwise the only chance,
      // and it disappears quickly — we render our own durable button instead
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || !promptEvent) return null;

  const handleInstall = async () => {
    const event = promptEvent;
    // The event is single-use: let go of it before the dialog resolves
    setPromptEvent(null);
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
    }
  };

  return (
    <Button
      fullWidth
      variant="light"
      color="brandPrimary"
      mt="sm"
      leftSection={<IconDownload size={18} />}
      onClick={handleInstall}
    >
      {strings.installApp}
    </Button>
  );
}
