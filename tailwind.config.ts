import type { Config } from "tailwindcss";
const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "#f5f7f6",
        foreground: "#17212b",
        primary: { DEFAULT: "#51b411", foreground: "#fff" },
        card: "#fff",
        border: "#dfe6e1",
      },
    },
  },
  plugins: [require("tailwindcss-animate")]
};
export default config;
