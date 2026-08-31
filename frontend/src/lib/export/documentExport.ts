import { exportPresentationToPpt } from './presentationExport'

export type ExportFormat = 'pdf' | 'docx' | 'txt' | 'md' | 'ppt'

/**
 * Converts basic markdown formatting to clean HTML for PDF / Word exports
 */
export function markdownToStyledHtml(title: string, markdown: string): string {
  const lines = markdown.split('\n')
  const htmlParts: string[] = []

  let inList = false

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    const trimmed = rawLine.trim()

    if (!trimmed) {
      if (inList) {
        htmlParts.push('</ul>')
        inList = false
      }
      continue
    }

    // Format bold and italic
    let formatted = trimmed
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code>$1</code>')

    // Headings
    if (trimmed.startsWith('# ')) {
      if (inList) { htmlParts.push('</ul>'); inList = false }
      htmlParts.push(`<h1>${formatted.slice(2)}</h1>`)
    } else if (trimmed.startsWith('## ')) {
      if (inList) { htmlParts.push('</ul>'); inList = false }
      htmlParts.push(`<h2>${formatted.slice(3)}</h2>`)
    } else if (trimmed.startsWith('### ')) {
      if (inList) { htmlParts.push('</ul>'); inList = false }
      htmlParts.push(`<h3>${formatted.slice(4)}</h3>`)
    } else if (trimmed.startsWith('#### ')) {
      if (inList) { htmlParts.push('</ul>'); inList = false }
      htmlParts.push(`<h4>${formatted.slice(5)}</h4>`)
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('• ') || trimmed.startsWith('* ')) {
      if (!inList) {
        htmlParts.push('<ul>')
        inList = true
      }
      const bulletContent = formatted.replace(/^[-•*]\s+/, '')
      htmlParts.push(`<li>${bulletContent}</li>`)
    } else if (trimmed.startsWith('---') || trimmed.startsWith('***')) {
      if (inList) { htmlParts.push('</ul>'); inList = false }
      htmlParts.push('<hr />')
    } else {
      if (inList) { htmlParts.push('</ul>'); inList = false }
      htmlParts.push(`<p>${formatted}</p>`)
    }
  }

  if (inList) {
    htmlParts.push('</ul>')
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @page {
      size: A4;
      margin: 20mm;
    }
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      line-height: 1.6;
      margin: 0;
      padding: 24px;
      font-size: 11pt;
      background: #ffffff;
    }
    .doc-header {
      border-bottom: 2px solid #0d9488;
      padding-bottom: 12px;
      margin-bottom: 24px;
    }
    .doc-header .doc-brand {
      font-size: 9pt;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #0d9488;
      font-weight: 700;
    }
    .doc-header h1 {
      font-size: 20pt;
      color: #0f172a;
      margin: 4px 0 0;
      font-weight: 700;
    }
    h1, h2, h3, h4 {
      color: #0f172a;
      font-weight: 600;
      page-break-after: avoid;
    }
    h1 { font-size: 16pt; margin-top: 24px; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
    h2 { font-size: 13pt; margin-top: 20px; margin-bottom: 10px; color: #0f172a; }
    h3 { font-size: 11pt; margin-top: 16px; margin-bottom: 8px; }
    p { margin: 0 0 10px; }
    ul { margin: 0 0 12px; padding-left: 24px; }
    li { margin-bottom: 6px; }
    code {
      background: #f1f5f9;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: ui-monospace, Menlo, monospace;
      font-size: 9.5pt;
      color: #0f172a;
    }
    hr {
      border: 0;
      border-top: 1px solid #cbd5e1;
      margin: 20px 0;
    }
    strong { font-weight: 600; color: #0f172a; }
    .doc-footer {
      margin-top: 36px;
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
      font-size: 8pt;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="doc-header">
    <div class="doc-brand">GenAI Transformation Platform · Verified Evidence Deliverable</div>
    <h1>${title}</h1>
  </div>
  <div class="doc-content">
    ${htmlParts.join('\n')}
  </div>
  <div class="doc-footer">
    <span>Grounded in immutable source evidence</span>
    <span>Generated: ${new Date().toLocaleDateString()}</span>
  </div>
</body>
</html>
`
}

/**
 * Triggers download of raw string data as a file
 */
export function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Exports document to PDF using browser print engine with styled layout
 */
export function exportToPdf(filename: string, title: string, markdown: string): void {
  const html = markdownToStyledHtml(title, markdown)
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)

  const doc = iframe.contentWindow?.document
  if (!doc) {
    downloadFile(`${filename}.md`, markdown, 'text/markdown')
    return
  }

  doc.open()
  doc.write(html)
  doc.close()

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } catch {
      downloadFile(`${filename}.html`, html, 'text/html')
    } finally {
      setTimeout(() => {
        document.body.removeChild(iframe)
      }, 1000)
    }
  }, 250)
}

/**
 * Exports document to Word DOCX compatible format
 */
export function exportToDocx(filename: string, title: string, markdown: string): void {
  const styledHtml = markdownToStyledHtml(title, markdown)
  const docxContent = `
  <html xmlns:o='urn:schemas-microsoft-com:office:office'
        xmlns:w='urn:schemas-microsoft-com:office:word'
        xmlns='http://www.w3.org/TR/REC-html40'>
  <head>
    <meta charset="utf-8">
    <title>${title}</title>
    <!--[if gte mso 9]>
    <xml>
      <w:WordDocument>
        <w:View>Print</w:View>
        <w:Zoom>100</w:Zoom>
        <w:DoNotOptimizeForBrowser/>
      </w:WordDocument>
    </xml>
    <![endif]-->
    <style>
      body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #1e293b; }
      h1 { font-size: 18pt; color: #0f172a; font-weight: bold; border-bottom: 1.5pt solid #0d9488; padding-bottom: 4pt; }
      h2 { font-size: 14pt; color: #0f172a; font-weight: bold; margin-top: 12pt; }
      h3 { font-size: 12pt; color: #0f172a; font-weight: bold; }
      p { margin-bottom: 8pt; }
      ul { margin-bottom: 8pt; }
      li { margin-bottom: 4pt; }
      strong { font-weight: bold; }
    </style>
  </head>
  <body>
    ${styledHtml}
  </body>
  </html>
  `
  downloadFile(`${filename}.docx`, docxContent, 'application/vnd.ms-word;charset=utf-8')
}

/**
 * Exports plain text stripped of markdown artifacts
 */
export function exportToTxt(filename: string, title: string, markdown: string): void {
  // Strip markdown formatting symbols for clean plain text reading
  const cleanTxt = markdown
    .replace(/^#+\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/^[-•*]\s+/gm, '• ')

  const content = `${title}\n${'='.repeat(title.length)}\n\n${cleanTxt}`
  downloadFile(`${filename}.txt`, content, 'text/plain;charset=utf-8')
}

/**
 * Universal document export entry point supporting all requested formats
 */
export function exportArtifact(
  artifactType: string,
  artifactContent: string,
  docTitle: string,
  format: ExportFormat = 'pdf',
): void {
  const safeTitle = (docTitle || 'Artifact')
    .replace(/[^a-zA-Z0-9_\-\s]/g, '')
    .trim() || 'Artifact'

  const filename = `${artifactType}-${safeTitle.toLowerCase().replace(/\s+/g, '-')}`

  switch (format) {
    case 'pdf':
      exportToPdf(filename, `${safeTitle} · ${artifactType.replace('_', ' ').toUpperCase()}`, artifactContent)
      break
    case 'docx':
      exportToDocx(filename, `${safeTitle} · ${artifactType.replace('_', ' ').toUpperCase()}`, artifactContent)
      break
    case 'txt':
      exportToTxt(filename, `${safeTitle} · ${artifactType.replace('_', ' ').toUpperCase()}`, artifactContent)
      break
    case 'md':
      downloadFile(`${filename}.md`, artifactContent, 'text/markdown;charset=utf-8')
      break
    case 'ppt':
      void exportPresentationToPpt(safeTitle, artifactContent)
      break
    default:
      exportToPdf(filename, safeTitle, artifactContent)
      break
  }
}
