"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { OPEN_CONSENT_EVENT, PRIVACY_POLICY_URL, readConsent, saveConsent } from "@/lib/consent";
import type { AnalyticsConsent } from "@/lib/consent";

/** False when GA is disabled (no ID / preview): nothing to consent to, so no banner and no settings link. */
const ConsentEnabledContext = createContext(false);

/* Choice store: localStorage plus an in-memory copy for when storage is blocked. */
let sessionChoice: AnalyticsConsent | null = null;
const listeners = new Set<() => void>();

function subscribeChoice(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function hasValidChoice(): boolean {
  return sessionChoice !== null || readConsent() !== null;
}

export function ConsentProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  // Server snapshot "true": the banner only appears after hydration, once storage is readable.
  const hasChoice = useSyncExternalStore(subscribeChoice, hasValidChoice, () => true);
  const [isReopened, setIsReopened] = useState(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const isOpen = enabled && (isReopened || !hasChoice);

  const openConsent = useCallback(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setIsReopened(true);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener(OPEN_CONSENT_EVENT, openConsent);
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, openConsent);
  }, [enabled, openConsent]);

  const choose = useCallback((analytics: AnalyticsConsent) => {
    saveConsent(analytics);
    sessionChoice = analytics;
    listeners.forEach((listener) => listener());
    setIsReopened(false);
    returnFocusRef.current?.focus();
    returnFocusRef.current = null;
  }, []);

  return (
    <ConsentEnabledContext.Provider value={enabled}>
      {children}
      {isOpen ? <ConsentBanner autoFocus={isReopened} onChoose={choose} /> : null}
    </ConsentEnabledContext.Provider>
  );
}

/** Non-blocking bottom banner; "Accepter" and "Refuser" share one style (CNIL: equal prominence). */
function ConsentBanner({ autoFocus, onChoose }: { autoFocus: boolean; onChoose: (value: AnalyticsConsent) => void }) {
  const titleId = useId();
  const descriptionId = useId();
  const firstButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Only move focus when the visitor reopened the banner themselves; never steal it on page load.
    if (autoFocus) firstButtonRef.current?.focus();
  }, [autoFocus]);

  return (
    <div className="consent-banner" role="dialog" aria-modal="false" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <p className="consent-title" id={titleId}>
        Cookies de mesure d’audience
      </p>
      <p className="consent-text" id={descriptionId}>
        Nous utilisons des cookies de mesure d’audience (Google Analytics) pour améliorer le site. Vous pouvez
        accepter ou refuser.{" "}
        <a className="consent-link" href={PRIVACY_POLICY_URL} target="_blank" rel="noopener noreferrer">
          En savoir plus
        </a>
      </p>
      <div className="consent-actions">
        <button ref={firstButtonRef} type="button" className="consent-button" onClick={() => onChoose("denied")}>
          Refuser
        </button>
        <button type="button" className="consent-button" onClick={() => onChoose("granted")}>
          Accepter
        </button>
      </div>
    </div>
  );
}

/** "Gérer les cookies" control that reopens the banner; renders nothing when GA is disabled. */
export function CookieSettingsButton({ className }: { className?: string }) {
  if (!useContext(ConsentEnabledContext)) return null;
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}
      aria-haspopup="dialog"
    >
      Gérer les cookies
    </button>
  );
}
