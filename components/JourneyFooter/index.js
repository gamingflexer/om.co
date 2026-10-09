import React from "react";
import data from "../../data/portfolio.json";

// End of the journey: two lines about Om, the Ayu Health link, the resume and
// social links. Sits in normal flow after the scroll spacer, over the meadow.
const JourneyFooter = ({ sound }) => {
  const socials = data.socials.filter((s) => /github|linkedin|kaggle|email/i.test(s.title));
  const hover = () => sound && sound.hover();
  const down = () => sound && sound.clickDown();
  const up = () => sound && sound.clickUp();
  const handlers = { onMouseEnter: hover, onPointerDown: down, onPointerUp: up };
  return (
    <footer id="end" className="journey-footer relative z-20 text-white">
      <div className="mx-auto w-full max-w-5xl px-6 pb-20 pt-16 tablet:px-10 tablet:pb-10">
        <p className="journey-footer__name">{data.name}</p>
        <p className="journey-footer__about">
          Founder &amp; CEO of Ayu Health, building the AI layer that turns a doctor&apos;s consultation into a structured record, in the doctor&apos;s own language.
          <br />
          VP of AI at FusionCyber. Backend, cloud and AI engineer; before that, ML research on Indian-language OCR at IIT Bombay.
        </p>
        <div className="journey-footer__actions">
          <a className="journey-btn journey-btn--primary" href="https://www.ayuapp.com/" target="_blank" rel="noopener noreferrer" {...handlers}>
            Ayu Health <span aria-hidden="true">↗</span>
          </a>
          <a className="journey-btn" href="/om-surve-resume.pdf" target="_blank" rel="noopener noreferrer" {...handlers}>
            Resume
          </a>
        </div>
        <div className="journey-footer__row">
          <nav aria-label="Social links" className="journey-footer__socials">
            {socials.map((s) => (
              <a key={s.id} href={s.link} target={s.link.startsWith("mailto:") ? undefined : "_blank"} rel="noopener noreferrer" {...handlers}>
                {s.title === "Linkedin" ? "LinkedIn" : s.title === "Github" ? "GitHub" : s.title}
              </a>
            ))}
          </nav>
          <p className="journey-footer__credits">
            Imagery: NASA Blue Marble, Black Marble and LRO Moon · Milky Way panorama ESO/S. Brunier (CC BY 4.0) · Yale Bright Star Catalogue
          </p>
        </div>
      </div>
    </footer>
  );
};

export default JourneyFooter;
