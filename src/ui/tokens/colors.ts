/**
 * Sauti "Sculpted Earth" design system — warm terracotta palette.
 *
 * brand[500]   = primary terracotta CTA (#C85A1C)
 * neutral[50]  = warm cream — light screen background
 * neutral[900] = very dark warm brown — dark screen background
 */
export const Colors = {
  brand: {
    50: '#FDF5EF',
    100: '#FAE2CC',
    200: '#F4BB88',
    300: '#E8904C',
    400: '#DC6E28',
    500: '#C85A1C',   // primary terracotta
    600: '#A84816',
    700: '#8A3810',
    800: '#66280C',
    900: '#3E1808',
  },

  neutral: {
    0: '#FFFFFF',
    50: '#FAF5EF',    // warm white — light screen bg
    100: '#F4E8D8',   // cream
    200: '#E4CCAC',
    300: '#C8A07C',
    400: '#9A785A',
    500: '#785640',
    600: '#5A3C28',
    700: '#3C2418',
    800: '#281408',   // elevated dark surface
    900: '#180C04',   // dark screen bg
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
    outgoing: '#C85A1C',
    outgoingDark: '#A84816',
    outgoingText: '#FFFFFF',
    incoming: '#2E1A0A',      // dark warm card for incoming bubbles
    incomingText: '#F4E8D8',
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
