"use client";

import { useEffect } from "react";
import { notifications } from "@mantine/notifications";
import { IconWifiOff, IconWifi } from "@tabler/icons-react";
import { strings } from "@/lib/i18n/strings";

/**
 * Registers the service worker (production only) and tells the user when
 * connectivity drops or returns — the two strings this component uses were
 * defined in strings.ts but never referenced anywhere.
 */
export function ServiceWorkerProvider() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((error) => console.error("SW registration failed:", error));
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register);
    }

    return () => window.removeEventListener("load", register);
  }, []);

  useEffect(() => {
    const show = (color: "orange" | "green", message: string, icon: React.ReactNode) => {
      notifications.show({
        id: "connection",
        title: color === "orange" ? strings.warning : strings.success,
        message,
        color,
        icon,
        autoClose: color === "orange" ? false : 4000,
      });
    };

    const handleOffline = () =>
      show("orange", strings.offlineMessage, <IconWifiOff size={16} />);
    const handleOnline = () =>
      show("green", strings.backOnline, <IconWifi size={16} />);

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      handleOffline();
    }

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  return null;
}
