/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "primary": "#3A5A2A",
        "primary-light": "#6b8c5a",
        "accent": "#D4A373",
        "background-light": "#FDFBF7",
        "background-dark": "#1C1917",
        "pastel-sand": "#EBE5D9",
        "pastel-ivory": "#F4F1EA",
        "warm-accent": "#D4C5B0",
        "text-main": "#2C2824",
        "text-sub": "#8C867D",
      },
      fontFamily: {
        "display": ["Bahnschrift", "Manrope", "sans-serif"],
        "body": ["Manrope", "sans-serif"],
        "bahnschrift": ["Bahnschrift", "Manrope", "sans-serif"],
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "2xl": "1rem",
        "full": "9999px"
      },
      keyframes: {
        shimmer: {
          "100%": {
            transform: "translateX(100%)",
          },
        },
      },
      animation: {
        shimmer: "shimmer 2s infinite",
      },
    },
  },
  plugins: [],
}
