import { Cormorant_Upright, Dancing_Script, Fraunces, Inter, Mansalva } from "next/font/google";
import "../styles/globals.css";
import "../styles/markdown.css";
import { ThemeProvider } from "next-themes";

// Self-hosted variable fonts via next/font: Fraunces for display text (the
// closest open alternative to the serif on tengilemalamala.com, which uses
// the commercial PP Fragment) and Inter for body copy, as that site does.
const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz", "SOFT", "WONK"],
});
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});
// Cursive wordmark ("Om Surve") in the journey's top bar.
const script = Dancing_Script({
  subsets: ["latin"],
  display: "swap",
});
// Hero "About Om" block, after about.senbuzy.com: Mansalva for the brush
// title, Cormorant Upright for the paragraph. Neither has a variable build,
// so only the one weight each that the hero uses is loaded.
const hand = Mansalva({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});
const upright = Cormorant_Upright({
  subsets: ["latin"],
  weight: "500",
  display: "swap",
});

const App = ({ Component, pageProps }) => {
  return (
    <ThemeProvider>
      <style jsx global>{`
        :root {
          --font-display: ${fraunces.style.fontFamily};
          --font-body: ${inter.style.fontFamily};
          --font-script: ${script.style.fontFamily};
          --font-hand: ${hand.style.fontFamily};
          --font-upright: ${upright.style.fontFamily};
          --font-hind: ${inter.style.fontFamily};
          --font-jetbrains: ${inter.style.fontFamily};
        }
      `}</style>
      <Component {...pageProps} />
    </ThemeProvider>
  );
};

export default App;
