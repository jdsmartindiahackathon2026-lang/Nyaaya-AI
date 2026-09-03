'use client'
import { jsPDF } from 'jspdf'
import type { AbsResult } from '../lib/abs_logic'

export async function downloadMemo(result: AbsResult): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = 595
  const margin = 57
  const contentWidth = pageWidth - margin * 2
  let y = 60

  // Header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(20, 20, 20)
  doc.text('ABS Compliance Diagnostic', margin, y)
  y += 22

  // Date
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(120, 120, 120)
  doc.text(new Date().toLocaleDateString('en-GB'), margin, y)
  y += 18

  // Divider
  doc.setDrawColor(200, 200, 200)
  doc.line(margin, y, pageWidth - margin, y)
  y += 22

  // Headline
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(20, 20, 20)
  const headlineLines = doc.splitTextToSize(result.headline, contentWidth)
  doc.text(headlineLines, margin, y)
  y += headlineLines.length * 20 + 10

  // Intro paragraph
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(60, 60, 60)
  const introLines = doc.splitTextToSize(result.intro, contentWidth)
  doc.text(introLines, margin, y)
  y += introLines.length * 15 + 20

  // Obligations section
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(20, 20, 20)
  doc.text('Your obligations', margin, y)
  y += 18

  if (result.obligations.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(60, 60, 60)
    doc.text('No ABS approvals apply — you are in the clear.', margin, y)
    y += 20
  } else {
    for (const ob of result.obligations) {
      // Bullet + label
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(20, 20, 20)
      const labelLines = doc.splitTextToSize(`• ${ob.label}`, contentWidth)
      doc.text(labelLines, margin, y)
      y += labelLines.length * 15 + 4

      // Statute
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(9)
      doc.setTextColor(100, 140, 120)
      doc.text(ob.statute, margin + 10, y)
      y += 13

      // Detail
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(60, 60, 60)
      const detailLines = doc.splitTextToSize(ob.detail, contentWidth - 10)
      doc.text(detailLines, margin + 10, y)
      y += detailLines.length * 14 + 4

      // Link
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(50, 120, 200)
      doc.textWithLink(ob.link, margin + 10, y, { url: ob.link })
      y += 18
    }
  }

  // Footer disclaimer at bottom
  const footerY = 780
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(140, 140, 140)
  const disclaimerLines = doc.splitTextToSize(result.disclaimer, contentWidth)
  doc.text(disclaimerLines, margin, footerY)

  doc.save(`ABS_Diagnostic_${new Date().toISOString().slice(0, 10)}.pdf`)
}
