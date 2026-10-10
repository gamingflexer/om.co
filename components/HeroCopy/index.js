import React from "react";
import data from "../../data/portfolio.json";

// Hero copy on the opening stage, left of Om (above him on phones).
const HeroCopy = ({ sound }) => {
  const handlers = {
    onMouseEnter: () => sound && sound.hover(),
    onPointerDown: () => sound && sound.clickDown(),
    onPointerUp: () => sound && sound.clickUp(),
  };
  return (
    <div className="journey-hero__inner">
      <p className="journey-hero__eyebrow">{data.headerTaglineOne} I&apos;m Om Surve</p>
      <h2 className="journey-hero__title">I build AI that fits how doctors already work</h2>
      <p className="journey-hero__sub">
        I&apos;m a founder-engineer in Bengaluru. Ayu Health started with my mother&apos;s diabetes files, a bag of loose
        papers no specialist could read. Now we turn a doctor&apos;s consultation into a structured record, in their own
        language, without them typing or switching software. I&apos;m also VP of AI at FusionCyber, and before that I spent
        almost two years at IIT Bombay teaching machines to read Indian-language manuscripts.
      </p>
      <div className="journey-hero__actions">
        <a className="journey-btn journey-btn--primary" href="https://www.ayuapp.com/" target="_blank" rel="noopener noreferrer" {...handlers}>
          See Ayu Health <span aria-hidden="true">↗</span>
        </a>
        <a className="journey-btn" href="#end" {...handlers}>
          More about me
        </a>
      </div>
    </div>
  );
};

export default HeroCopy;
