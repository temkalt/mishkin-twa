/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // Тёмная тема сознательно не поддерживается: магазин зафиксирован в светлой.
  // Токены и классы `dark:` убраны, чтобы не оставлять полуработающий режим.
  theme: {
    extend: {
      spacing: {
        // Безопасные зоны из index.css. `pt-safe-top` — для всего, что прижато
        // к верху: под вырезом iPhone и под плавающими кнопками Telegram.
        "safe-top": "var(--app-top)",
        "safe-bottom": "var(--safe-bottom)",
        // Запас под нижние панели, чтобы последняя карточка списка не уезжала
        // под них: `nav-safe` — под таб-бар, `bar-safe` — под свою кнопку.
        "nav-safe": "calc(6.5rem + var(--safe-bottom))",
        "bar-safe": "calc(7.5rem + var(--safe-bottom))",
        "bar-safe-lg": "calc(10rem + var(--safe-bottom))",
      },
      // Один порядок наложения на весь проект. Раньше значения выставлялись
      // на глаз (z-50 у таб-бара и у модалок одновременно), и клики уходили
      // не тому элементу.
      zIndex: {
        raised: "10",
        header: "30",
        "action-bar": "40",
        nav: "45",
        sheet: "60",
        modal: "70",
        splash: "90",
      },
      colors: {
        "primary": "#3A5A2A",
        "primary-light": "#6b8c5a",
        "primary-dark": "#2C4620",
        "accent": "#D4A373",
        "accent-deep": "#B07E4C",
        "background-light": "#FDFBF7",
        "surface": "#FFFFFF",
        "pastel-sand": "#EBE5D9",
        "pastel-ivory": "#F4F1EA",
        "warm-accent": "#D4C5B0",
        "line": "#E6DFD2",
        "text-main": "#2C2824",
        // Затемнён с #8C867D до 4.6:1 на песочном фоне — прежний не проходил WCAG AA.
        "text-sub": "#736D63",
        "text-muted": "#969086",
        "danger": "#B4453C",
        "success": "#3F7D4E",
      },
      fontFamily: {
        // Jost — геометрический гротеск в духе Bahnschrift, но загружается на
        // всех устройствах (Bahnschrift есть только в Windows, на телефонах
        // заголовки молча падали в Manrope).
        "display": ["Jost", "Bahnschrift", "Manrope", "sans-serif"],
        "body": ["Manrope", "system-ui", "sans-serif"],
      },
      fontSize: {
        // Нижняя граница подписей — 11px. Прежние 9–10px не читались.
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.02em" }],
      },
      borderRadius: {
        "DEFAULT": "0.25rem",
        "lg": "0.5rem",
        "xl": "0.75rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
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
        spin: {
          to: { transform: "rotate(360deg)" },
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
        gradientPan: "gradientPan 14s ease-in-out infinite",
        breathe: "breathe 4s ease-in-out infinite",
        sheen: "sheen 2.4s ease-in-out infinite",
        "spin-slow": "spin 1s linear infinite",
      },
      boxShadow: {
        soft: "0 4px 20px -6px rgba(44,40,36,0.12)",
        lift: "0 12px 40px -12px rgba(44,40,36,0.22)",
        glow: "0 0 24px -4px rgba(58,90,42,0.45)",
        "glow-accent": "0 0 28px -4px rgba(212,163,115,0.5)",
        inset: "inset 0 1px 0 0 rgba(255,255,255,0.4)",
        sheet: "0 -18px 60px -20px rgba(44,40,36,0.35)",
      },
      transitionTimingFunction: {
        "spring": "cubic-bezier(0.22, 1, 0.36, 1)",
      },
    },
  },
  plugins: [],
}
