import Seo from "../components/Seo";
import Meadow from "../components/Meadow";

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
  // The page is only the scene: fixed to the viewport, no scrolling.
  return (
    <div className="fixed inset-0 z-10 overflow-hidden" style={{ cursor: "default" }}>
      <Seo
        title={`${data.name} | Founder & CEO, Ayu Health · VP of AI, FusionCyber`}
        path="/"
        type="profile"
        jsonLd={personJsonLd}
      />
      <h1 className="sr-only">
        {data.name}, {data.headerTaglineThree}
      </h1>
      <Meadow className="absolute inset-0" />
    </div>
  );
}
