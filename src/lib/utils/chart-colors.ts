// Chart color configuration using emerald theme from shadcn/ui
// Reference: https://ui.shadcn.com/colors

export const CHART_COLORS = {
  emerald: {
    50: '#ecfdf5',
    100: '#d1fae5',
    200: '#a7f3d0',
    300: '#6ee7b7',
    400: '#34d399',
    500: '#10b981',  // Primary emerald
    600: '#059669',
    700: '#047857',
    800: '#065f46',
    900: '#064e3b',
    950: '#022c22',
  }
} as const

// Default chart color palette for consistent theming
export const DEFAULT_CHART_PALETTE = [
  CHART_COLORS.emerald[500], // emerald-500
  CHART_COLORS.emerald[600], // emerald-600
  CHART_COLORS.emerald[700], // emerald-700
  CHART_COLORS.emerald[800], // emerald-800
  CHART_COLORS.emerald[400], // emerald-400
  CHART_COLORS.emerald[300], // emerald-300
  CHART_COLORS.emerald[900], // emerald-900
  CHART_COLORS.emerald[200], // emerald-200
] as const

// Sales funnel specific colors (darker to lighter for progression)
export const SALES_FUNNEL_COLORS = [
  CHART_COLORS.emerald[500], // Quotations
  CHART_COLORS.emerald[600], // Work Orders
  CHART_COLORS.emerald[700], // In Production
  CHART_COLORS.emerald[800], // Ready to Invoice
  CHART_COLORS.emerald[900], // Invoiced
] as const

// Chart theme configurations for different chart libraries
export const CHART_THEME_CONFIG = {
  recharts: {
    primary: CHART_COLORS.emerald[500],
    secondary: CHART_COLORS.emerald[600],
    accent: CHART_COLORS.emerald[400],
    grid: CHART_COLORS.emerald[200],
    text: '#374151', // gray-700 for light mode
    textDark: '#f3f4f6', // gray-100 for dark mode
  },
  chartjs: {
    primary: CHART_COLORS.emerald[500],
    secondary: CHART_COLORS.emerald[600],
    borderColor: CHART_COLORS.emerald[300],
    backgroundColor: CHART_COLORS.emerald[100],
    gridColor: CHART_COLORS.emerald[200],
  }
} as const

// Helper function to get chart colors with opacity
export const getChartColorWithOpacity = (color: string, opacity: number): string => {
  // Convert hex to rgb and add alpha
  const hex = color.replace('#', '')
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

// Helper function to get gradient colors
export const getChartGradient = (startColor: string, endColor: string): string => {
  return `linear-gradient(135deg, ${startColor}, ${endColor})`
}

// Theme-aware color selection
export const getThemeAwareChartColor = (isDark: boolean) => ({
  primary: CHART_COLORS.emerald[isDark ? 400 : 500],
  secondary: CHART_COLORS.emerald[isDark ? 500 : 600],
  accent: CHART_COLORS.emerald[isDark ? 300 : 700],
  muted: CHART_COLORS.emerald[isDark ? 800 : 200],
  background: isDark ? CHART_COLORS.emerald[950] : CHART_COLORS.emerald[50],
}) 