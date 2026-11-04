/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // --- Design System Brand Tokens ---
        brand: '#C2761A',       // primary amber accent
        'brand-hover': '#AC6412',
        'brand-active': '#96540B',
        'brand-tint': '#FFF8ED',  // active nav background
        canvas: '#FAF8F3',      // page / workspace background
        card: '#FFFFFF',        // card surface
        border: '#E4DFD3',      // structural borders
        ink: '#1F1D1A',         // primary text
        muted: '#777777',       // secondary / helper text
        // --- Semantic Colors ---
        success: '#2E7D32',     // revenue, inflow, positive net
        'success-bg': '#EAF5EA',
        'success-border': '#C4E5C5',
        danger: '#C62828',      // cracked, expenses, outflow
        'danger-bg': '#FEECEB',
        'danger-border': '#F8CBC8',
        intake: '#1565C0',      // received eggs, batch arrivals
        'intake-bg': '#EBF3FC',
        'intake-border': '#C5DCF8',
        warn: '#F59E0B',        // warnings, discrepancy flags
        'warn-bg': '#FFFBEB',
        // --- Material Design surface tokens (from DESIGN.md) ---
        surface: '#fff8f3',
        'surface-dim': '#dfd9d4',
        'surface-bright': '#fff8f3',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#f9f2ed',
        'surface-container': '#f3ede7',
        'surface-container-high': '#ede7e2',
        'surface-container-highest': '#e7e1dc',
        'on-surface': '#1d1b18',
        'on-surface-variant': '#534437',
        'inverse-surface': '#32302d',
        'inverse-on-surface': '#f6f0ea',
        outline: '#867465',
        'outline-variant': '#d8c3b1',
        'surface-tint': '#8b5000',
        primary: '#884e00',
        'on-primary': '#ffffff',
        'primary-container': '#ab6300',
        'on-primary-container': '#fffbff',
        'inverse-primary': '#ffb871',
        secondary: '#1b6d24',
        'on-secondary': '#ffffff',
        'secondary-container': '#a0f399',
        'on-secondary-container': '#217128',
        tertiary: '#005bb3',
        'on-tertiary': '#ffffff',
        'tertiary-container': '#2e74d0',
        'on-tertiary-container': '#fefcff',
        error: '#ba1a1a',
        'on-error': '#ffffff',
        'error-container': '#ffdad6',
        'on-error-container': '#93000a',
        'primary-fixed': '#ffdcbe',
        'primary-fixed-dim': '#ffb871',
        'on-primary-fixed': '#2d1600',
        'on-primary-fixed-variant': '#6a3c00',
        'secondary-fixed': '#a3f69c',
        'secondary-fixed-dim': '#88d982',
        'on-secondary-fixed': '#002204',
        'on-secondary-fixed-variant': '#005312',
        'tertiary-fixed': '#d6e3ff',
        'tertiary-fixed-dim': '#a9c7ff',
        'on-tertiary-fixed': '#001b3d',
        'on-tertiary-fixed-variant': '#00468c',
        background: '#fff8f3',
        'on-background': '#1d1b18',
        'surface-variant': '#e7e1dc',
      },
      borderRadius: {
        DEFAULT: '0.5rem',    // 8px — buttons, inputs
        sm: '0.25rem',        // 4px
        md: '0.75rem',        // 12px — cards, panels
        lg: '1rem',
        xl: '1.5rem',
        full: '9999px',       // pills, badges
      },
      spacing: {
        'space-xs': '0.25rem',  // 4px
        'space-sm': '0.5rem',   // 8px
        'space-md': '1rem',     // 16px
        'space-lg': '1.5rem',   // 24px
        'space-xl': '2rem',     // 32px
        gutter: '1.5rem',
        margin: '2rem',
        sidebar: '240px',       // fixed sidebar width
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-lg': ['2.25rem', { lineHeight: '2.75rem', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-md': ['1.75rem', { lineHeight: '2.25rem', letterSpacing: '-0.01em', fontWeight: '700' }],
        'title-page': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.01em', fontWeight: '700' }],
        'title-section': ['1.125rem', { lineHeight: '1.625rem', fontWeight: '600' }],
        'body-default': ['0.9375rem', { lineHeight: '1.375rem' }],
        'body-medium': ['0.9375rem', { lineHeight: '1.375rem', fontWeight: '500' }],
        'table-cell': ['0.875rem', { lineHeight: '1.25rem' }],
        'table-header': ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.04em', fontWeight: '600' }],
        'label-sm': ['0.8125rem', { lineHeight: '1.125rem', fontWeight: '500' }],
        'helper-xs': ['0.75rem', { lineHeight: '1rem' }],
        'currency': ['0.875rem', { lineHeight: '1.25rem', fontWeight: '600' }],
      },
      boxShadow: {
        card: '0 1px 3px rgba(31,29,26,0.04), 0 1px 2px rgba(31,29,26,0.02)',
        'card-hover': '0 4px 12px rgba(194,118,26,0.06), 0 1px 3px rgba(31,29,26,0.04)',
        modal: '0 12px 32px rgba(31,29,26,0.12), 0 2px 6px rgba(31,29,26,0.04)',
        input: '0 0 0 3px rgba(194,118,26,0.15)',
      },
      maxWidth: {
        content: '1100px',
        form: '560px',
        login: '420px',
      },
    },
  },
  plugins: [],
};

