/** Google Consent Mode v2 ("advanced"): GA loads denied and only gets analytics_storage on explicit consent. */

export type AnalyticsConsent = "granted" | "denied";

type StoredConsent = { analytics: AnalyticsConsent; ts: number };

export const CONSENT_STORAGE_KEY = "senflix_consent";
/** Re-ask after ~6 months (CNIL allows up to 13). */
export const CONSENT_MAX_AGE_MS = 182 * 24 * 60 * 60 * 1000;
/** Window event that reopens the banner (same name as app-landing). */
export const OPEN_CONSENT_EVENT = "senflix:open-consent";
export const PRIVACY_POLICY_URL = "https://founders.senflix.app/politique-de-confidentialite";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Inline <head> script that must run before gtag.js: defines dataLayer/gtag, sets every
 * signal to denied, then restores a still-valid "granted" choice so returning visitors
 * are measured from the first hit. Ads signals are never granted (no ads on the site).
 */
export const consentDefaultsScript = `
window.dataLayer = window.dataLayer || [];
window.gtag = window.gtag || function gtag(){window.dataLayer.push(arguments);};
window.gtag('consent', 'default', {
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  analytics_storage: 'denied',
  wait_for_update: 500
});
try {
  var c = JSON.parse(window.localStorage.getItem(${JSON.stringify(CONSENT_STORAGE_KEY)}) || 'null');
  if (c && c.analytics === 'granted' && typeof c.ts === 'number' && Date.now() - c.ts < ${CONSENT_MAX_AGE_MS}) {
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
  }
} catch (e) {}
`;

/** Returns the visitor's still-valid choice, or null when they must be asked (none, expired, unreadable). */
export function readConsent(): AnalyticsConsent | null {
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredConsent> | null;
    if (!parsed || typeof parsed.ts !== "number" || Date.now() - parsed.ts >= CONSENT_MAX_AGE_MS) return null;
    return parsed.analytics === "granted" || parsed.analytics === "denied" ? parsed.analytics : null;
  } catch {
    return null;
  }
}

/** Persists the choice and forwards it to Consent Mode. */
export function saveConsent(analytics: AnalyticsConsent): void {
  try {
    const value: StoredConsent = { analytics, ts: Date.now() };
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Storage blocked: the choice still applies to this page view.
  }
  try {
    window.gtag?.("consent", "update", { analytics_storage: analytics });
  } catch {
    // Analytics must never break the page.
  }
  if (analytics === "denied") clearAnalyticsCookies();
}

/** Withdrawing consent: drop any _ga cookies already set (current host and its parent domains). */
function clearAnalyticsCookies(): void {
  try {
    const names = document.cookie
      .split(";")
      .map((part) => part.split("=")[0].trim())
      .filter((name) => name === "_ga" || name.startsWith("_ga_"));
    if (names.length === 0) return;
    const labels = window.location.hostname.split(".");
    const domains = [""];
    for (let i = 0; i < labels.length - 1; i += 1) domains.push(`; domain=.${labels.slice(i).join(".")}`);
    for (const name of names) {
      for (const domain of domains) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${domain}`;
      }
    }
  } catch {
    // Best effort only.
  }
}
