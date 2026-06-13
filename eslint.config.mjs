import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "temp/**",
      "tsconfig.tsbuildinfo",
    ],
  },
  ...nextCoreWebVitals,
];

export default eslintConfig;
