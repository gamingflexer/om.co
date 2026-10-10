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
      <p className="journey-hero__eyebrow">{data.headerTaglineOne} I&apos;m Om</p>
      <h2 className="journey-hero__title">
        Building AI for
        <br />
        Indian healthcare,
        <br />
        one consult at a time
      </h2>
      <p className="journey-hero__sub">
        Founder &amp; CEO of Ayu Health and VP of AI at FusionCyber. Backend, cloud and AI engineer; I turn a doctor&apos;s
        consultation into a structured record, in the doctor&apos;s own language.
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
