/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14213D",     // texte, en-tête
        paper: "#EEF0F3",   // fond de l'application
        swatch: "#F2F2F2",  // fond des photos (cf. BG dans lib/ants.js)
        action: "#2338C9",  // actions principales
        ok: "#15803D",
        caution: "#B45309",
        stop: "#C62828",
      },
    },
  },
  plugins: [],
};
