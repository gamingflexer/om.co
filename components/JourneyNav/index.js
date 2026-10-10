import React from "react";
import Link from "next/link";
import data from "../../data/portfolio.json";

// Fixed top bar over the journey: "Om Surve" in cursive on the left, icon
// links (resume, blogs, Ayu Health, LinkedIn) and a "Say hello" button.
const ICONS = {
  resume: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </svg>
  ),
  blogs: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.26 2.37 4.26 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z" />
    </svg>
  ),
};

const JourneyNav = ({ sound }) => {
  const email = data.socials.find((s) => s.link.startsWith("mailto:"));
  const linkedin = data.socials.find((s) => /linkedin/i.test(s.title));
  const handlers = {
    onMouseEnter: () => sound && sound.hover(),
    onPointerDown: () => sound && sound.clickDown(),
    onPointerUp: () => sound && sound.clickUp(),
  };
  const links = [
    { id: "resume", label: "Resume", href: "/om-surve-resume.pdf", icon: ICONS.resume, external: true },
    { id: "blogs", label: "Blogs", href: data.writing[0].url, icon: ICONS.blogs },
    // eslint-disable-next-line @next/next/no-img-element -- static export, no image optimisation
    { id: "ayu", label: "Ayu Health", href: "https://www.ayuapp.com/", icon: <img src="/images/ayu-logo.svg" alt="" width="22" height="20" />, external: true },
    linkedin && { id: "linkedin", label: "LinkedIn", href: linkedin.link, icon: ICONS.linkedin, external: true },
  ].filter(Boolean);
  return (
    <header className="journey-nav">
      <Link href="/" className="journey-nav__brand" {...handlers}>
        {data.name}
      </Link>
      <nav aria-label="Primary" className="journey-nav__links">
        {links.map((l) => (
          <a
            key={l.id}
            href={l.href}
            className={`journey-nav__icon journey-nav__icon--${l.id}`}
            aria-label={l.label}
            title={l.label}
            target={l.external ? "_blank" : undefined}
            rel={l.external ? "noopener noreferrer" : undefined}
            {...handlers}
          >
            {l.icon}
          </a>
        ))}
      </nav>
      {email && (
        <a className="journey-nav__cta" href={email.link} {...handlers}>
          Say hello
        </a>
      )}
    </header>
  );
};

export default JourneyNav;
