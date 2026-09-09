import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "gridmates-player-1": "var(--gridmates-player-1)",
        "gridmates-player-2": "var(--gridmates-player-2)",
        "gridmates-player-3": "var(--gridmates-player-3)",
        "gridmates-player-4": "var(--gridmates-player-4)",
        "gridmates-player-5": "var(--gridmates-player-5)",
        "gridmates-player-6": "var(--gridmates-player-6)",
        "gridmates-player-7": "var(--gridmates-player-7)",
        "gridmates-player-8": "var(--gridmates-player-8)",
      },
    },
  },
  plugins: [],
};

export default config;
