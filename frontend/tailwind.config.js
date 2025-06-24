/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [
    function({ addUtilities }) {
      const newUtilities = {
        '.scrollbar-thin': {
          'scrollbar-width': 'thin',
        },
        '.scrollbar-none': {
          'scrollbar-width': 'none',
          '-ms-overflow-style': 'none',
        },
        '.scrollbar-none::-webkit-scrollbar': {
          'display': 'none',
        },
        '.scrollbar-custom': {
          'scrollbar-width': 'thin',
          'scrollbar-color': 'rgb(168 85 247 / 0.5) rgb(0 0 0 / 0.3)',
        },
        '.scrollbar-custom::-webkit-scrollbar': {
          'width': '8px',
        },
        '.scrollbar-custom::-webkit-scrollbar-track': {
          'background': 'rgb(0 0 0 / 0.3)',
          'border-radius': '4px',
        },
        '.scrollbar-custom::-webkit-scrollbar-thumb': {
          'background': 'linear-gradient(to bottom, rgb(168 85 247 / 0.6), rgb(6 182 212 / 0.6))',
          'border-radius': '4px',
          'border': '1px solid rgb(168 85 247 / 0.3)',
        },
        '.scrollbar-custom::-webkit-scrollbar-thumb:hover': {
          'background': 'linear-gradient(to bottom, rgb(168 85 247 / 0.8), rgb(6 182 212 / 0.8))',
        },
        '.scrollbar-modal': {
          'scrollbar-width': 'thin',
          'scrollbar-color': 'rgb(6 182 212 / 0.6) rgb(0 0 0 / 0.4)',
        },
        '.scrollbar-modal::-webkit-scrollbar': {
          'width': '10px',
        },
        '.scrollbar-modal::-webkit-scrollbar-track': {
          'background': 'rgb(0 0 0 / 0.4)',
          'border-radius': '5px',
        },
        '.scrollbar-modal::-webkit-scrollbar-thumb': {
          'background': 'linear-gradient(to bottom, rgb(6 182 212 / 0.7), rgb(168 85 247 / 0.7))',
          'border-radius': '5px',
          'border': '2px solid rgb(6 182 212 / 0.3)',
        },
        '.scrollbar-modal::-webkit-scrollbar-thumb:hover': {
          'background': 'linear-gradient(to bottom, rgb(6 182 212), rgb(168 85 247))',
        },
      }
      addUtilities(newUtilities)
    }
  ],
}