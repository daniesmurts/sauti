export const Colors = {
  brand: {
    50: '#E6F4F9',
    100: '#B2DCF0',
    200: '#7DC3E6',
    300: '#49ABDC',
    400: '#2898D0',
    500: '#0B7EA8',  // primary
    600: '#096A8F',
    700: '#075574',
    800: '#054159',
    900: '#022C3D',
  },

  neutral: {
    0: '#FFFFFF',
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
    800: '#1E293B',
    900: '#0F172A',
  },

  semantic: {
    success: '#22C55E',
    successBg: '#F0FDF4',
    warning: '#F59E0B',
    warningBg: '#FFFBEB',
    error: '#EF4444',
    errorBg: '#FEF2F2',
    info: '#3B82F6',
    infoBg: '#EFF6FF',
  },

  message: {
    outgoing: '#0B7EA8',
    outgoingDark: '#096A8F',
    outgoingText: '#FFFFFF',
    incoming: '#E2E8F0',
    incomingText: '#0F172A',
  },

  /** Proxy / connection status pill */
  proxy: {
    connected: '#22C55E',
    connecting: '#F59E0B',
    disconnected: '#EF4444',
  },
} as const;

export type BrandShade = keyof typeof Colors.brand;
export type NeutralShade = keyof typeof Colors.neutral;
