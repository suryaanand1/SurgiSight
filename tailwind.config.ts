import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b1f2a",
        teal: "#087f7a",
        mist: "#eaf5f3",
      },
      boxShadow: {
        soft: "0 24px 70px rgba(15, 52, 64, 0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
