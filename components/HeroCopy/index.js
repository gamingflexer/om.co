import React, { useState } from "react";

// Hero copy on the opening stage, left of Om (above him on phones). On
// phones the paragraph stops after its first half with a "…" that opens the
// rest; from tablet width up it is shown whole.
const HeroCopy = ({ sound }) => {
  const [open, setOpen] = useState(false);
  const handlers = {
    onMouseEnter: () => sound && sound.hover(),
    onPointerDown: () => sound && sound.clickDown(),
    onPointerUp: () => sound && sound.clickUp(),
  };
  return (
    <div className="journey-hero__inner">
      <p className="journey-hero__eyebrow">About Om</p>
      <h2 className="journey-hero__title">I build AI that makes how doctors practice 10x better</h2>
      <p className={`journey-hero__sub${open ? " journey-hero__sub--open" : ""}`}>
        I&apos;m a founder-engineer in Mumbai. Ayu Health started with my mother&apos;s diabetes files, a bag of loose
        papers no specialist could read. Now we turn a doctor&apos;s consultation into a structured record, in their own
        language, without them typing or switching software.{" "}
        <span className="journey-hero__more">
          I&apos;m also VP of AI at FusionCyber, and before that I spent almost two years at IIT Bombay teaching machines to
          read Indian-language manuscripts.
        </span>{" "}
        <button
          type="button"
          className="journey-hero__toggle"
          aria-expanded={open}
          aria-label={open ? "Show less" : "Read more about Om"}
          onClick={() => setOpen((o) => !o)}
          {...handlers}
        >
          {open ? "less" : "…"}
        </button>
      </p>
      <div className="journey-hero__actions">
        <a className="journey-btn journey-btn--primary" href="https://www.ayuapp.com/" target="_blank" rel="noopener noreferrer" {...handlers}>
          See Ayu App <span aria-hidden="true">↗</span>
        </a>
        <a className="journey-btn" href="#end" {...handlers}>
          More about me
        </a>
      </div>
    </div>
  );
};

export default HeroCopy;
