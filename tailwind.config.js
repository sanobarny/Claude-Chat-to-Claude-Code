/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'neu-base': '#e8e0f0',
        'neu-light': '#ffffff',
        'neu-dark': '#c8bcd8',
        'neu-accent': '#b0a0d0',
        'neu-purple': '#9b8ec4',
        'neu-pink': '#d4a0c8',
        'neu-blue': '#a0b8e0',
        'neu-text': '#5a4a6a',
        'neu-text-light': '#8a7a9a',
        'neu-text-muted': '#a898b8',
      },
    },
  },
  plugins: [],
}
