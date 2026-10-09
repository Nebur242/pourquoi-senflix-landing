"use client";

import Image from "next/image";
import type {
  CSSProperties,
  FocusEvent as ReactFocusEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  SyntheticEvent,
} from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";

/** Time each brochure stays on screen while the slideshow plays. */
const AUTOPLAY_MS = 8000;
/** Minimum horizontal travel (px) before a pointer gesture counts as a swipe. */
const SWIPE_THRESHOLD = 48;
/** Lightbox morph timings (FLIP, transform/opacity only). */
const ZOOM_OPEN_MS = 460;
const ZOOM_CLOSE_MS = 360;
const ZOOM_FADE_MS = 160;
const ZOOM_EASING = "cubic-bezier(0.2, 0.8, 0.2, 1)";
/** Double-tap / double-click zoom inside the lightbox. */
const ZOOM_SCALE = 2;
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_SLOP = 32;
const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';
/** Brochures mounted on first render; matches the <link rel="preload"> tags in app/layout.tsx. */
const INITIAL_MOUNTED = 3;

const brochures = [
  {
    src: "/brochures/01_le_constat.webp",
    kicker: "Le constat",
    title: "Beaucoup de vues. Peu de revenus ?",
    summary: "Votre communauté vous suit. Mais la rémunération ne suit pas toujours.",
    alt: "Le constat : beaucoup de vues, peu de revenus ? Votre communauté vous suit, mais la rémunération ne suit pas toujours.",
  },
  {
    src: "/brochures/02_le_defi.webp",
    kicker: "Le défi",
    title: "Vos vues travaillent. Mais qui rémunère votre temps ?",
    summary:
      "Créer demande du temps, des idées et de l’énergie. Pourtant, l’accès aux revenus publicitaires varie selon les plateformes et les pays.",
    alt: "Le défi : vos vues travaillent, mais qui rémunère votre temps ? Le talent est là, le modèle peut évoluer.",
  },
  {
    src: "/brochures/03_contenu_premium.webp",
    kicker: "Une autre piste",
    title: "Et si votre contenu devenait premium ?",
    summary:
      "Un cours complet, une série exclusive ou des conseils approfondis : proposez à votre communauté un accès à vos vidéos premium.",
    alt: "Une autre piste : et si votre contenu devenait premium ? Proposez à votre communauté un accès à vos vidéos premium.",
  },
  {
    src: "/brochures/04_reseaux_et_senflix.webp",
    kicker: "Les deux peuvent coexister",
    title: "Ne quittez pas vos réseaux. Donnez-leur un nouveau rôle.",
    summary: "Les réseaux vous font découvrir ; Senflix peut accueillir vos vidéos premium.",
    alt: "Les deux peuvent coexister : ne quittez pas vos réseaux, donnez-leur un nouveau rôle. Réseaux : découverte. Senflix : accès premium.",
  },
  {
    src: "/brochures/05_mobile_money_et_retraits.webp",
    kicker: "Des paiements adaptés",
    title: "Payer et recevoir. À votre façon.",
    summary:
      "Votre audience peut payer via Mobile Money lorsque ce moyen est disponible. Et vous pouvez choisir de recevoir vos revenus par Mobile Money ou par virement, selon vos besoins.",
    alt: "Des paiements adaptés : payer et recevoir à votre façon. Mobile Money ou virement bancaire, vous choisissez.",
  },
  {
    src: "/brochures/06_appel_a_decouvrir.webp",
    kicker: "Le talent est ici",
    title: "Votre audience est là. Offrez-lui plus.",
    summary:
      "Continuez à créer sur les réseaux. Avec Senflix, proposez aussi des playlists vidéo premium et des options de paiement et de retrait adaptées à vos besoins.",
    alt: "Le talent est ici : votre audience est là, offrez-lui plus. Playlists premium, Mobile Money et virement bancaire.",
  },
] as const;

const total = brochures.length;
const wrapIndex = (index: number) => (index + total) % total;
const pad = (value: number) => String(value).padStart(2, "0");

type PlayPreference = "auto" | "on" | "off";

/* ---------- External-store hooks (no setState-in-effect) ---------- */

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const media = window.matchMedia(reducedMotionQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(reducedMotionQuery).matches,
    () => false,
  );
}

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

function usePageHidden() {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === "hidden",
    () => false,
  );
}

/* ---------- Pointer gestures ---------- */

type GestureHandlers = {
  onNext: () => void;
  onPrevious: () => void;
  /** Called when the pointer is released having moved less than the swipe threshold. */
  onTap?: (point: { x: number; y: number }) => void;
  onPressChange?: (isPressed: boolean) => void;
};

/**
 * Horizontal swipe + tap detection on one element. Taps and swipes are
 * mutually exclusive: a gesture is a tap only if it moved less than
 * SWIPE_THRESHOLD on both axes. Gestures starting on a button are ignored so
 * buttons layered over the element keep their own click behaviour.
 */
function useSwipe({ onNext, onPrevious, onTap, onPressChange }: GestureHandlers) {
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const reset = () => {
    startRef.current = null;
    onPressChange?.(false);
  };

  return {
    onPointerDown(event: ReactPointerEvent<HTMLElement>) {
      if (!event.isPrimary) {
        // A second finger (pinch) invalidates the gesture.
        reset();
        return;
      }
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if ((event.target as Element).closest("button")) return;
      startRef.current = { x: event.clientX, y: event.clientY };
      onPressChange?.(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerUp(event: ReactPointerEvent<HTMLElement>) {
      const start = startRef.current;
      reset();
      if (!start || !event.isPrimary) return;
      // While the visitor is pinch-zoomed in, let one-finger drags pan freely.
      if ((window.visualViewport?.scale ?? 1) > 1.01) return;

      const deltaX = event.clientX - start.x;
      const deltaY = event.clientY - start.y;
      if (Math.abs(deltaX) < SWIPE_THRESHOLD && Math.abs(deltaY) < SWIPE_THRESHOLD) {
        onTap?.({ x: event.clientX, y: event.clientY });
        return;
      }
      if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;
      if (deltaX < 0) onNext();
      else onPrevious();
    },
    onPointerCancel: reset,
  };
}

/** translate/scale that maps rect `to` onto rect `from` (both squares). */
function flipTransform(from: DOMRect, to: DOMRect) {
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const scale = to.width > 0 ? from.width / to.width : 1;
  return `translate(${dx}px, ${dy}px) scale(${scale})`;
}

/* ---------- Presentational pieces ---------- */

function Brand() {
  return (
    <span className="brand">
      <Image
        className="brand-mark"
        src="/brand/senflix-icon.png"
        alt=""
        width={514}
        height={543}
        aria-hidden="true"
      />
      <span>SENFLIX</span>
    </span>
  );
}

function Icon({
  name,
}: {
  name: "prev" | "next" | "play" | "pause" | "arrow" | "external" | "expand" | "close";
}) {
  const paths: Record<typeof name, string> = {
    prev: "M15 5l-7 7 7 7",
    next: "M9 5l7 7-7 7",
    play: "M8 5.5v13l10.5-6.5z",
    pause: "M8 5h3v14H8zM13 5h3v14h-3z",
    arrow: "M4 12h15M13 6l6 6-6 6",
    external: "M7 17L17 7M9 7h8v8",
    expand: "M14 4h6v6M10 20H4v-6M20 4l-6.5 6.5M4 20l6.5-6.5",
    close: "M6 6l12 12M18 6L6 18",
  };
  const filled = name === "play" || name === "pause";
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}

/* ---------- Slideshow ---------- */

export function WhyCarousel() {
  // `activeIndex` drives captions/pagination immediately; `shownIndex` is the
  // brochure actually visible, and only switches once the target image is
  // decoded. This is what prevents the blank/flicker frame the previous
  // remount-based slide animation produced.
  const [activeIndex, setActiveIndex] = useState(0);
  const [shownIndex, setShownIndex] = useState(0);
  const [mounted, setMounted] = useState<readonly boolean[]>(() =>
    brochures.map((_, index) => index < INITIAL_MOUNTED),
  );
  const [playPreference, setPlayPreference] = useState<PlayPreference>("auto");
  const [isHovered, setIsHovered] = useState(false);
  const [hasFocusVisible, setHasFocusVisible] = useState(false);
  const [isPointerDown, setIsPointerDown] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const loadedRef = useRef<boolean[]>(brochures.map(() => false));
  const activeIndexRef = useRef(0);
  const frameRef = useRef<HTMLDivElement>(null);
  const expandButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const figureRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const isClosingRef = useRef(false);
  const backdropPressRef = useRef(false);
  const zoomLayerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef({ scale: 1, x: 0, y: 0 });
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);
  const panRef = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);

  const prefersReducedMotion = usePrefersReducedMotion();
  const isPageHidden = usePageHidden();

  const isPlaying =
    playPreference === "on" || (playPreference === "auto" && !prefersReducedMotion);
  const isWaitingForImage = shownIndex !== activeIndex;
  const isTimerRunning =
    isPlaying &&
    !isHovered &&
    !hasFocusVisible &&
    !isPointerDown &&
    !isPageHidden &&
    !isWaitingForImage &&
    !isLightboxOpen;

  const active = brochures[activeIndex];

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  const goTo = useCallback(
    (index: number, { manual }: { manual: boolean }) => {
      const target = wrapIndex(index);
      if (manual) setPlayPreference("off");
      if (target === activeIndex) return;

      setActiveIndex(target);
      setMounted((previous) =>
        previous.some((isMounted, i) => !isMounted && (i === target || i === wrapIndex(target + 1)))
          ? previous.map((isMounted, i) => isMounted || i === target || i === wrapIndex(target + 1))
          : previous,
      );
      if (loadedRef.current[target]) setShownIndex(target);
    },
    [activeIndex],
  );

  const next = useCallback(() => goTo(activeIndex + 1, { manual: true }), [activeIndex, goTo]);
  const previous = useCallback(() => goTo(activeIndex - 1, { manual: true }), [activeIndex, goTo]);
  const advance = useCallback(() => goTo(activeIndex + 1, { manual: false }), [activeIndex, goTo]);

  const handleImageLoad = useCallback((index: number, event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    const markReady = () => {
      loadedRef.current[index] = true;
      if (activeIndexRef.current === index) setShownIndex(index);
    };
    // Decode off the main thread before revealing so the crossfade never
    // starts on a half-painted image.
    if (typeof image.decode === "function") image.decode().then(markReady, markReady);
    else markReady();
  }, []);

  /* ---------- Lightbox (FLIP morph from the slideshow frame) ---------- */

  const openLightbox = useCallback(() => {
    if (isLightboxOpen) return;
    const focused = document.activeElement;
    // Keyboard opens come from the "Agrandir" button; pointer opens return
    // focus to the frame itself (tabIndex -1) so no focus ring appears.
    returnFocusRef.current =
      focused instanceof HTMLElement && focused !== document.body ? focused : frameRef.current;
    isClosingRef.current = false;
    setIsLightboxOpen(true);
  }, [isLightboxOpen]);

  useLayoutEffect(() => {
    if (!isLightboxOpen) return;
    const dialog = dialogRef.current;
    const figure = figureRef.current;
    const frame = frameRef.current;
    if (!dialog || !figure || !frame) return;

    document.documentElement.classList.add("is-scroll-locked");
    if (!dialog.open) dialog.showModal();
    closeButtonRef.current?.focus({ preventScroll: true });
    // Keep the modal invisible until its (already cached) image is decoded,
    // so the morph never starts on an empty box.
    dialog.classList.add("is-preparing");

    let cancelled = false;
    const image = figure.querySelector<HTMLImageElement>(".slide.is-shown img");
    const ready = image ? image.decode().catch(() => undefined) : Promise.resolve();

    ready.then(() => {
      if (cancelled || !dialog.open) return;
      const fromRect = frame.getBoundingClientRect();
      const toRect = figure.getBoundingClientRect();
      dialog.classList.remove("is-preparing");
      frame.setAttribute("data-zoomed", "");
      // Re-assert initial focus: on touch, the tap's compatibility mouse
      // events land on the freshly opened dialog and would move focus to it.
      if (!dialog.contains(document.activeElement) || document.activeElement === dialog) {
        closeButtonRef.current?.focus({ preventScroll: true });
      }

      if (window.matchMedia(reducedMotionQuery).matches) {
        dialog.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ZOOM_FADE_MS, easing: "ease-out" });
        return;
      }

      figure.animate([{ transform: flipTransform(fromRect, toRect) }, { transform: "none" }], {
        duration: ZOOM_OPEN_MS,
        easing: ZOOM_EASING,
      });
      backdropRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: ZOOM_OPEN_MS * 0.8,
        easing: "ease-out",
      });
      dialog.querySelectorAll(".lightbox-ui").forEach((element) =>
        element.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], {
          duration: 280,
          delay: ZOOM_OPEN_MS * 0.4,
          easing: "ease-out",
          fill: "backwards",
        }),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [isLightboxOpen]);

  /* ---------- Lightbox zoom (transform-only, origin top-left) ---------- */

  const applyZoom = useCallback((scale: number, x: number, y: number, animate: boolean) => {
    const layer = zoomLayerRef.current;
    const figure = figureRef.current;
    if (!layer || !figure) return;
    const limit = -figure.clientWidth * (scale - 1);
    const clampedX = Math.min(0, Math.max(limit, x));
    const clampedY = Math.min(0, Math.max(limit, y));
    zoomRef.current = { scale, x: clampedX, y: clampedY };
    layer.classList.toggle("is-panning", !animate);
    layer.style.transform =
      scale === 1 ? "" : `translate(${clampedX}px, ${clampedY}px) scale(${scale})`;
    if (scale > 1) figure.setAttribute("data-zoomed", "");
    else figure.removeAttribute("data-zoomed");
  }, []);

  const resetZoom = useCallback(() => {
    panRef.current = null;
    applyZoom(1, 0, 0, false);
  }, [applyZoom]);

  // Every brochure opens un-zoomed.
  useEffect(() => {
    resetZoom();
  }, [activeIndex, resetZoom]);

  function handleLightboxTap({ x, y }: { x: number; y: number }) {
    const now = performance.now();
    const last = lastTapRef.current;
    const isDoubleTap =
      last && now - last.time < DOUBLE_TAP_MS && Math.hypot(x - last.x, y - last.y) < DOUBLE_TAP_SLOP;
    if (!isDoubleTap) {
      lastTapRef.current = { time: now, x, y };
      return;
    }
    lastTapRef.current = null;
    const figure = figureRef.current;
    if (!figure) return;
    if (zoomRef.current.scale > 1) {
      applyZoom(1, 0, 0, true);
      return;
    }
    // Keep the tapped point under the finger: p = t + scale * p  =>  t = -(scale - 1) * p
    const rect = figure.getBoundingClientRect();
    applyZoom(ZOOM_SCALE, -(ZOOM_SCALE - 1) * (x - rect.left), -(ZOOM_SCALE - 1) * (y - rect.top), true);
  }

  const closeLightbox = useCallback(() => {
    const dialog = dialogRef.current;
    const figure = figureRef.current;
    const frame = frameRef.current;
    if (!dialog?.open || !figure || !frame || isClosingRef.current) return;
    isClosingRef.current = true;

    // data-zoomed is set imperatively (not via className) so React re-renders
    // of the frame during modal navigation cannot drop it.
    // Reveal the slideshow image and close the dialog in the same task so
    // the browser paints them together: no frame without either image.
    const finish = () => {
      frame.removeAttribute("data-zoomed");
      if (dialog.open) dialog.close();
    };

    dialog.getAnimations({ subtree: true }).forEach((animation) => animation.cancel());
    resetZoom();

    if (window.matchMedia(reducedMotionQuery).matches || dialog.classList.contains("is-preparing")) {
      dialog
        .animate([{ opacity: 1 }, { opacity: 0 }], { duration: ZOOM_FADE_MS * 0.75, fill: "forwards" })
        .finished.then(finish, finish);
      return;
    }

    const fromRect = frame.getBoundingClientRect();
    const toRect = figure.getBoundingClientRect();
    backdropRef.current?.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: ZOOM_CLOSE_MS,
      easing: "ease-in",
      fill: "forwards",
    });
    dialog.querySelectorAll(".lightbox-ui").forEach((element) =>
      element.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, easing: "ease-in", fill: "forwards" }),
    );
    figure
      .animate([{ transform: "none" }, { transform: flipTransform(fromRect, toRect) }], {
        duration: ZOOM_CLOSE_MS,
        easing: "cubic-bezier(0.4, 0, 0.2, 1)",
        fill: "forwards",
      })
      .finished.then(finish, finish);
  }, [resetZoom]);

  /* Runs for every close path, including a forced Esc that skips our animation. */
  function handleDialogClose() {
    const dialog = dialogRef.current;
    isClosingRef.current = false;
    frameRef.current?.removeAttribute("data-zoomed");
    dialog?.classList.remove("is-preparing");
    dialog?.getAnimations({ subtree: true }).forEach((animation) => animation.cancel());
    document.documentElement.classList.remove("is-scroll-locked");
    resetZoom();
    lastTapRef.current = null;
    setIsLightboxOpen(false);
    returnFocusRef.current?.focus({ preventScroll: true });
  }

  function handleDialogCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    closeLightbox();
  }

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLDialogElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeLightbox();
      return;
    }
    if (event.key !== "Tab") return;
    // Keep Tab cycling inside the dialog.
    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /* Backdrop dismiss: only when the press both starts and ends on empty space. */
  function handleDialogPointerDown(event: ReactPointerEvent<HTMLDialogElement>) {
    backdropPressRef.current = (event.target as Element).hasAttribute("data-dismiss");
  }

  // Clicking empty space or the image must not move focus onto the dialog
  // element itself (this also covers the tap that opened it on touch).
  function handleDialogMouseDown(event: ReactMouseEvent<HTMLDialogElement>) {
    if (!(event.target as Element).closest("button, a")) event.preventDefault();
  }

  function handleDialogClick(event: ReactMouseEvent<HTMLDialogElement>) {
    if (backdropPressRef.current && (event.target as Element).hasAttribute("data-dismiss")) closeLightbox();
    backdropPressRef.current = false;
  }

  const frameGestures = useSwipe({
    onNext: next,
    onPrevious: previous,
    onTap: openLightbox,
    onPressChange: setIsPointerDown,
  });
  const lightboxSwipe = useSwipe({ onNext: next, onPrevious: previous, onTap: handleLightboxTap });
  // When zoomed, one-finger drags pan the image instead of changing brochure.
  const lightboxGestures = {
    onPointerDown(event: ReactPointerEvent<HTMLElement>) {
      if (zoomRef.current.scale > 1 && event.isPrimary) {
        panRef.current = {
          x: event.clientX,
          y: event.clientY,
          originX: zoomRef.current.x,
          originY: zoomRef.current.y,
        };
      }
      lightboxSwipe.onPointerDown(event);
    },
    onPointerMove(event: ReactPointerEvent<HTMLElement>) {
      const pan = panRef.current;
      if (!pan || !event.isPrimary) return;
      applyZoom(
        zoomRef.current.scale,
        pan.originX + event.clientX - pan.x,
        pan.originY + event.clientY - pan.y,
        false,
      );
    },
    onPointerUp(event: ReactPointerEvent<HTMLElement>) {
      const pan = panRef.current;
      panRef.current = null;
      if (pan && Math.hypot(event.clientX - pan.x, event.clientY - pan.y) >= SWIPE_THRESHOLD) {
        lightboxSwipe.onPointerCancel();
        return;
      }
      lightboxSwipe.onPointerUp(event);
    },
    onPointerCancel() {
      panRef.current = null;
      lightboxSwipe.onPointerCancel();
    },
  };

  /* Pause while keyboard focus is inside the slideshow (not after mouse clicks). */
  function handleFocus(event: ReactFocusEvent<HTMLElement>) {
    setHasFocusVisible(event.target.matches(":focus-visible"));
  }

  function handleBlur(event: ReactFocusEvent<HTMLElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHasFocusVisible(false);
  }

  /* Keyboard arrows anywhere on the page */
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key === "ArrowRight") next();
      else if (event.key === "ArrowLeft") previous();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [next, previous]);

  /* Mount (and therefore fetch) the remaining brochures once the page has loaded. */
  useEffect(() => {
    const mountAll = () => setMounted((previous) => (previous.every(Boolean) ? previous : brochures.map(() => true)));

    if (document.readyState === "complete") {
      const timeoutId = window.setTimeout(mountAll, 250);
      return () => window.clearTimeout(timeoutId);
    }

    window.addEventListener("load", mountAll, { once: true });
    return () => window.removeEventListener("load", mountAll);
  }, []);

  const renderLayers = (variant: "slide" | "glow" | "lightbox") =>
    brochures.map((brochure, index) => {
      if (!mounted[index]) return null;
      const isShown = index === shownIndex;
      return (
        <div
          key={brochure.src}
          className={`${variant === "glow" ? "glow" : "slide"}${isShown ? " is-shown" : ""}`}
          aria-hidden={variant === "glow" || !isShown ? true : undefined}
        >
          <Image
            src={brochure.src}
            alt={variant === "glow" ? "" : brochure.alt}
            width={1254}
            height={1254}
            className={`${variant}-image`}
            unoptimized
            loading="eager"
            decoding="async"
            fetchPriority={index === 0 && variant === "slide" ? "high" : "low"}
            draggable={false}
            onLoad={variant === "slide" ? (event) => handleImageLoad(index, event) : undefined}
          />
        </div>
      );
    });

  const playLabel = isPlaying ? "Mettre le diaporama en pause" : "Lancer le diaporama";

  return (
    <div className="site-shell">
      <a className="skip-link" href="#diaporama">
        Aller au diaporama
      </a>
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />

      <header className="site-header">
        <Brand />
        <p className="header-tag">Pourquoi Senflix ?</p>
        <a className="header-link" href="https://founders.senflix.app/">
          Rejoindre les créateurs fondateurs <Icon name="external" />
        </a>
      </header>

      <main className="showcase" id="contenu">
        <div className="hero">
          <p className="eyebrow">
            <span className="eyebrow-rule" aria-hidden="true" />
            Pourquoi Senflix ?
          </p>
          <h1 className="hero-title">
            Le contenu africain <em>mérite plus.</em>
          </h1>
          <p className="hero-lead">
            Comprendre les défis des créateurs africains et découvrir pourquoi Senflix propose une nouvelle voie
            pour le contenu vidéo premium.
          </p>
        </div>

        <div className="chapter" aria-live={isPlaying ? "off" : "polite"} aria-atomic="true">
          <p className="chapter-meta">
            <span className="chapter-number">{pad(activeIndex + 1)}</span>
            <span className="chapter-total">/ {pad(total)}</span>
            <span className="chapter-dot" aria-hidden="true" />
            <span className="chapter-kicker">{active.kicker}</span>
          </p>
          <div className="chapter-body" key={activeIndex}>
            <h2 className="chapter-title">{active.title}</h2>
            <p className="chapter-summary">{active.summary}</p>
          </div>
        </div>

        <section
          className="stage"
          id="diaporama"
          aria-roledescription="carrousel"
          aria-label="Les six idées de Senflix"
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse") setIsHovered(true);
          }}
          onPointerLeave={() => setIsHovered(false)}
          onFocus={handleFocus}
          onBlur={handleBlur}
        >
          <div className="stage-glow" aria-hidden="true">
            {renderLayers("glow")}
          </div>

          <div
            ref={frameRef}
            className={`frame${isWaitingForImage ? " is-loading" : ""}`}
            role="group"
            tabIndex={-1}
            aria-roledescription="diapositive"
            aria-label={`${activeIndex + 1} sur ${total} : ${active.kicker}`}
            {...frameGestures}
          >
            {renderLayers("slide")}
            <button
              ref={expandButtonRef}
              type="button"
              className="expand-button"
              onClick={openLightbox}
              aria-haspopup="dialog"
              aria-label="Agrandir la brochure"
              title="Agrandir"
            >
              <Icon name="expand" />
            </button>
          </div>

          <div className="controls">
            <ol className="segments" aria-label="Choisir une brochure">
              {brochures.map((brochure, index) => {
                const state = index < activeIndex ? "is-complete" : index === activeIndex ? "is-current" : "";
                return (
                  <li key={brochure.src}>
                    <button
                      type="button"
                      className={`segment ${state}`}
                      onClick={() => goTo(index, { manual: true })}
                      aria-label={`Brochure ${index + 1} : ${brochure.kicker}`}
                      aria-current={index === activeIndex ? "step" : undefined}
                    >
                      <span className="segment-track" aria-hidden="true">
                        {index === activeIndex && isPlaying ? (
                          <span
                            key={`${activeIndex}-timer`}
                            className="segment-fill is-timing"
                            style={
                              {
                                "--autoplay-duration": `${AUTOPLAY_MS}ms`,
                                animationPlayState: isTimerRunning ? "running" : "paused",
                              } as CSSProperties
                            }
                            onAnimationEnd={advance}
                          />
                        ) : (
                          <span className="segment-fill" />
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            <div className="control-buttons">
              <button
                type="button"
                className="icon-button"
                onClick={() => setPlayPreference(isPlaying ? "off" : "on")}
                aria-label={playLabel}
                title={playLabel}
              >
                <Icon name={isPlaying ? "pause" : "play"} />
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={previous}
                aria-label="Brochure précédente"
                title="Précédente"
              >
                <Icon name="prev" />
              </button>
              <button
                type="button"
                className="icon-button icon-button-accent"
                onClick={next}
                aria-label="Brochure suivante"
                title="Suivante"
              >
                <Icon name="next" />
              </button>
            </div>
          </div>
        </section>

        <div className="cta-row">
          <a className="primary-cta" href="https://founders.senflix.app/">
            Devenir créateur fondateur <Icon name="arrow" />
          </a>
          <p className="cta-note">Candidature gratuite, sans minimum d’abonnés.</p>
        </div>
      </main>

      <dialog
        ref={dialogRef}
        className="lightbox"
        aria-modal="true"
        aria-label="Brochure agrandie"
        onCancel={handleDialogCancel}
        onClose={handleDialogClose}
        onKeyDown={handleDialogKeyDown}
        onPointerDown={handleDialogPointerDown}
        onMouseDown={handleDialogMouseDown}
        onClick={handleDialogClick}
      >
        <div ref={backdropRef} className="lightbox-backdrop" data-dismiss="" aria-hidden="true" />

        <div className="lightbox-bar lightbox-ui" data-dismiss="">
          <p className="lightbox-caption chapter-meta" aria-live="polite" aria-atomic="true">
            <span className="chapter-number">{pad(activeIndex + 1)}</span>
            <span className="chapter-total">/ {pad(total)}</span>
            <span className="chapter-dot" aria-hidden="true" />
            <span className="chapter-kicker">{active.kicker}</span>
          </p>
          <button
            ref={closeButtonRef}
            type="button"
            className="icon-button"
            onClick={closeLightbox}
            aria-label="Fermer"
            title="Fermer"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="lightbox-stage" data-dismiss="">
          <div
            ref={figureRef}
            className="lightbox-figure"
            title="Double-cliquez pour zoomer"
            {...lightboxGestures}
          >
            <div ref={zoomLayerRef} className="lightbox-zoom">
              {isLightboxOpen ? renderLayers("lightbox") : null}
            </div>
          </div>
        </div>

        <div className="lightbox-nav lightbox-ui" data-dismiss="">
          <button
            type="button"
            className="icon-button"
            onClick={previous}
            aria-label="Brochure précédente"
            title="Précédente"
          >
            <Icon name="prev" />
          </button>
          <button
            type="button"
            className="icon-button icon-button-accent"
            onClick={next}
            aria-label="Brochure suivante"
            title="Suivante"
          >
            <Icon name="next" />
          </button>
        </div>
      </dialog>

      <footer className="site-footer">
        <span>Senflix</span>
        <span className="footer-rule" aria-hidden="true" />
        <span>Le meilleur du contenu africain.</span>
      </footer>
    </div>
  );
}
