import { useRef, useState, useEffect } from "react";
import Header from "../components/Header";
import ServiceCard from "../components/ServiceCard";
import Socials from "../components/Socials";
import WorkCard from "../components/WorkCard";
import { useIsomorphicLayoutEffect } from "../utils";
import { stagger } from "../animations";
import Footer from "../components/Footer";
import Head from "next/head";
import Button from "../components/Button";
import Link from "next/link";
import Cursor from "../components/Cursor";
import LegoBackground from "../components/LegoBackground";

// Local Data
import data from "../data/portfolio.json";

export default function Home() {
  // Ref
  const workRef = useRef();
  const aboutRef = useRef();
  const textOne = useRef();
  const textTwo = useRef();
  const textThree = useRef();
  const textFour = useRef();

  // State for terminal boot animation
  const [bootComplete, setBootComplete] = useState(false);
  const [bootText, setBootText] = useState("");

  useEffect(() => {
    const bootSequence = [
      "INITIALIZING SYSTEM...",
      "LOADING MODULES...",
      "MOUNTING FILESYSTEMS...",
      "> WELCOME TO OM.CO",
    ];

    let index = 0;
    const bootInterval = setInterval(() => {
      if (index < bootSequence.length) {
        setBootText(bootSequence[index]);
        index++;
      } else {
        clearInterval(bootInterval);
        setTimeout(() => setBootComplete(true), 500);
      }
    }, 300);

    return () => clearInterval(bootInterval);
  }, []);

  // Handling Scroll
  const handleWorkScroll = () => {
    window.scrollTo({
      top: workRef.current.offsetTop,
      left: 0,
      behavior: "smooth",
    });
  };

  const handleAboutScroll = () => {
    window.scrollTo({
      top: aboutRef.current.offsetTop,
      left: 0,
      behavior: "smooth",
    });
  };

  useIsomorphicLayoutEffect(() => {
    stagger(
      [textOne.current, textTwo.current, textThree.current, textFour.current],
      { y: 40, x: -10, transform: "scale(0.95) skew(10deg)" },
      { y: 0, x: 0, transform: "scale(1)" }
    );
  }, []);

  return (
    <div className="relative min-h-screen">
      <Cursor />
      <LegoBackground />

      <Head>
        <title>{data.name}</title>
      </Head>

      {/* Terminal boot screen */}
      {!bootComplete && (
        <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
          <div className="font-mono text-green-400 text-xl animate-pulse">
            {bootText}<span className="animate-pulse">_</span>
          </div>
        </div>
      )}

      {/* This button should not go into production */}
      {process.env.NODE_ENV === "development" && (
        <div className="fixed bottom-5 right-5 z-50">
          <Link href="/edit" legacyBehavior>
            <a>
              <Button type="primary">Edit Data</Button>
            </a>
          </Link>
        </div>
      )}

      <div className="relative z-10 container mx-auto mb-10 px-4">
        <Header
          handleWorkScroll={handleWorkScroll}
          handleAboutScroll={handleAboutScroll}
        />

        {/* Hero Section with glitch effect */}
        <div className="laptop:mt-20 mt-10">
          <div className="mt-5">
            <h1
              ref={textOne}
              className="text-3xl tablet:text-5xl laptop:text-6xl laptopl:text-7xl p-1 tablet:p-2 font-bold w-4/5 mob:w-full laptop:w-4/5 font-mono"
            >
              {data.headerTaglineOne}
            </h1>
            <h1
              ref={textTwo}
              className="text-3xl tablet:text-5xl laptop:text-6xl laptopl:text-7xl p-1 tablet:p-2 font-bold w-full laptop:w-4/5 font-mono bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent"
            >
              {data.headerTaglineTwo}
            </h1>
            <h1
              ref={textThree}
              className="text-2xl tablet:text-4xl laptop:text-5xl laptopl:text-6xl p-1 tablet:p-2 font-bold w-full laptop:w-4/5 font-mono text-cyan-400"
            >
              {data.headerTaglineThree}
            </h1>
            <h1
              ref={textFour}
              className="text-lg tablet:text-2xl laptop:text-3xl laptopl:text-4xl p-1 tablet:p-2 w-full laptop:w-4/5 text-slate-600"
            >
              {data.headerTaglineFour}
            </h1>

            {/* Current role badge */}
            {data.currentRole && (
              <div className="mt-8 inline-block">
                <div className="px-6 py-3 rounded-full bg-gradient-to-r from-cyan-500/20 to-purple-500/20 backdrop-blur-md border border-cyan-500/50 font-mono text-slate-900 font-bold">
                  <span className="text-green-600">&gt;</span> {data.currentRole}
                  <span className="ml-2 animate-pulse">_</span>
                </div>
              </div>
            )}
          </div>

          <Socials className="mt-8 laptop:mt-10" />
        </div>

        {/* Work Section */}
        <div className="mt-20 laptop:mt-40 p-2 laptop:p-0" ref={workRef}>
          <h1 className="text-4xl laptop:text-5xl font-bold font-mono mb-8 text-slate-900">
            <span className="text-green-600">&gt;</span> Work<span className="animate-pulse">_</span>
          </h1>
          <div className="mt-10 grid grid-cols-1 tablet:grid-cols-2 gap-8">
            {data.projects.map((project) => (
              <WorkCard
                key={project.id}
                img={project.imageSrc}
                name={project.title}
                description={project.description}
                tech={project.tech}
                onClick={() => window.open(project.url)}
              />
            ))}
          </div>
        </div>

        {/* Experience Section with Timeline */}
        <div className="mt-20 laptop:mt-40 p-2 laptop:p-0">
          <h1 className="text-4xl laptop:text-5xl font-bold font-mono mb-12 text-slate-900">
            <span className="text-green-600">&gt;</span> Experience<span className="animate-pulse">_</span>
          </h1>
          <div className="mt-10">
            {data.services.map((service, index) => (
              <ServiceCard
                key={index}
                name={service.title}
                description={service.description}
                dates={service.dates}
                location={service.location}
                logo={service.logo}
              />
            ))}
          </div>
        </div>

        {/* About Section */}
        <div className="mt-20 laptop:mt-40 p-2 laptop:p-0" ref={aboutRef}>
          <h1 className="text-4xl laptop:text-5xl font-bold font-mono mb-8 text-slate-900">
            <span className="text-green-600">&gt;</span> About<span className="animate-pulse">_</span>
          </h1>
          <div className="mt-10 p-8 rounded-2xl backdrop-blur-md bg-white/80 border border-cyan-500/30">
            <p className="text-xl laptop:text-2xl leading-relaxed text-slate-700">
              {data.aboutpara}
            </p>
          </div>
        </div>

        <Footer />
      </div>
    </div>
  );
}
