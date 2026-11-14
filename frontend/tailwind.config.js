/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'text-main': 'var(--text)',
        'text-muted': 'var(--text-muted)',
        primary: 'var(--primary)',
        gain: 'var(--gain)',
        loss: 'var(--loss)',
        warning: 'var(--warning)',
        border: 'var(--border)',
      },
    },
  },
  plugins: [],
};
