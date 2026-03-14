/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        darwin: {
          bg: '#0a0a0f',
          card: '#12121a',
          border: '#1e1e2e',
          accent: '#22c55e',
          danger: '#ef4444',
          warning: '#eab308',
          text: '#e2e8f0',
          muted: '#64748b',
        },
      },
    },
  },
  plugins: [],
};
