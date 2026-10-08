import { useEffect, useRef, useState } from "react";
import Seo from "../components/Seo";
import Journey, { PAGES } from "../components/Journey";
import JourneyFooter from "../components/JourneyFooter";

// Local Data
import data from "../data/portfolio.json";

const personJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      "@id": `${data.siteUrl}/#person`,
      name: data.name,
      url: `${data.siteUrl}/`,
      jobTitle: "Founder & CEO",
      description: data.siteDescription,
      worksFor: [
        { "@type": "Organization", name: "Ayu Health", url: "https://www.ayuapp.com/" },
        { "@type": "Organization", name: "FusionCyber", url: "https://www.fusioncyber.co/" },
      ],
      alumniOf: [
        { "@type": "CollegeOrUniversity", name: "Pillai College of Engineering" },
        { "@type": "CollegeOrUniversity", name: "Indian Institute of Technology Bombay" },
      ],
      knowsAbout: ["Artificial intelligence", "LLM agents", "OCR for Indian languages", "Speech recognition", "Healthcare AI", "Backend engineering", "Cloud infrastructure"],
      sameAs: data.socials.map((s) => s.link).filter((l) => l.startsWith("https://")),
    },
    {
      "@type": "WebSite",
      "@id": `${data.siteUrl}/#website`,
      url: `${data.siteUrl}/`,
      name: data.name,
      publisher: { "@id": `${data.siteUrl}/#person` },
    },
  ],
};

export default function Home() {
  // The scene is fixed to the viewport; the tall spacer below gives the
  // scroll range that drives the journey. The footer follows in normal flow.
  const spacerRef = useRef(null);
  const [sound, setSound] = useState(null);
  useEffect(() => {
    let api = null;
    import("../components/Journey/sound").then((m) => {
      api = m.createSound();
      setSound(api);
    });
    return () => api && api.dispose();
  }, []);
  return (
    <div className="journey-page" style={{ cursor: "default" }}>
      <Seo
        title={`${data.name} | Founder & CEO, Ayu Health · VP of AI, FusionCyber`}
        path="/"
        type="profile"
        jsonLd={personJsonLd}
      />
      <h1 className="sr-only">
        {data.name}, {data.headerTaglineThree}
      </h1>
      <div className="fixed inset-0 z-10 overflow-hidden bg-black">
        <Journey className="absolute inset-0" spacerRef={spacerRef} sound={sound} />
      </div>
      <div ref={spacerRef} aria-hidden="true" style={{ height: `${PAGES * 100}vh` }} />
      <JourneyFooter sound={sound} />
    </div>
  );
}
