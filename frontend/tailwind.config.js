/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        vpn: {
          primary: "#d8ed18",
          "primary-hover": "#deef45",
          accent: "#e4f162",
          bg: "#030303",
          "bg-dark": "#000000",
          card: "#0a0a0a",
          input: "#1f1f1f",
          border: "#373737",
          text: "#c1c1c1",
          muted: "#868686",
        },
      },
    },
  },
  plugins: [],
};
