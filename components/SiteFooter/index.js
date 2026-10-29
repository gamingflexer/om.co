import React, { useEffect, useRef } from "react";
import data from "../../data/portfolio.json";

// Site footer, adapted from Ayu's finalised "F5a · Dusk hills" footer
// (ayu-app-website design/new-website, HEADER-FOOTER-SPEC.md): a Dark Orange
// dusk sky, coral hills that roll slowly left → right in three bands, link
// columns across the top and a giant offwhite wordmark (here "Om Surve" in
// the site's cursive) sinking behind the front hills.
// The hill images load only once the footer is near, and the hills move only
// while it is on screen.

const ICONS = {
  linkedin: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.26 2.37 4.26 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  ),
  github: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.82-.26.82-.57v-2c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.63-5.48 5.92.42.36.81 1.1.81 2.22v3.29c0 .32.21.7.82.58A12 12 0 0 0 12 .3" />
    </svg>
  ),
  email: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 6.5 8.5 6.5 8.5-6.5" />
    </svg>
  ),
};

const social = (re) => data.socials.find((s) => re.test(s.title));

const SiteFooter = ({ sound, credits = false, fade = false }) => {
  const stageRef = useRef(null);
  const linkedin = social(/linkedin/i);
  const github = social(/github/i);
  const kaggle = social(/kaggle/i);
  const email = data.socials.find((s) => s.link.startsWith("mailto:"));
  const handlers = {
    onMouseEnter: () => sound && sound.hover(),
    onPointerDown: () => sound && sound.clickDown(),
    onPointerUp: () => sound && sound.clickUp(),
  };
  const ext = { target: "_blank", rel: "noopener noreferrer" };

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("is-near", "is-in", "is-live");
      return undefined;
    }
    // Load the hill images a screen or so before the footer arrives.
    const near = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add("is-near");
          near.disconnect();
        }
      },
      { rootMargin: "150% 0px" }
    );
    // Reveal the columns once, the first time it is properly in view.
    const reveal = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add("is-in");
          reveal.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    // The hills roll only while some of the footer is on screen.
    const live = new IntersectionObserver(([e]) => el.classList.toggle("is-live", e.isIntersecting));
    near.observe(el);
    reveal.observe(el);
    live.observe(el);
    return () => {
      near.disconnect();
      reveal.disconnect();
      live.disconnect();
    };
  }, []);

  const cols = [
    {
      id: "om",
      title: "Om",
      links: [
        { label: "Blogs", href: "/blogs/" },
        { label: "Resume", href: "/om-surve-resume.pdf", ext: true },
        { label: "Say hello", href: email && email.link },
      ],
    },
    {
      id: "ayu",
      title: "Ayu Health",
      links: [
        { label: "ayuapp.com", href: "https://www.ayuapp.com/", ext: true },
        { label: "Ayu on LinkedIn", href: "https://www.linkedin.com/company/ayuapp/", ext: true },
        { label: "Ayu on Instagram", href: "https://www.instagram.com/ayu_health", ext: true },
      ],
    },
    {
      id: "writing",
      title: "Latest writing",
      links: data.writing.slice(0, 3).map((p) => ({ label: p.title, href: p.url })),
    },
    {
      id: "elsewhere",
      title: "Elsewhere",
      links: [
        linkedin && { label: "LinkedIn", href: linkedin.link, ext: true },
        github && { label: "GitHub", href: github.link, ext: true },
        kaggle && { label: "Kaggle", href: kaggle.link, ext: true },
      ].filter(Boolean),
    },
  ];

  return (
    <footer id="end" className={`site-foot${fade ? " site-foot--fade" : ""}`}>
      <div ref={stageRef} className="site-foot__stage">
        <div className="site-foot__band site-foot__band--back" aria-hidden="true" />
        <div className="site-foot__band site-foot__band--mid" aria-hidden="true" />
        <div className="site-foot__top">
          <div className="site-foot__about site-foot__reveal" style={{ "--i": 0 }}>
            <p className="site-foot__lede">
              Founder &amp; CEO of Ayu Health: the AI layer that turns a doctor&apos;s consultation into a structured
              record, in the doctor&apos;s own language.
            </p>
            <p className="site-foot__sub">
              VP of AI at FusionCyber. Before that, ML research on Indian-language OCR at IIT Bombay.
            </p>
            <div className="site-foot__actions">
              <a className="site-foot__btn site-foot__btn--primary" href="https://www.ayuapp.com/" {...ext} {...handlers}>
                See Ayu App <span aria-hidden="true">↗</span>
              </a>
              <a className="site-foot__btn" href="/om-surve-resume.pdf" {...ext} {...handlers}>
                Resume
              </a>
            </div>
          </div>
          {cols.map((c, i) => (
            <nav key={c.id} aria-label={c.title} className={`site-foot__col site-foot__col--${c.id} site-foot__reveal`} style={{ "--i": i + 1 }}>
              <h2>{c.title}</h2>
              <ul>
                {c.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} {...(l.ext ? ext : {})} {...handlers}>
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <p className="site-foot__mark" aria-hidden="true">
          <span>{data.name}</span>
        </p>
        <div className="site-foot__band site-foot__band--front" aria-hidden="true" />
        <div className="site-foot__bottom">
          <span className="site-foot__copy">© {new Date().getFullYear()} {data.name}</span>
          {credits && (
            <span className="site-foot__credits">
              Imagery: NASA Blue Marble, Black Marble and LRO Moon · Milky Way panorama ESO/S. Brunier (CC BY 4.0) · Yale Bright Star Catalogue
            </span>
          )}
          <span className="site-foot__spacer" />
          <div className="site-foot__soc">
            {linkedin && (
              <a href={linkedin.link} aria-label="LinkedIn" title="LinkedIn" {...ext} {...handlers}>
                {ICONS.linkedin}
              </a>
            )}
            {github && (
              <a href={github.link} aria-label="GitHub" title="GitHub" {...ext} {...handlers}>
                {ICONS.github}
              </a>
            )}
            {email && (
              <a href={email.link} aria-label="Email" title="Email" {...handlers}>
                {ICONS.email}
              </a>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
