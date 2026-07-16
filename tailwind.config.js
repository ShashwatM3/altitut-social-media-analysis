/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "deep-teal": "#005A6A",
        "darker-teal": "#00424F",
        "bright-coral": "#FF6B6B",
        "light-grey": "#E9ECEF",
        "dark-grey": "#343A40",
        "midnight-gray": "#1F2937",
        "slate-gray": "#4B5563",
        "light-green": "#E6F4EA",
        "vivid-green": "#00B86B",
        "rank-gold": "#FFD700",
        "rank-silver": "#C0C0C0",
        "rank-bronze": "#CD7F32",
        "positive-change": "#28A745",
        "negative-change": "#DC3545",
        maroon: "#800000",
        "maroon-dark": "#5C0000",
      },
      boxShadow: {
        modern: "0 10px 25px rgba(0, 90, 106, 0.1), 0 4px 10px rgba(0, 90, 106, 0.05)",
        "modern-lg": "0 20px 40px rgba(0, 90, 106, 0.12), 0 8px 16px rgba(0, 90, 106, 0.08)",
        "t-md": "0 -4px 6px -1px rgb(0 0 0 / 0.1), 0 -2px 4px -2px rgb(0 0 0 / 0.1)",
        "custom-subtle": "0 4px 12px rgba(0, 0, 0, 0.04)",
      },
      keyframes: {
        "pulse-gentle": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.6", transform: "scale(0.98)" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(30px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        rain: {
          "0%": { transform: "translateY(-10px) rotate(0deg)", opacity: "0" },
          "10%": { opacity: "1" },
          "100%": { transform: "translateY(100vh) rotate(360deg)", opacity: "0.4" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        "home-startup-progress": {
          "0%": { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },
      },
      animation: {
        "pulse-gentle": "pulse-gentle 2s ease-in-out infinite",
        "fade-in-up": "fade-in-up 0.6s ease-out both",
        rain: "rain 3s linear infinite",
        shimmer: "shimmer 1.5s infinite",
        "home-startup-progress": "home-startup-progress 6s linear",
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        display: [
          "var(--font-montserrat)",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
