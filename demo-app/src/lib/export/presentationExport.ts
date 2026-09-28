export interface ParsedSlide {
  number: number
  title: string
  visualDirection?: string
  bullets: string[]
  paragraphs: string[]
  speakerNotes?: string
}

export function parsePresentationMarkdown(markdown: string): ParsedSlide[] {
  if (!markdown || !markdown.trim()) {
    return []
  }

  // Standardize line breaks
  const normalized = markdown.replace(/\r\n/g, '\n').trim()

  // Try splitting by standard slide horizontal dividers (---, ***, ___)
  let rawChunks = normalized.split(/\n\s*(?:---+|\*\*\*+|___+)\s*\n/g)

  // If no horizontal dividers or only 1 chunk, try splitting by slide headers
  if (rawChunks.length <= 1) {
    const slideHeaderRegex = /(?=^#{1,3}\s*Slide\s*\d+)/gim
    const splitByHeader = normalized.split(slideHeaderRegex)
    if (splitByHeader.length > 1) {
      rawChunks = splitByHeader
    }
  }

  const slides: ParsedSlide[] = []
  let slideCounter = 1

  for (const raw of rawChunks) {
    const chunk = raw.trim()
    if (!chunk) continue

    // Remove any leading markdown dividers
    const cleanChunk = chunk.replace(/^(?:---+|\*\*\*+|___+)\s*/, '').trim()
    if (!cleanChunk) continue

    const lines = cleanChunk.split('\n')
    let title = ''
    let visualDirection = ''
    let speakerNotes = ''
    const bullets: string[] = []
    const paragraphs: string[] = []

    let inSpeakerNotes = false

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      // Detect slide title from the first non-bullet line
      if (!title) {
        const slideTitleMatch = line.match(/^#{1,3}\s*(?:Slide\s*\d+\s*:\s*)?(.+)$/i)
        if (slideTitleMatch && !line.startsWith('-') && !line.startsWith('•') && !line.startsWith('* ')) {
          title = slideTitleMatch[1].replace(/^[#\s*]+|[#\s*]+$/g, '').trim()
          continue
        }
      }

      // Speaker Notes section
      if (/^(?:#{1,4}\s*)?(?:\*\*)?Speaker Notes(?:\*\*)?:?/i.test(line)) {
        inSpeakerNotes = true
        const noteInline = line.replace(/^(?:#{1,4}\s*)?(?:\*\*)?Speaker Notes(?:\*\*)?:?/i, '').trim()
        if (noteInline) {
          speakerNotes += (speakerNotes ? ' ' : '') + noteInline
        }
        continue
      }

      if (inSpeakerNotes) {
        speakerNotes += (speakerNotes ? ' ' : '') + line.replace(/^\*+|\*+$/g, '').trim()
        continue
      }

      // Visual Direction line
      if (/^(?:#{1,4}\s*)?(?:\*\*)?Visual Direction(?:\*\*)?:?/i.test(line)) {
        visualDirection = line.replace(/^(?:#{1,4}\s*)?(?:\*\*)?Visual Direction(?:\*\*)?:?/i, '').trim()
        continue
      }

      // Slide Bullets header (skip header label)
      if (/^(?:#{1,4}\s*)?(?:\*\*)?Slide Bullets(?:\*\*)?:?/i.test(line)) {
        continue
      }

      // Bullet points
      if (line.startsWith('- ') || line.startsWith('• ') || line.startsWith('* ')) {
        const bText = line.replace(/^[-•*]\s+/, '').trim()
        if (bText) {
          bullets.push(bText)
        }
        continue
      }

      // Numbered bullets (e.g. 1. Point)
      const numMatch = line.match(/^\d+\.\s+(.+)$/)
      if (numMatch) {
        bullets.push(numMatch[1].trim())
        continue
      }

      // Regular paragraph text
      if (!line.startsWith('#')) {
        paragraphs.push(line)
      }
    }

    // Skip preamble chunks that don't have bullets or slide indicators
    const isPreamble = !visualDirection && !speakerNotes && bullets.length === 0 && paragraphs.length <= 1 && !cleanChunk.toLowerCase().includes('slide')
    if (isPreamble) continue

    if (title || bullets.length > 0 || paragraphs.length > 0) {
      slides.push({
        number: slideCounter++,
        title: title || `Slide ${slideCounter - 1}`,
        visualDirection: visualDirection || undefined,
        bullets,
        paragraphs,
        speakerNotes: speakerNotes || undefined,
      })
    }
  }

  // Fallback if no structured slides found: create a single slide
  if (slides.length === 0) {
    slides.push({
      number: 1,
      title: 'Presentation',
      bullets: markdown.split('\n').filter((l) => l.trim().startsWith('-')).map((l) => l.replace(/^-\s*/, '')),
      paragraphs: [markdown.slice(0, 300)],
    })
  }

  return slides
}

async function loadPptxGen(): Promise<any> {
  if (typeof window === 'undefined') return null
  if ((window as any).PptxGenJS) {
    return (window as any).PptxGenJS
  }

  return new Promise((resolve) => {
    const existing = document.getElementById('pptxgen-cdn-script')
    if (existing) {
      existing.addEventListener('load', () => resolve((window as any).PptxGenJS))
      return
    }

    const script = document.createElement('script')
    script.id = 'pptxgen-cdn-script'
    script.src = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js'
    script.async = true
    script.onload = () => resolve((window as any).PptxGenJS)
    script.onerror = () => resolve(null)
    document.head.appendChild(script)
  })
}

export async function exportPresentationToPpt(
  presentationTitle: string,
  markdownContent: string,
): Promise<void> {
  const slides = parsePresentationMarkdown(markdownContent)
  const safeTitle = (presentationTitle || 'Presentation')
    .replace(/[^a-zA-Z0-9_\-\s]/g, '')
    .trim() || 'Presentation'

  const PptxClass = await loadPptxGen()

  if (PptxClass) {
    try {
      const pptx = new PptxClass()
      pptx.layout = 'LAYOUT_16x9'
      pptx.title = safeTitle
      pptx.company = 'GenAI Transformation Platform'

      for (let idx = 0; idx < slides.length; idx++) {
        const item = slides[idx]
        const slide = pptx.addSlide()

        // Attach speaker notes to slide
        if (item.speakerNotes) {
          slide.addNotes(item.speakerNotes)
        }

        if (idx === 0) {
          // Title Cover Slide (Modern Executive Navy Styling)
          slide.background = { color: '0F172A' } // Dark Slate Navy

          slide.addText(safeTitle.toUpperCase(), {
            x: 0.8,
            y: 2.0,
            w: '85%',
            h: 1.5,
            fontSize: 28,
            bold: true,
            color: 'F8FAFC',
            fontFace: 'Arial',
          })

          if (item.visualDirection) {
            slide.addText(item.visualDirection, {
              x: 0.8,
              y: 3.6,
              w: '85%',
              h: 0.8,
              fontSize: 15,
              color: '38BDF8', // Cyan accent
              fontFace: 'Arial',
            })
          }

          slide.addText('EXECUTIVE PRESENTATION DECK · VERIFIED EVIDENCE', {
            x: 0.8,
            y: 5.8,
            w: '85%',
            h: 0.4,
            fontSize: 11,
            color: '94A3B8',
            fontFace: 'Arial',
          })
        } else {
          // Content Slide (Clean Light Executive Styling)
          slide.background = { color: 'F8FAFC' }

          // Top Header Accent Bar
          slide.addShape(pptx.ShapeType.rect, {
            x: 0.8,
            y: 0.6,
            w: 0.15,
            h: 0.6,
            fill: { color: '0D9488' }, // Teal Accent
            line: { color: '0D9488' },
          })

          // Slide Title
          slide.addText(item.title, {
            x: 1.1,
            y: 0.5,
            w: '80%',
            h: 0.8,
            fontSize: 20,
            bold: true,
            color: '0F172A',
            fontFace: 'Arial',
          })

          // Visual Direction Subtitle Badge
          if (item.visualDirection) {
            slide.addText(`Visual Direction: ${item.visualDirection}`, {
              x: 1.1,
              y: 1.2,
              w: '80%',
              h: 0.4,
              fontSize: 11,
              italic: true,
              color: '64748B',
              fontFace: 'Arial',
            })
          }

          // Bullets Content
          if (item.bullets.length > 0) {
            const bulletObjects = item.bullets.map((b) => ({
              text: b,
              options: {
                bullet: true,
                fontSize: 14,
                color: '1E293B',
                fontFace: 'Arial',
                paraSpaceAfter: 10,
              },
            }))

            slide.addText(bulletObjects, {
              x: 1.1,
              y: 1.7,
              w: 8.5,
              h: 4.5,
            })
          } else if (item.paragraphs.length > 0) {
            slide.addText(item.paragraphs.join('\n\n'), {
              x: 1.1,
              y: 1.7,
              w: 8.5,
              h: 4.5,
              fontSize: 14,
              color: '1E293B',
              fontFace: 'Arial',
              lineSpacing: 20,
            })
          }

          // Footer Slide Number
          slide.addText(`Slide ${item.number} / ${slides.length}`, {
            x: 8.0,
            y: 6.8,
            w: 2.0,
            h: 0.3,
            fontSize: 10,
            color: '94A3B8',
            align: 'right',
          })
        }
      }

      await pptx.writeFile({ fileName: `${safeTitle}-presentation.pptx` })
      return
    } catch (e) {
      console.warn('PptxGenJS failed; using native PPT format fallback', e)
    }
  }

  // Fallback: Generate Microsoft Office XML Presentation (.ppt) format
  const pptHtml = `
  <html xmlns:o="urn:schemas-microsoft-com:office:office"
        xmlns:p="urn:schemas-microsoft-com:office:powerpoint"
        xmlns="http://www.w3.org/TR/REC-html40">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <title>${safeTitle}</title>
    <style>
      body { font-family: Calibri, Arial, sans-serif; margin: 0; padding: 0; background: #0F172A; }
      .slide {
        width: 960px; height: 540px; page-break-after: always;
        background: #F8FAFC; color: #0F172A; padding: 40px; box-sizing: border-box;
        position: relative; margin-bottom: 20px;
      }
      .slide-cover { background: #0F172A; color: #F8FAFC; display: flex; flex-direction: column; justify-content: center; }
      .slide-cover h1 { font-size: 36px; color: #F8FAFC; margin: 0 0 16px; }
      .slide-cover .badge { color: #38BDF8; font-size: 18px; }
      .slide h2 { font-size: 26px; color: #0F172A; margin: 0 0 8px; border-left: 5px solid #0D9488; padding-left: 12px; }
      .visual-direction { color: #64748B; font-style: italic; font-size: 13px; margin-bottom: 24px; padding-left: 17px; }
      ul { font-size: 18px; line-height: 1.6; color: #1E293B; margin-top: 16px; }
      li { margin-bottom: 12px; }
      .notes { position: absolute; bottom: 15px; left: 40px; right: 40px; font-size: 12px; color: #64748B; border-top: 1px solid #CBD5E1; padding-top: 6px; }
    </style>
  </head>
  <body>
    ${slides
      .map((s, i) =>
        i === 0
          ? `
      <div class="slide slide-cover">
        <h1>${safeTitle}</h1>
        ${s.visualDirection ? `<div class="badge">${s.visualDirection}</div>` : ''}
        <div style="margin-top: 40px; color: #94A3B8; font-size: 14px;">EXECUTIVE PRESENTATION DECK</div>
        ${s.speakerNotes ? `<div class="notes">Speaker Notes: ${s.speakerNotes}</div>` : ''}
      </div>`
          : `
      <div class="slide">
        <h2>${s.title}</h2>
        ${s.visualDirection ? `<div class="visual-direction">Visual Direction: ${s.visualDirection}</div>` : ''}
        ${s.bullets.length ? `<ul>${s.bullets.map((b) => `<li>${b}</li>`).join('')}</ul>` : `<p>${s.paragraphs.join('</p><p>')}</p>`}
        ${s.speakerNotes ? `<div class="notes">Speaker Notes: ${s.speakerNotes}</div>` : ''}
      </div>`,
      )
      .join('\n')}
  </body>
  </html>
  `

  const blob = new Blob([pptHtml], { type: 'application/vnd.ms-powerpoint' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safeTitle}-presentation.ppt`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
