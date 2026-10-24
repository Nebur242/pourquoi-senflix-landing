import { sendGAEvent } from "@next/third-parties/google";

/** GA4 measurement ID, inlined at build time. Unset → GA is not rendered and events are dropped. */
export const GA_MEASUREMENT_ID = (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "").trim();

type EventParams = Record<string, string | number | boolean>;

/** Sends a GA4 event; silently does nothing when GA is not configured or not loaded. Never pass personal data. */
export function trackEvent(name: string, params?: EventParams): void {
  if (!GA_MEASUREMENT_ID || typeof window === "undefined" || !window.dataLayer) return;
  try {
    sendGAEvent("event", name, params ?? {});
  } catch {
    // Analytics must never break the page.
  }
}
