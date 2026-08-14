/**
 * @format
 * @type {import('tailwindcss').Config}
 */

module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'selector', // Enable class-based dark mode with .dark class
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          foreground: 'rgb(var(--color-primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'rgb(var(--color-secondary) / <alpha-value>)',
          foreground: 'rgb(var(--color-secondary-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)',
          foreground: 'rgb(var(--color-accent-foreground) / <alpha-value>)',
        },
        ink: {
          primary: 'var(--ink-primary-raw)', // Assuming these might still be hex or handled separately, but let's keep consistent if they are migrated
          secondary: 'var(--ink-secondary-raw)',
          muted: 'var(--ink-muted-raw)',
          error: 'rgb(var(--ink-error-raw) / <alpha-value>)',
          success: 'rgb(var(--ink-success-raw) / <alpha-value>)',
          warning: 'rgb(var(--ink-warning-raw) / <alpha-value>)',
          destructive: 'var(--ink-destructive-raw)',
        },
        muted: {
          DEFAULT: 'var(--ink-muted-raw)',
          foreground: 'var(--ink-muted-foreground)',
        },
        background: {
          DEFAULT: 'var(--background-raw)',
          primary: 'var(--background-raw)',
          secondary: 'var(--background-secondary-raw)',
        },
        foreground: 'var(--ink-primary-raw)',
        panel: {
          DEFAULT: 'var(--panel-raw)',
          secondary: 'var(--panel-secondary-raw)',
          foreground: 'var(--panel-foreground-raw)',
        },
        popover: {
          DEFAULT: 'var(--color-popover)',
          foreground: 'var(--color-popover-foreground)',
        },
        border: 'var(--color-border)',
        input: 'var(--color-input)',
        ring: 'rgb(var(--color-ring) / <alpha-value>)',
        success: {
          DEFAULT: 'rgb(var(--color-success) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'rgb(var(--color-warning) / <alpha-value>)',
        },
        error: {
          DEFAULT: 'rgb(var(--color-error) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'rgb(var(--color-info) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'rgb(var(--color-error) / <alpha-value>)',
          foreground: 'rgb(var(--color-primary-foreground) / <alpha-value>)',
        },
      },
      borderRadius: {
        lg: 'var(--radius-lg)',
        md: 'var(--radius-md)',
        sm: 'var(--radius-sm)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        '3xl': 'var(--radius-3xl)',
        card: 'var(--radius-card)',
      },
      padding: {
        page: 'var(--padding-page)',
        panel: 'var(--padding-panel)',
        card: 'var(--padding-card)',
        sidebar: 'var(--padding-sidebar)',
        section: 'var(--padding-section)',
        'input-x': 'var(--padding-input-x)',
        'input-y': 'var(--padding-input-y)',
        table: 'var(--padding-table)',
      },
      backgroundImage: {
        'primary-gradient': 'var(--primary-gradient)',
      },
    },
  },
  plugins: [
    function ({ addUtilities }) {
      addUtilities({
        '.custom-scrollbar': {
          'scrollbar-width': 'thin',
          'scrollbar-color': 'rgba(0, 0, 0, 0.2) transparent',
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '20px',
            border: '2px solid transparent',
            backgroundClip: 'content-box',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
          },
          '.dark &': {
            'scrollbar-color': 'rgba(255, 255, 255, 0.2) transparent',
          },
          '.dark &::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
          },
          '.dark &::-webkit-scrollbar-thumb:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.3)',
          },
        },
      });
    },
  ],
};
