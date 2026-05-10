/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Minerva Core Palette
        navy:        '#0A2342',
        'navy-lt':   '#1A3A5C',
        blue:        '#4A7FA5',
        'blue-lt':   '#D6E8F5',
        sage:        '#4A8C6F',
        'sage-lt':   '#D6EDE4',
        amber:       '#B07D2A',
        'amber-lt':  '#FEF6E4',
        rose:        '#A05252',
        'rose-lt':   '#F5E0E0',
        teal:        '#2A7D8C',
        'teal-lt':   '#D6EEF2',
        // App Shell
        alabaster:   '#F8F9FA',
        surface:     '#FFFFFF',
        border:      '#E2E8F0',
        muted:       '#6B7A8D',
        slate:       '#4A5568',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'card':   '0 1px 3px rgba(10,35,66,0.08), 0 1px 2px rgba(10,35,66,0.04)',
        'card-md':'0 4px 12px rgba(10,35,66,0.10)',
        'fab':    '0 4px 20px rgba(10,35,66,0.25)',
      },
      borderRadius: { 'xl': '12px', '2xl': '16px', '3xl': '20px' }
    }
  },
  plugins: []
}
