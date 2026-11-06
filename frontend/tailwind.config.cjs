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
        serif: ['var(--font-serif)'],
        sans: ['var(--font-sans)'],
        display: ['var(--font-serif)'],
        body: ['var(--font-sans)'],
        playfair: ['var(--font-serif)'],
        nunito: ['var(--font-sans)'],
      },
      maxWidth: {
        phone: '390px',
      },
      boxShadow: {
        soft: '0 6px 24px -12px color-mix(in oklab, var(--primary) 25%, transparent)',
        phone:
          '0 40px 80px -30px color-mix(in oklab, var(--primary) 45%, transparent)',
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
