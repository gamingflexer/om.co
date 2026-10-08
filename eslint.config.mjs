import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextVitals,
  {
    // React Compiler rules added in eslint-plugin-react-hooks v7 flag older
    // patterns (setState in mount effects, mutating state copies in the
    // dev-only /edit page). Kept visible as warnings until those are refactored.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
    },
  },
  {
    ignores: [
      ".next/**",
      "out/**",
      "node_modules/**",
      "react-portfolio-template-main/**",
      "public/**",
    ],
  },
];

export default eslintConfig;
