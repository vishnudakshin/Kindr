import { StyleSheet } from '@react-pdf/renderer'

export const PALETTE = {
  ink:     '#2C2A1E',
  ink2:    '#6B6752',
  accent:  '#E8E0A0',
  card:    '#FAFAF5',
  border:  '#E0DCC8',
  amber:   '#C8842A',
  white:   '#FFFFFF',
}

export const S = StyleSheet.create({
  page: {
    backgroundColor: PALETTE.white,
    paddingTop: 56,
    paddingBottom: 44,
    paddingHorizontal: 44,
    fontFamily: 'Helvetica',
    color: PALETTE.ink,
  },

  // Header / footer
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: PALETTE.accent,
  },
  headerBrand: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: PALETTE.ink,
    letterSpacing: 0.5,
  },
  headerPage: {
    fontSize: 9,
    color: PALETTE.ink2,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 44,
    right: 44,
    textAlign: 'center',
    fontSize: 8,
    color: PALETTE.ink2,
    borderTopWidth: 0.5,
    borderTopColor: PALETTE.border,
    paddingTop: 6,
  },

  // Section heading
  sectionHeading: {
    fontSize: 17,
    fontFamily: 'Helvetica-Bold',
    color: PALETTE.ink,
    marginBottom: 4,
  },
  sectionRule: {
    borderBottomWidth: 1,
    borderBottomColor: PALETTE.accent,
    marginBottom: 14,
  },

  // Body text
  body: { fontSize: 10, color: PALETTE.ink, lineHeight: 1.5 },
  muted: { fontSize: 9, color: PALETTE.ink2, lineHeight: 1.4 },

  // Table
  table: { marginTop: 4, marginBottom: 8 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: PALETTE.accent,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: PALETTE.border,
  },
  tableRowAlt: {
    backgroundColor: '#F8F6EC',
  },
  tableCell: { fontSize: 9, color: PALETTE.ink },
  tableCellMuted: { fontSize: 9, color: PALETTE.ink2 },
  tableHeadCell: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: PALETTE.ink },

  // Panel subheading (Lab Results)
  panelHeading: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: PALETTE.ink2,
    marginTop: 12,
    marginBottom: 4,
  },

  // Cover
  coverSpacer: { height: 120 },
  coverTitle: {
    fontSize: 28,
    fontFamily: 'Helvetica-Bold',
    color: PALETTE.ink,
    marginBottom: 6,
  },
  coverSubtitle: {
    fontSize: 13,
    color: PALETTE.ink2,
    marginBottom: 24,
    lineHeight: 1.4,
  },
  coverRule: {
    borderBottomWidth: 1.5,
    borderBottomColor: PALETTE.accent,
    marginBottom: 16,
  },
  coverMeta: { fontSize: 11, color: PALETTE.ink, marginBottom: 6 },
  coverMetaLabel: { fontFamily: 'Helvetica-Bold' },

  // Symptom list
  symptomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  symptomTick: { fontSize: 11, marginRight: 8, width: 14 },
  symptomText: { fontSize: 10, color: PALETTE.ink },

  // Adherence bar container
  barOuter: {
    height: 12,
    backgroundColor: PALETTE.border,
    borderRadius: 6,
    marginVertical: 4,
    overflow: 'hidden',
  },
  barInner: {
    height: 12,
    backgroundColor: PALETTE.accent,
    borderRadius: 6,
  },
  barLabel: {
    fontSize: 9,
    color: PALETTE.ink2,
    marginBottom: 2,
  },
  barPct: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: PALETTE.ink,
    marginTop: 2,
  },
})
