import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        cyber: {
          black: '#0a0a0a',
          dark: '#111111',
          panel: '#161616',
          card: '#1a1a1a',
          border: '#2a2a2a',
          muted: '#333333',
          green: '#00ff87',
          cyan: '#00e5ff',
          blue: '#0070f3',
          red: '#ff4444',
          yellow: '#ffcc00',
          text: '#e0e0e0',
          dim: '#888888',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow-green': '0 0 12px rgba(0, 255, 135, 0.3)',
        'glow-cyan': '0 0 12px rgba(0, 229, 255, 0.3)',
        'glow-red': '0 0 12px rgba(255, 68, 68, 0.3)',
        'glow-sm': '0 0 6px rgba(0, 255, 135, 0.15)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
