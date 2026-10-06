import type { Metadata } from "next";
import { strings } from "@/lib/i18n/strings";

export const metadata: Metadata = {
  title: strings.visitorCheckInTitle,
};

/** Lets the public visitor page carry its own <title> (it is a client page). */
export default function VisitorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
