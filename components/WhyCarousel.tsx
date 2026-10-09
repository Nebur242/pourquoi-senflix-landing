"use client";

import Image from "next/image";
import type {
  CSSProperties,
  FocusEvent as ReactFocusEvent,
  PointerEvent as ReactPointerEvent,
  SyntheticEvent,
} from "react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/** Time each brochure stays on screen while the slideshow plays. */
const AUTOPLAY_MS = 8000;
/** Minimum horizontal travel (px) before a pointer gesture counts as a swipe. */
const SWIPE_THRESHOLD = 48;
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

function Icon({ name }: { name: "prev" | "next" | "play" | "pause" | "arrow" | "external" }) {
  const paths: Record<typeof name, string> = {
    prev: "M15 5l-7 7 7 7",
    next: "M9 5l7 7-7 7",
    play: "M8 5.5v13l10.5-6.5z",
    pause: "M8 5h3v14H8zM13 5h3v14h-3z",
    arrow: "M4 12h15M13 6l6 6-6 6",
    external: "M7 17L17 7M9 7h8v8",
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

  const loadedRef = useRef<boolean[]>(brochures.map(() => false));
  const activeIndexRef = useRef(0);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  const prefersReducedMotion = usePrefersReducedMotion();
  const isPageHidden = usePageHidden();

  const isPlaying =
    playPreference === "on" || (playPreference === "auto" && !prefersReducedMotion);
  const isWaitingForImage = shownIndex !== activeIndex;
  const isTimerRunning =
    isPlaying && !isHovered && !hasFocusVisible && !isPointerDown && !isPageHidden && !isWaitingForImage;

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

  /* Swipe */
  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    setIsPointerDown(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    setIsPointerDown(false);
    if (!start) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;
    if (deltaX < 0) next();
    else previous();
  }

  function handlePointerCancel() {
    pointerStartRef.current = null;
    setIsPointerDown(false);
  }

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

  const renderLayers = (variant: "slide" | "glow") =>
    brochures.map((brochure, index) => {
      if (!mounted[index]) return null;
      const isShown = index === shownIndex;
      return (
        <div
          key={brochure.src}
          className={`${variant}${isShown ? " is-shown" : ""}`}
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
            fetchPriority={index === 0 ? "high" : "low"}
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
            className={`frame${isWaitingForImage ? " is-loading" : ""}`}
            role="group"
            aria-roledescription="diapositive"
            aria-label={`${activeIndex + 1} sur ${total} : ${active.kicker}`}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
          >
            {renderLayers("slide")}
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

      <footer className="site-footer">
        <span>Senflix</span>
        <span className="footer-rule" aria-hidden="true" />
        <span>Le meilleur du contenu africain.</span>
      </footer>
    </div>
  );
}
