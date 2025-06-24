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
          'scrollbar-color': 'rgb(168 85 247 / 0.6) transparent',
        },
        '.scrollbar-custom::-webkit-scrollbar': {
          'width': '6px',
        },
        '.scrollbar-custom::-webkit-scrollbar-track': {
          'background': 'transparent',
        },
        '.scrollbar-custom::-webkit-scrollbar-thumb': {
          'background': 'linear-gradient(180deg, rgb(168 85 247 / 0.7), rgb(6 182 212 / 0.7))',
          'border-radius': '3px',
          'transition': 'all 0.2s ease',
        },
        '.scrollbar-custom::-webkit-scrollbar-thumb:hover': {
          'background': 'linear-gradient(180deg, rgb(168 85 247), rgb(6 182 212))',
          'box-shadow': '0 0 6px rgb(168 85 247 / 0.5)',
        },
        '.scrollbar-modal': {
          'scrollbar-width': 'thin',
          'scrollbar-color': 'rgb(6 182 212 / 0.7) transparent',
        },
        '.scrollbar-modal::-webkit-scrollbar': {
          'width': '8px',
        },
        '.scrollbar-modal::-webkit-scrollbar-track': {
          'background': 'transparent',
        },
        '.scrollbar-modal::-webkit-scrollbar-thumb': {
          'background': 'linear-gradient(180deg, rgb(6 182 212 / 0.8), rgb(168 85 247 / 0.8))',
          'border-radius': '4px',
          'border': '1px solid rgb(6 182 212 / 0.2)',
          'transition': 'all 0.2s ease',
        },
        '.scrollbar-modal::-webkit-scrollbar-thumb:hover': {
          'background': 'linear-gradient(180deg, rgb(6 182 212), rgb(168 85 247))',
          'border-color': 'rgb(6 182 212 / 0.5)',
          'box-shadow': '0 0 8px rgb(6 182 212 / 0.4)',
        },
        '.scrollbar-elegant': {
          'scrollbar-width': 'thin',
          'scrollbar-color': 'rgb(168 85 247 / 0.5) transparent',
        },
        '.scrollbar-elegant::-webkit-scrollbar': {
          'width': '4px',
        },
        '.scrollbar-elegant::-webkit-scrollbar-track': {
          'background': 'transparent',
        },
        '.scrollbar-elegant::-webkit-scrollbar-thumb': {
          'background': 'rgb(168 85 247 / 0.6)',
          'border-radius': '2px',
          'transition': 'all 0.2s ease',
        },
        '.scrollbar-elegant::-webkit-scrollbar-thumb:hover': {
          'background': 'rgb(168 85 247 / 0.9)',
          'box-shadow': '0 0 4px rgb(168 85 247 / 0.3)',
        },
      }
      addUtilities(newUtilities)
    }
  ],
}