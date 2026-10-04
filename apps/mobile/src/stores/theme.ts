export const colors = {
  background: '#F9F7F2',
  surface: '#FFFEFA',
  border: '#E7E3DB',
  text: '#252521',
  textMuted: '#77756F',
  textFaint: '#97948D',
  primary: '#3E7460',
  primarySoft: '#A0C5B4',
  primaryDeep: '#1E3B32',
  cycleCard: '#304840',
  cycleCardSoft: '#426258',
  plan: '#EFE6D7',
  planAccent: '#D7B267',
  danger: '#9C4A3C',
} as const;

export const fonts = {
  serif: 'serif',
} as const;

/**
 * Single typographic scale for the app.
 * greeting: Today header · headline: screen titles · section: SectionHeader ·
 * cardTitle: card headings · body: card copy.
 */
export const type = {
  greeting: { fontSize: 24, lineHeight: 30 },
  headline: { fontSize: 24, lineHeight: 30 },
  section: { fontSize: 18, lineHeight: 24 },
  cardTitle: { fontSize: 16, lineHeight: 22 },
  cycleDay: { fontSize: 26, lineHeight: 32 },
} as const;
