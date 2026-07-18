/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: "var(--bg-primary)",
          secondary: "var(--bg-secondary)",
          tertiary: "var(--bg-tertiary)",
          card: "var(--bg-card)",
          "card-hover": "var(--bg-card-hover)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          bright: "var(--accent-bright)",
          muted: "var(--accent-muted)",
          surface: "var(--accent-surface)",
          glow: "var(--accent-glow)",
          subtle: "var(--accent-subtle)",
        },
        positive: {
          DEFAULT: "var(--positive)",
          bg: "var(--positive-bg)",
          glow: "var(--positive-glow)",
          dim: "var(--positive-dim)",
        },
        negative: {
          DEFAULT: "var(--negative)",
          bg: "var(--negative-bg)",
          glow: "var(--negative-glow)",
          dim: "var(--negative-dim)",
        },
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
        },
        border: {
          DEFAULT: "var(--border)",
          accent: "var(--border-accent)",
          light: "var(--border-light)",
        },
      },
      transitionTimingFunction: {
        'out-expo': 'var(--ease-out-expo)',
        'spring': 'var(--ease-spring)',
        'standard': 'var(--ease-standard)',
      },
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'sans-serif'],
        mono: ['Space Grotesk', 'monospace'],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      }
    },
  },
  plugins: [],
}

