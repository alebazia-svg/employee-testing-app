import type { Config } from "tailwindcss";
const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: { extend: { colors: { background: "#f8faf8", foreground: "#1f2933", primary: { DEFAULT: "#16a34a", foreground: "#fff" }, card: "#fff", border: "#e5e7eb" } } },
  plugins: [require("tailwindcss-animate")]
};
export default config;
