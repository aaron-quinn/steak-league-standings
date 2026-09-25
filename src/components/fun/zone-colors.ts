import type { SteakZone } from '@/utils/steak-teams';

// Emerald for eaters and red for buyers, matching the standings heatmap
export const zoneStroke: Record<SteakZone, string> = {
  eater: '#34d399',
  'self-buyer': '#a3a3a3',
  buyer: '#f87171',
};

export const zoneBand: Record<SteakZone, string> = {
  eater: 'rgba(6, 80, 60, 0.28)',
  'self-buyer': 'rgba(64, 64, 64, 0.3)',
  buyer: 'rgba(130, 28, 28, 0.2)',
};

// The bands above laid over the black page, as solid colors
export const zoneRow: Record<SteakZone, string> = {
  eater: '#021611',
  'self-buyer': '#131313',
  buyer: '#1a0606',
};

export const zoneText: Record<SteakZone, string> = {
  eater: 'text-emerald-400',
  'self-buyer': 'text-gray-400',
  buyer: 'text-red-400',
};
