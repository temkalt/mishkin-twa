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
        "3xl": "1.5rem",
        "full": "9999px"
      },
      keyframes: {
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(200%)" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.92)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        pulseRing: {
          "0%": { transform: "scale(1)", opacity: "0.6" },
          "100%": { transform: "scale(2)", opacity: "0" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 8px 0px rgba(58,90,42,0.3)" },
          "50%": { boxShadow: "0 0 20px 4px rgba(58,90,42,0.5)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        flame: {
          "0%, 100%": { transform: "scale(1) translateY(0)", opacity: "0.85" },
          "25%": { transform: "scale(1.06,0.96) translateY(-1px)", opacity: "1" },
          "50%": { transform: "scale(0.96,1.05) translateY(1px)", opacity: "0.9" },
          "75%": { transform: "scale(1.03,0.98) translateY(-1px)", opacity: "1" },
        },
        gradientPan: {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        breathe: {
          "0%, 100%": { transform: "scale(1)", opacity: "0.5" },
          "50%": { transform: "scale(1.12)", opacity: "0.85" },
        },
        sheen: {
          "0%": { transform: "translateX(-120%) skewX(-18deg)" },
          "100%": { transform: "translateX(220%) skewX(-18deg)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.8s ease-in-out infinite",
        fadeInUp: "fadeInUp 0.4s ease-out both",
        scaleIn: "scaleIn 0.35s cubic-bezier(0.22,1,0.36,1) both",
        pulseRing: "pulseRing 0.6s ease-out forwards",
        glowPulse: "glowPulse 2s ease-in-out infinite",
        float: "float 5s ease-in-out infinite",
        flame: "flame 1.6s ease-in-out infinite",
        gradientPan: "gradientPan 8s ease-in-out infinite",
        breathe: "breathe 4s ease-in-out infinite",
        sheen: "sheen 2.4s ease-in-out infinite",
      },
      boxShadow: {
        soft: "0 4px 20px -6px rgba(44,40,36,0.12)",
        lift: "0 12px 40px -12px rgba(44,40,36,0.22)",
        glow: "0 0 24px -4px rgba(58,90,42,0.45)",
        "glow-accent": "0 0 28px -4px rgba(212,163,115,0.5)",
        inset: "inset 0 1px 0 0 rgba(255,255,255,0.4)",
      },
      transitionTimingFunction: {
        "spring": "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
}
