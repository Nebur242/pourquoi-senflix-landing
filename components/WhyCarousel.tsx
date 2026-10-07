"use client";

import Image from "next/image";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

const brochures = [
  {
    src: "/brochures/01_le_constat.png",
    kicker: "LE CONSTAT",
    alt: "Le constat : beaucoup de vues, peu de revenus ?",
  },
  {
    src: "/brochures/02_le_defi.png",
    kicker: "LE DÉFI",
    alt: "Le défi : vos vues travaillent, mais qui rémunère votre temps ?",
  },
  {
    src: "/brochures/03_contenu_premium.png",
    kicker: "UNE AUTRE PISTE",
    alt: "Une autre piste : et si votre contenu devenait premium ?",
  },
  {
    src: "/brochures/04_reseaux_et_senflix.png",
    kicker: "LES DEUX PEUVENT COEXISTER",
    alt: "Les deux peuvent coexister : ne quittez pas vos réseaux, donnez-leur un nouveau rôle.",
  },
  {
    src: "/brochures/05_mobile_money_et_retraits.png",
    kicker: "DES PAIEMENTS ADAPTÉS",
    alt: "Des paiements adaptés : payer et recevoir à votre façon.",
  },
  {
    src: "/brochures/06_appel_a_decouvrir.png",
    kicker: "LE TALENT EST ICI",
    alt: "Le talent est ici : votre audience est là, offrez-lui plus.",
  },
] as const;

function Brand() {
  return (
    <span className="brand" aria-label="Senflix">
      <Image
        className="brand-mark"
        src="/brand/senflix-icon.png"
        alt=""
        width={23}
        height={25}
        aria-hidden="true"
      />
      <span>SENFLIX</span>
    </span>
  );
}

export function WhyCarousel() {
  const [activeIndex, setActiveIndex] = useState(0);
  const imageRef = useRef<HTMLDivElement>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const active = brochures[activeIndex];

  const goTo = useCallback((index: number) => {
    setActiveIndex((index + brochures.length) % brochures.length);
  }, []);

  const next = useCallback(() => goTo(activeIndex + 1), [activeIndex, goTo]);
  const previous = useCallback(() => goTo(activeIndex - 1), [activeIndex, goTo]);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start) return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;
    if (deltaX < 0) next();
    else previous();
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") next();
      if (event.key === "ArrowLeft") previous();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [next, previous]);

  useEffect(() => {
    imageRef.current?.focus({ preventScroll: true });
  }, [activeIndex]);

  return (
    <main className="site-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="site-header">
        <a href="#contenu" aria-label="Aller au contenu principal">
          <Brand />
        </a>
        <a className="header-link" href="https://www.senflix.app/">
          Découvrir Senflix <span aria-hidden="true">↗</span>
        </a>
      </header>

      <section className="presentation" id="contenu" aria-labelledby="page-title">
        <div className="intro-copy">
          <p className="eyebrow">
            <span className="eyebrow-line" aria-hidden="true" /> Pourquoi Senflix
          </p>
          <h1 id="page-title">
            Le contenu africain <em>mérite plus.</em>
          </h1>
          <p className="intro-description">
            Les audiences sont là. Les créateurs aussi. Senflix imagine une
            nouvelle façon de donner plus de valeur aux histoires qui nous
            ressemblent.
          </p>
          <p className="intro-note">
            Faites défiler les six idées qui ont donné naissance à Senflix.
          </p>
        </div>

        <div className="carousel-column">
          <div
            className="brochure-frame"
            ref={imageRef}
            tabIndex={-1}
            role="group"
            aria-roledescription="diapositive"
            aria-label={`${activeIndex + 1} sur ${brochures.length} : ${active.kicker}`}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={() => {
              pointerStartRef.current = null;
            }}
          >
            <Image
              key={active.src}
              className="brochure-image"
              src={active.src}
              alt={active.alt}
              width={1254}
              height={1254}
              priority={activeIndex === 0}
              sizes="(max-width: 720px) calc(100vw - 32px), (max-width: 1100px) 58vw, 680px"
              draggable={false}
            />
          </div>

          <div className="carousel-controls" aria-label="Contrôles du carrousel">
            <button
              type="button"
              className="circle-button"
              onClick={previous}
              aria-label="Brochure précédente"
            >
              <span aria-hidden="true">←</span>
            </button>

            <div className="progress-block">
              <p className="counter" aria-live="polite">
                <strong>{String(activeIndex + 1).padStart(2, "0")}</strong>
                <span>/ 06</span>
              </p>
              <div className="dots" role="tablist" aria-label="Choisir une brochure">
                {brochures.map((brochure, index) => (
                  <button
                    key={brochure.src}
                    type="button"
                    className={`dot ${index === activeIndex ? "is-active" : ""}`}
                    onClick={() => goTo(index)}
                    role="tab"
                    aria-selected={index === activeIndex}
                    aria-label={`Afficher ${brochure.kicker.toLowerCase()}`}
                  />
                ))}
              </div>
            </div>

            <button
              type="button"
              className="circle-button circle-button-next"
              onClick={next}
              aria-label="Brochure suivante"
            >
              <span aria-hidden="true">→</span>
            </button>
          </div>

          <a className="primary-cta" href="https://www.senflix.app/">
            Découvrir Senflix <span aria-hidden="true">→</span>
          </a>
        </div>
      </section>

      <footer className="site-footer">
        <span>POURQUOI SENFLIX</span>
        <span className="footer-rule" aria-hidden="true" />
        <span>Le meilleur du contenu africain.</span>
      </footer>
    </main>
  );
}
