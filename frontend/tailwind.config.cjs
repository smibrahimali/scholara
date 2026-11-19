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
          border: 'var(--gold-border)',
        },
        success: {
          DEFAULT: 'var(--success)',
          soft: 'var(--success-soft)',
          border: 'var(--success-border)',
        },
        destructive: {
          DEFAULT: 'var(--destructive)',
          soft: 'var(--destructive-soft)',
          border: 'var(--destructive-border)',
          foreground: 'var(--destructive-foreground)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          soft: 'var(--warning-soft)',
          border: 'var(--warning-border)',
        },
        info: {
          DEFAULT: 'var(--info)',
          soft: 'var(--info-soft)',
          border: 'var(--info-border)',
        },
        neutral: {
          DEFAULT: 'var(--neutral-fg)',
          soft: 'var(--neutral-soft)',
          border: 'var(--neutral-border)',
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
          review: 'var(--warning)',
          rejected: 'var(--destructive)',
          muted: 'var(--neutral-fg)',
          info: 'var(--info)',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        serif: ['Lora', 'Georgia', 'serif'],
        display: ['Lora', 'Georgia', 'serif'],
        body: ['DM Sans', 'system-ui', 'sans-serif'],
        playfair: ['Lora', 'Georgia', 'serif'],
      },
      borderRadius: {
        ivy: '1.125rem',
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
