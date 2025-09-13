import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      colors: {
        'glass-blue': 'rgba(59, 130, 246, 0.1)',
        'glass-indigo': 'rgba(99, 102, 241, 0.1)',
        'glass-purple': 'rgba(139, 92, 246, 0.1)',
        'glass-emerald': 'rgba(16, 185, 129, 0.1)',
        'glass-slate': 'rgba(71, 85, 105, 0.1)',
        'professional-blue': '#3b82f6',
        'professional-indigo': '#6366f1',
        'professional-purple': '#8b5cf6',
        'professional-emerald': '#10b981',
        'professional-slate': '#475569',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(59, 130, 246, 0.25)',
        'professional': '0 4px 20px rgba(59, 130, 246, 0.15)',
        'soft': '0 2px 10px rgba(71, 85, 105, 0.1)',
      },
      backdropFilter: {
        'none': 'none',
        'blur': 'blur(10px)',
      },
    },
  },
  plugins: [
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('tailwindcss-filters'),
  ],
};
export default config;
