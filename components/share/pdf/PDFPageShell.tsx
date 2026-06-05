import { Page, View, Text } from '@react-pdf/renderer'
import type { ReactNode } from 'react'
import { S, PALETTE } from './styles'

interface Props {
  children: ReactNode
  footerText: string
  pageNumber?: number
}

export function PDFPageShell({ children, footerText, pageNumber }: Props) {
  return (
    <Page size="A4" style={S.page}>
      {/* Header */}
      <View style={S.header} fixed>
        <Text style={S.headerBrand}>Kindr.</Text>
        {pageNumber !== undefined && (
          <Text style={S.headerPage}>{pageNumber}</Text>
        )}
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {children}
      </View>

      {/* Footer */}
      <Text style={S.footer} fixed>{footerText}</Text>
    </Page>
  )
}
