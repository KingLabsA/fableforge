/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0a0a0f',
          secondary: '#111118',
          tertiary: '#1a1a24',
          hover: '#22222e',
        },
        border: {
          DEFAULT: '#2a2a3a',
          subtle: '#1e1e2e',
          accent: '#6366f1',
        },
        text: {
          primary: '#e4e4ef',
          secondary: '#9898b0',
          muted: '#5a5a72',
        },
        accent: {
          DEFAULT: '#6366f1',
          hover: '#7c7ef7',
          muted: '#4f46e5',
        },
        step: {
          user: '#22d3ee',
          assistant: '#a78bfa',
          tool: '#f59e0b',
          error: '#ef4444',
          system: '#6366f1',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
