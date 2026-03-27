import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        violet: { DEFAULT: "#3B28CC", light: "#EDE9FF", dark: "#2A1D99" },
        cobalt: { DEFAULT: "#1E3A5F", light: "#2E5A8F" },
        grey: { bg: "#F4F4F8", border: "#E5E5EA" },
      },
      fontFamily: {
        sans: ["DM Sans", "system-ui", "sans-serif"],
        display: ["Syne", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
