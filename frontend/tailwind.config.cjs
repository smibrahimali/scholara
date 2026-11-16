/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        card: {
          DEFAULT: 'var(--card)',
          foreground: 'var(--card-foreground)',
        },
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          foreground: 'var(--secondary-foreground)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          foreground: 'var(--muted-foreground)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          foreground: 'var(--accent-foreground)',
        },
        gold: {
          DEFAULT: 'var(--gold)',
          soft: 'var(--gold-soft)',
          ink: 'var(--gold-ink)',
        },
        success: {
          DEFAULT: 'var(--success)',
          soft: 'var(--success-soft)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          soft: 'var(--destructive-soft)',
          foreground: 'var(--destructive-foreground)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          soft: 'var(--warning-soft)',
        },
        border: 'var(--border)',
        input: 'var(--input)',
        ring: 'var(--ring)',
        desk: 'var(--desk)',
        navy: {
          DEFAULT: 'var(--primary)',
          deep: 'var(--primary)',
          mid: 'var(--primary)',
          soft: 'var(--primary)',
        },
        ivory: {
          DEFAULT: 'var(--background)',
          warm: 'var(--gold-soft)',
        },
        cream: {
          DEFAULT: 'var(--card)',
          soft: 'var(--card)',
          border: 'var(--border)',
        },
        status: {
          verified: 'var(--success)',
          review: 'var(--gold-ink)',
          rejected: 'var(--destructive)',
          muted: 'var(--muted-foreground)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
        display: ['Playfair Display', 'serif'],
        body: ['Inter', 'sans-serif'],
        playfair: ['Playfair Display', 'serif'],
      },
      maxWidth: {
        phone: '390px',
      },
      boxShadow: {
        soft: 'var(--shadow-elev-1)',
        elev1: 'var(--shadow-elev-1)',
        elev2: 'var(--shadow-elev-2)',
        nav: 'var(--shadow-nav)',
        btn: 'var(--shadow-btn)',
        fab: 'var(--shadow-fab)',
        well: 'var(--shadow-inset)',
        xs: '0 1px 2px rgba(27, 33, 44, 0.04)',
        '2xs': '0 1px 1px rgba(27, 33, 44, 0.03)',
        phone:
          '0 24px 48px -28px rgba(27, 33, 44, 0.12)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.4s ease-out both',
      },
    },
  },
  plugins: [],
};
