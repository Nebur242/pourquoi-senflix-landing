"use client";

import type {
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

/* ---------- API contract ---------- */

const CAMPAIGN_SLUG = "100-founder-creators";
const FOUNDERS_URL = "https://founders.senflix.app/";
const REQUEST_TIMEOUT_MS = 15000;

/** Read the same way as 100-creators-founders-campaign/src/lib/senflix-api.ts (inlined at build time). */
const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").trim().replace(/\/$/, "");

type InterestLeadBody = {
  email?: string;
  phone?: string;
  source: "pourquoi";
  /** Honeypot: always empty for humans. */
  website: string;
};

type SubmitResult = { ok: true } | { ok: false; message: string };

const errorCopy = {
  400: "Ces informations semblent invalides. Vérifiez votre numéro ou votre e-mail, puis réessayez.",
  404: "Cette campagne n’est pas disponible pour le moment. Vous pouvez candidater directement sur founders.senflix.app.",
  429: "Trop de tentatives en peu de temps. Patientez quelques minutes avant de réessayer.",
  network: "Connexion impossible. Vérifiez votre connexion Internet et réessayez.",
  server: "Une erreur est survenue de notre côté. Réessayez dans un instant.",
} as const;

async function submitInterestLead(body: InterestLeadBody): Promise<SubmitResult> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/campaigns/${CAMPAIGN_SLUG}/interest-leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "Accept-Language": "fr" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    return { ok: false, message: errorCopy.network };
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (response.ok) return { ok: true };
  if (response.status === 400 || response.status === 422) return { ok: false, message: errorCopy[400] };
  if (response.status === 404) return { ok: false, message: errorCopy[404] };
  if (response.status === 429) return { ok: false, message: errorCopy[429] };
  return { ok: false, message: errorCopy.server };
}

/* ---------- Validation ---------- */

/** MVP countries; Senegal first (default). */
const COUNTRIES = [
  { code: "SN", name: "Sénégal", dial: "+221" },
  { code: "CI", name: "Côte d’Ivoire", dial: "+225" },
  { code: "BJ", name: "Bénin", dial: "+229" },
  { code: "TG", name: "Togo", dial: "+228" },
  { code: "BF", name: "Burkina Faso", dial: "+226" },
  { code: "ML", name: "Mali", dial: "+223" },
  { code: "NE", name: "Niger", dial: "+227" },
  { code: "GN", name: "Guinée", dial: "+224" },
  { code: "CM", name: "Cameroun", dial: "+237" },
  { code: "CG", name: "Congo", dial: "+242" },
] as const;

type CountryCode = (typeof COUNTRIES)[number]["code"];
type Channel = "phone" | "email";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

/**
 * Combine the dial code with the local number, stripping spaces, dashes, dots
 * and parentheses. A number typed in international form (+… or 00…) is kept
 * as-is so visitors who paste their full number are not double-prefixed.
 */
function normalizePhone(dialCode: string, localNumber: string) {
  const compact = localNumber.replace(/[\s\-.()]/g, "");
  if (compact.startsWith("+")) return compact;
  if (compact.startsWith("00")) return `+${compact.slice(2)}`;
  return `${dialCode}${compact}`;
}

function validate(channel: Channel, dialCode: string, phone: string, email: string) {
  if (channel === "phone") {
    if (!phone.trim()) return { error: "Indiquez votre numéro de téléphone." };
    const normalized = normalizePhone(dialCode, phone);
    if (!E164_PATTERN.test(normalized)) {
      return { error: "Ce numéro ne semble pas valide. Vérifiez l’indicatif et les chiffres saisis." };
    }
    return { value: normalized };
  }
  const trimmed = email.trim();
  if (!trimmed) return { error: "Indiquez votre adresse e-mail." };
  if (trimmed.length > 254 || !EMAIL_PATTERN.test(trimmed)) {
    return { error: "Cette adresse e-mail ne semble pas valide (ex. nom@exemple.com)." };
  }
  return { value: trimmed.toLowerCase() };
}

/* ---------- Component ---------- */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string }
  | { kind: "success" };

function CloseIcon() {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function ContactModal({ open, onClose }: Readonly<{ open: boolean; onClose: () => void }>) {
  const [channel, setChannel] = useState<Channel>("phone");
  const [country, setCountry] = useState<CountryCode>("SN");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const dialogRef = useRef<HTMLDialogElement>(null);
  const fieldRef = useRef<HTMLInputElement>(null);
  const successTitleRef = useRef<HTMLHeadingElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const backdropPressRef = useRef(false);

  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;
  const fieldId = `${id}-field`;
  const countryId = `${id}-country`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const isConfigured = API_BASE !== "";
  const isSubmitting = status.kind === "submitting";
  const dialCode = COUNTRIES.find((item) => item.code === country)?.dial ?? "+221";

  /* Open/close the native dialog from the `open` prop. */
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      const focused = document.activeElement;
      returnFocusRef.current = focused instanceof HTMLElement && focused !== document.body ? focused : null;
      document.documentElement.classList.add("is-scroll-locked");
      dialog.showModal();
      (fieldRef.current ?? dialog.querySelector<HTMLElement>(".contact-close"))?.focus({ preventScroll: true });
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (status.kind === "success") successTitleRef.current?.focus({ preventScroll: true });
  }, [status.kind]);

  function requestClose() {
    dialogRef.current?.close();
  }

  /* Runs for every close path (button, Escape, backdrop). */
  function handleClose() {
    document.documentElement.classList.remove("is-scroll-locked");
    backdropPressRef.current = false;
    if (status.kind === "success") {
      setChannel("phone");
      setCountry("SN");
      setPhone("");
      setEmail("");
      setWebsite("");
    }
    if (status.kind !== "submitting") setStatus({ kind: "idle" });
    setFieldError(null);
    onClose();
    returnFocusRef.current?.focus({ preventScroll: true });
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    // Keep Tab cycling inside the dialog.
    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (element) => element.offsetParent !== null || element === document.activeElement,
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !event.currentTarget.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /* Backdrop dismiss: only when the press both starts and ends on empty space. */
  function handlePointerDown(event: ReactPointerEvent<HTMLDialogElement>) {
    backdropPressRef.current = (event.target as Element).hasAttribute("data-dismiss");
  }

  function handleClick(event: ReactMouseEvent<HTMLDialogElement>) {
    if (backdropPressRef.current && (event.target as Element).hasAttribute("data-dismiss")) requestClose();
    backdropPressRef.current = false;
  }

  function switchChannel(next: Channel) {
    if (next === channel) return;
    setChannel(next);
    setFieldError(null);
    if (status.kind === "error") setStatus({ kind: "idle" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    const result = validate(channel, dialCode, phone, email);
    if ("error" in result) {
      setFieldError(result.error ?? null);
      setStatus({ kind: "idle" });
      fieldRef.current?.focus();
      return;
    }
    setFieldError(null);

    if (!isConfigured) {
      setStatus({ kind: "error", message: "Le formulaire est momentanément indisponible." });
      return;
    }

    setStatus({ kind: "submitting" });
    const body: InterestLeadBody =
      channel === "phone"
        ? { phone: result.value, source: "pourquoi", website }
        : { email: result.value, source: "pourquoi", website };
    const outcome = await submitInterestLead(body);
    setStatus(outcome.ok ? { kind: "success" } : { kind: "error", message: outcome.message });
  }

  const describedBy = [channel === "phone" ? hintId : null, fieldError ? errorId : null].filter(Boolean).join(" ");

  return (
    <dialog
      ref={dialogRef}
      className="contact-dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClose={handleClose}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
    >
      <div className="contact-backdrop" aria-hidden="true" />
      <div className="contact-layer" data-dismiss="">
        <div className="contact-card">
          <button
            type="button"
            className="icon-button contact-close"
            onClick={requestClose}
            aria-label="Fermer"
            title="Fermer"
          >
            <CloseIcon />
          </button>

          {status.kind === "success" ? (
            <div className="contact-success">
              <span className="contact-success-mark" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              </span>
              <h2 ref={successTitleRef} id={titleId} className="contact-title" tabIndex={-1}>
                Merci !
              </h2>
              <p id={descriptionId} className="contact-lead" role="status">
                L’équipe Senflix vous contactera très bientôt pour vous présenter le programme des créateurs
                fondateurs.
              </p>
              <button type="button" className="primary-cta contact-submit" onClick={requestClose}>
                Fermer
              </button>
              <p className="contact-aside">
                Envie d’aller plus vite ?{" "}
                <a className="contact-link" href={FOUNDERS_URL} target="_blank" rel="noopener">
                  Candidater dès maintenant
                </a>
              </p>
            </div>
          ) : (
            <form className="contact-form" noValidate onSubmit={handleSubmit} aria-busy={isSubmitting}>
              <p className="contact-eyebrow">
                <span className="eyebrow-rule" aria-hidden="true" />
                Créateurs fondateurs
              </p>
              <h2 id={titleId} className="contact-title">
                Parlons de votre contenu
              </h2>
              <p id={descriptionId} className="contact-lead">
                Laissez-nous votre numéro ou votre e-mail : l’équipe Senflix vous recontacte pour vous présenter le
                programme.
              </p>

              {isConfigured ? null : (
                <p className="contact-notice" role="alert">
                  Le formulaire est momentanément indisponible. Vous pouvez candidater directement sur{" "}
                  <a className="contact-link" href={FOUNDERS_URL} target="_blank" rel="noopener">
                    founders.senflix.app
                  </a>
                  .
                </p>
              )}

              <fieldset className="contact-toggle">
                <legend className="visually-hidden">Être contacté par</legend>
                {(
                  [
                    ["phone", "Téléphone"],
                    ["email", "E-mail"],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className={`contact-toggle-option${channel === value ? " is-active" : ""}`}>
                    <input
                      type="radio"
                      name={`${id}-channel`}
                      value={value}
                      checked={channel === value}
                      onChange={() => switchChannel(value)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </fieldset>

              {channel === "phone" ? (
                <div className="contact-field">
                  <label className="contact-label" htmlFor={fieldId}>
                    Numéro de téléphone
                  </label>
                  <div className="contact-phone">
                    <label className="visually-hidden" htmlFor={countryId}>
                      Indicatif pays
                    </label>
                    <select
                      id={countryId}
                      className="contact-input contact-select"
                      value={country}
                      onChange={(event) => setCountry(event.target.value as CountryCode)}
                      autoComplete="tel-country-code"
                    >
                      {COUNTRIES.map((item) => (
                        <option key={item.code} value={item.code}>
                          {item.name} ({item.dial})
                        </option>
                      ))}
                    </select>
                    <input
                      key="phone"
                      ref={fieldRef}
                      id={fieldId}
                      className="contact-input"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel-national"
                      placeholder="77 123 45 67"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      aria-invalid={fieldError ? true : undefined}
                      aria-describedby={describedBy || undefined}
                      maxLength={24}
                    />
                  </div>
                  <p id={hintId} className="contact-hint">
                    WhatsApp de préférence.
                  </p>
                </div>
              ) : (
                <div className="contact-field">
                  <label className="contact-label" htmlFor={fieldId}>
                    Adresse e-mail
                  </label>
                  <input
                    key="email"
                    ref={fieldRef}
                    id={fieldId}
                    className="contact-input"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    placeholder="nom@exemple.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    aria-invalid={fieldError ? true : undefined}
                    aria-describedby={describedBy || undefined}
                    maxLength={254}
                  />
                </div>
              )}

              {fieldError ? (
                <p id={errorId} className="contact-error">
                  {fieldError}
                </p>
              ) : null}

              {/* Honeypot: invisible to people, tempting to bots. */}
              <div className="visually-hidden" aria-hidden="true">
                <label htmlFor={`${id}-website`}>Ne pas remplir ce champ</label>
                <input
                  id={`${id}-website`}
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                />
              </div>

              <button
                type="submit"
                className="primary-cta contact-submit"
                aria-disabled={isSubmitting || !isConfigured ? true : undefined}
              >
                {isSubmitting ? (
                  <>
                    <span className="contact-spinner" aria-hidden="true" />
                    Envoi en cours…
                  </>
                ) : (
                  "Être recontacté"
                )}
              </button>

              <p className="contact-status" role="status" aria-live="polite">
                {status.kind === "submitting" ? <span className="visually-hidden">Envoi en cours…</span> : null}
                {status.kind === "error" ? <span className="contact-status-error">{status.message}</span> : null}
              </p>

              <p className="contact-aside">
                Vous préférez candidater maintenant ?{" "}
                <a className="contact-link" href={FOUNDERS_URL} target="_blank" rel="noopener">
                  founders.senflix.app
                </a>
              </p>
            </form>
          )}
        </div>
      </div>
    </dialog>
  );
}
