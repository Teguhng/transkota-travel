/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './views/**/*.ejs',
    './public/**/*.js'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"Chivo Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        paper: {
          DEFAULT: 'var(--color-paper)',
          2: 'var(--color-paper-2)',
          3: 'var(--color-paper-3)',
        },
        ink: {
          DEFAULT: 'var(--color-ink)',
          2: 'var(--color-ink-2)',
          rule: 'var(--color-ink-rule)',
        },
        muted: 'var(--color-muted)',
        rule: 'var(--color-rule)',
        accent: {
          DEFAULT: 'var(--color-accent)',
          2: 'var(--color-accent-2)',
          ink: 'var(--color-accent-ink)',
        },
        focus: 'var(--color-focus)',
      },
      borderWidth: {
        bar: 'var(--rule-bar)',
        hair: 'var(--rule-hair)',
      },
      borderRadius: {
        card: 'var(--radius-card)',
        pill: 'var(--radius-pill)',
      }
    }
  },
  plugins: []
};
