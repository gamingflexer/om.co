import { Hind, JetBrains_Mono } from "next/font/google";
import "../styles/globals.css";
import "../styles/markdown.css";
import { ThemeProvider } from "next-themes";

// Self-hosted via next/font. Hind has no variable version, so only the three
// weights the site uses are loaded; JetBrains Mono is a variable font.
const hind = Hind({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
});

const App = ({ Component, pageProps }) => {
  return (
    <ThemeProvider>
      <style jsx global>{`
        :root {
          --font-hind: ${hind.style.fontFamily};
          --font-jetbrains: ${jetbrainsMono.style.fontFamily};
        }
      `}</style>
      <Component {...pageProps} />
    </ThemeProvider>
  );
};

export default App;
