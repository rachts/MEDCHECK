/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Clinical White Design System Tokens
        base: '#F1F5F9',
        surface: '#FFFFFF',
        elevated: '#F8FAFC',
        input: '#F8FAFC',
        border: '#E2E8F0',
        'border-hover': '#CBD5E1',
        'border-alert': '#FECACA',
        
        // Text
        'text-primary': '#0F172A',
        'text-secondary': '#475569',
        'text-muted': '#64748B',

        // Accent: Authoritative near-black
        accent: '#0F172A',
        'accent-hover': '#1E293B',
        'accent-muted': 'rgba(15, 23, 42, 0.06)',

        // Severity
        danger: '#DC2626',
        warning: '#D97706',
        success: '#059669',
        'severity-high': '#DC2626',
        'severity-moderate': '#D97706',
        'severity-low': '#059669',
        'severity-info': '#0284C7',

        // Category Pills
        'pill-rx': 'rgba(2, 132, 199, 0.08)',
        'pill-rx-text': '#0284C7',
        'pill-otc': 'rgba(5, 150, 105, 0.08)',
        'pill-otc-text': '#059669',
        'pill-supp': 'rgba(124, 58, 237, 0.08)',
        'pill-supp-text': '#7C3AED',
      },
      fontFamily: {
        serif: ['Cormorant Garamond', 'Source Serif Pro', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'SF Mono', 'monospace'],
        headline: ['Cormorant Garamond', 'Georgia', 'serif'],
        body: ['Inter', 'sans-serif'],
      },
      fontSize: {
        'display': ['48px', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        'h1': ['32px', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        'h2': ['24px', { lineHeight: '1.3' }],
        'h3': ['15px', { lineHeight: '1.4', letterSpacing: '-0.01em' }],
        'body': ['13px', { lineHeight: '1.6' }],
        'label': ['10px', { lineHeight: '1.4', letterSpacing: '0.1em' }],
        'metric': ['22px', { lineHeight: '1.2' }],
        'xs': ['10px', { letterSpacing: '1px', lineHeight: '14px' }],
        'sm': ['12px', { letterSpacing: '0', lineHeight: '16px' }],
        'base': ['13px', { letterSpacing: '0', lineHeight: '18px' }],
        'lg': ['15px', { letterSpacing: '-0.2px', lineHeight: '20px' }],
        'xl': ['18px', { letterSpacing: '-0.3px', lineHeight: '24px' }],
        '2xl': ['22px', { letterSpacing: '-0.4px', lineHeight: '28px' }],
        '3xl': ['28px', { letterSpacing: '-0.5px', lineHeight: '34px' }],
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '12px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.02)',
        'card-hover': '0 2px 8px rgba(0,0,0,0.06)',
        'sticky-mobile': '0 4px 12px rgba(0,0,0,0.15)',
      },
      spacing: {
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '8': '32px',
        '10': '40px',
        '18': '72px',
        '22': '88px',
      },
    },
  },
  plugins: [],
}
