import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        'custom-black': '#101010',
        'custom-darkest': '#1f1e1d',
        'custom-darker': '#262624',
        'custom-dark': '#30302e',
        'custom-brown': '#7d4a38',
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)'],
        mono: ['var(--font-geist-mono)'],
        poppins: ['var(--font-poppins)'],
      },
      cursor: {
        'uncursored': 'url(/dartivo_cursor.png) 16 16, auto',
      },
      keyframes: {
        'subtle-orbit': {
          '0%': { transform: 'translate(0, 0)' },
          '20%': { transform: 'translate(12px, 6px)' },
          '40%': { transform: 'translate(18px, -6px)' },
          '60%': { transform: 'translate(6px, -12px)' },
          '80%': { transform: 'translate(-12px, -6px)' },
          '100%': { transform: 'translate(0, 0)' },
        },
        'very-subtle-orbit': {
          '0%': { transform: 'translate(0, 0)' },
          '20%': { transform: 'translate(2px, 1px)' },
          '40%': { transform: 'translate(3px, -1px)' },
          '60%': { transform: 'translate(1px, -2px)' },
          '80%': { transform: 'translate(-2px, -1px)' },
          '100%': { transform: 'translate(0, 0)' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'subtle-orbit': 'subtle-orbit 5s linear infinite',
        'very-subtle-orbit': 'very-subtle-orbit 5s linear infinite',
        'spin-slow': 'spin-slow 3s linear infinite',
      },
    },
  },
  plugins: [],
};
export default config; 