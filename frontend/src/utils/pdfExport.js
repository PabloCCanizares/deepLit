function normalizePdfText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E\n]/g, ' ')
    .replace(/\t/g, '  ')
}

function escapePdfString(value) {
  return normalizePdfText(value)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

function wrapText(text, maxChars) {
  const normalized = normalizePdfText(text).trim()
  if (!normalized) return ['']

  const words = normalized.split(/\s+/)
  const lines = []
  let currentLine = ''

  words.forEach((word) => {
    const candidate = currentLine ? `${currentLine} ${word}` : word
    if (candidate.length <= maxChars) {
      currentLine = candidate
      return
    }

    if (currentLine) {
      lines.push(currentLine)
    }

    if (word.length <= maxChars) {
      currentLine = word
      return
    }

    let remaining = word
    while (remaining.length > maxChars) {
      lines.push(`${remaining.slice(0, maxChars - 1)}-`)
      remaining = remaining.slice(maxChars - 1)
    }
    currentLine = remaining
  })

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines
}

function buildParagraphs(text) {
  return String(text || '')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim().replace(/\n/g, ' '))
    .filter(Boolean)
}

function normalizeReferenceEntry(text) {
  const cleaned = String(text || '')
    .replace(/^\s*(?:[-*\u2022]|\d+[.)]|\[\d+\])\s*/, '')
    .replace(/^\[\s*Paper\s+\d+\s*:\s*/i, '')
    .replace(/^Paper\s+\d+\s*[:.]\s*/i, '')
    .replace(/\]$/, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) return ''
  return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`
}

function buildReferenceEntries(text) {
  const lines = String(text || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())

  const entries = []
  let currentEntry = []

  const pushEntry = () => {
    const entry = normalizeReferenceEntry(currentEntry.join(' '))
    if (entry) {
      entries.push(entry)
    }
    currentEntry = []
  }

  lines.forEach((line) => {
    if (!line) {
      if (currentEntry.length > 0) {
        pushEntry()
      }
      return
    }

    const startsNewEntry = /^\s*(?:[-*\u2022]|\d+[.)]|\[\s*Paper\s+\d+\s*:|\[\d+\]|Paper\s+\d+\s*[:.])/i.test(line)
    if (startsNewEntry && currentEntry.length > 0) {
      pushEntry()
    }

    currentEntry.push(line)
  })

  if (currentEntry.length > 0) {
    pushEntry()
  }

  return entries
}

function getSectionContent(sections, heading) {
  return sections.find((section) => section.heading === heading)?.content || ''
}

function byteLength(value) {
  return new TextEncoder().encode(value).length
}

function estimateTextWidth(text, size) {
  return normalizePdfText(text).length * size * 0.245
}

function createPage(bodyTop) {
  return {
    bodyTop,
    elements: [],
  }
}

function addText(page, { text, x, y, font = 'F1', size = 11, align = 'left' }) {
  page.elements.push({
    type: 'text',
    text,
    x,
    y,
    font,
    size,
    align,
  })
}

function addLine(page, { x1, y1, x2, y2, width = 0.8 }) {
  page.elements.push({
    type: 'line',
    x1,
    y1,
    x2,
    y2,
    width,
  })
}

function addRect(page, { x, y, width, height, lineWidth = 0.8 }) {
  page.elements.push({
    type: 'rect',
    x,
    y,
    width,
    height,
    lineWidth,
  })
}

function addWrappedBlock(page, paragraphs, options) {
  const {
    startY,
    x,
    widthChars,
    font = 'F1',
    size = 10.5,
    lineHeight = 13,
    paragraphGap = 5,
    firstLineIndent = 0,
    hangingIndent = 0,
  } = options

  let currentY = startY

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const lines = wrapText(paragraph, widthChars)

    lines.forEach((line, lineIndex) => {
      const offsetX = lineIndex === 0 ? firstLineIndent : hangingIndent
      addText(page, {
        text: line,
        x: x + offsetX,
        y: currentY,
        font,
        size,
      })
      currentY -= lineHeight
    })

    if (paragraphIndex < paragraphs.length - 1) {
      currentY -= paragraphGap
    }
  })

  return currentY
}

function estimateWrappedHeight(paragraphs, { widthChars, lineHeight, paragraphGap }) {
  if (!paragraphs.length) return lineHeight

  return paragraphs.reduce((total, paragraph, index) => {
    const lines = wrapText(paragraph, widthChars).length || 1
    return total + (lines * lineHeight) + (index < paragraphs.length - 1 ? paragraphGap : 0)
  }, 0)
}

function finalizePageDecorations(pages, { pageWidth, pageHeight, marginLeft, marginRight, headerText, subheaderText }) {
  pages.forEach((page, index) => {
    addText(page, {
      text: headerText,
      x: marginLeft,
      y: pageHeight - 28,
      font: 'F2',
      size: 8.5,
    })
    addText(page, {
      text: subheaderText,
      x: pageWidth - marginRight,
      y: pageHeight - 28,
      font: 'F1',
      size: 8.5,
      align: 'right',
    })
    addLine(page, {
      x1: marginLeft,
      y1: pageHeight - 36,
      x2: pageWidth - marginRight,
      y2: pageHeight - 36,
      width: 0.8,
    })
    addLine(page, {
      x1: marginLeft,
      y1: 42,
      x2: pageWidth - marginRight,
      y2: 42,
      width: 0.8,
    })
    addText(page, {
      text: `${index + 1}`,
      x: pageWidth / 2,
      y: 28,
      font: 'F1',
      size: 9,
      align: 'center',
    })
  })
}

function paginatePaper({ title, collectionName, sections }) {
  const pageWidth = 595
  const pageHeight = 842
  const marginLeft = 56
  const marginRight = 56
  const topStart = pageHeight - 62
  const bottomLimit = 58
  const columnGap = 26
  const columnWidth = (pageWidth - marginLeft - marginRight - columnGap) / 2
  const rightColumnX = marginLeft + columnWidth + columnGap
  const fullWidthChars = 95
  const columnChars = 41
  const standardBodyTop = pageHeight - 74
  const pages = [createPage(standardBodyTop)]
  let currentPageIndex = 0
  let cursorY = topStart

  const firstPage = pages[0]
  const normalizedTitle = normalizePdfText(title || 'Paper de coleccion')
  const normalizedCollectionName = normalizePdfText(collectionName || 'Coleccion activa')
  const dateLine = normalizePdfText(
    new Date().toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  )

  wrapText(normalizedTitle, 54).forEach((line, index) => {
    addText(firstPage, {
      text: line,
      x: pageWidth / 2,
      y: cursorY - (index * 24),
      font: 'F2',
      size: 18,
      align: 'center',
    })
  })
  cursorY -= Math.max(wrapText(normalizedTitle, 54).length * 24, 24)

  addText(firstPage, {
    text: 'Collection Synthesis Manuscript',
    x: pageWidth / 2,
    y: cursorY - 4,
    font: 'F2',
    size: 10,
    align: 'center',
  })
  addText(firstPage, {
    text: normalizedCollectionName,
    x: pageWidth / 2,
    y: cursorY - 20,
    font: 'F1',
    size: 10,
    align: 'center',
  })
  addText(firstPage, {
    text: `Fecha de generacion: ${dateLine}`,
    x: pageWidth / 2,
    y: cursorY - 34,
    font: 'F1',
    size: 9.5,
    align: 'center',
  })
  cursorY -= 58

  const abstractParagraphs = buildParagraphs(getSectionContent(sections, 'RESUMEN'))
  if (abstractParagraphs.length > 0) {
    const abstractHeight = estimateWrappedHeight(abstractParagraphs, {
      widthChars: fullWidthChars,
      lineHeight: 12,
      paragraphGap: 4,
    })
    const boxHeight = abstractHeight + 32
    const boxY = cursorY - boxHeight

    addRect(firstPage, {
      x: marginLeft - 10,
      y: boxY,
      width: pageWidth - marginLeft - marginRight + 20,
      height: boxHeight,
      lineWidth: 0.9,
    })
    addText(firstPage, {
      text: 'ABSTRACT',
      x: marginLeft,
      y: cursorY - 16,
      font: 'F2',
      size: 10.5,
    })
    addWrappedBlock(firstPage, abstractParagraphs, {
      startY: cursorY - 32,
      x: marginLeft,
      widthChars: fullWidthChars,
      font: 'F1',
      size: 10,
      lineHeight: 12,
      paragraphGap: 4,
      firstLineIndent: 10,
    })
    cursorY = boxY - 20
  }

  firstPage.bodyTop = cursorY
  let currentColumn = 0
  let currentY = firstPage.bodyTop

  const getCurrentPage = () => pages[currentPageIndex]
  const getColumnX = () => (currentColumn === 0 ? marginLeft : rightColumnX)

  const moveToNextColumn = () => {
    if (currentColumn === 0) {
      currentColumn = 1
      currentY = getCurrentPage().bodyTop
      return
    }

    pages.push(createPage(standardBodyTop))
    currentPageIndex = pages.length - 1
    currentColumn = 0
    currentY = getCurrentPage().bodyTop
  }

  const ensureColumnSpace = (requiredHeight) => {
    if (currentY - requiredHeight < bottomLimit) {
      moveToNextColumn()
    }
  }

  const bodySections = sections.filter(
    (section) => !['TITULO', 'RESUMEN', 'REFERENCIAS CITADAS'].includes(section.heading)
  )

  bodySections.forEach((section) => {
    const paragraphs = buildParagraphs(section.content)
    const sectionHeadingHeight = 18
    const minimumSectionHeight = sectionHeadingHeight + 24

    ensureColumnSpace(minimumSectionHeight)
    addText(getCurrentPage(), {
      text: section.heading,
      x: getColumnX(),
      y: currentY,
      font: 'F2',
      size: 10.5,
    })
    currentY -= 16

    paragraphs.forEach((paragraph, paragraphIndex) => {
      const lines = wrapText(paragraph, columnChars)

      lines.forEach((line, lineIndex) => {
        ensureColumnSpace(13)
        addText(getCurrentPage(), {
          text: line,
          x: getColumnX() + (lineIndex === 0 ? 10 : 0),
          y: currentY,
          font: 'F1',
          size: 9.4,
        })
        currentY -= 12.5
      })

      if (paragraphIndex < paragraphs.length - 1) {
        currentY -= 5
      }
    })

    currentY -= 10
  })

  const referenceEntries = buildReferenceEntries(getSectionContent(sections, 'REFERENCIAS CITADAS'))
  if (referenceEntries.length > 0) {
    pages.push(createPage(standardBodyTop))
    currentPageIndex = pages.length - 1
    const referencePage = getCurrentPage()
    let referenceY = referencePage.bodyTop

    addText(referencePage, {
      text: 'REFERENCIAS CITADAS',
      x: marginLeft,
      y: referenceY,
      font: 'F2',
      size: 11,
    })
    referenceY -= 18

    referenceEntries.forEach((entry, entryIndex) => {
      const label = `${entryIndex + 1}.`
      const lines = wrapText(entry, 82)

      lines.forEach((line, lineIndex) => {
        if (referenceY - 13 < bottomLimit) {
          pages.push(createPage(standardBodyTop))
          currentPageIndex = pages.length - 1
          referenceY = getCurrentPage().bodyTop
        }

        addText(getCurrentPage(), {
          text: lineIndex === 0 ? label : '',
          x: marginLeft,
          y: referenceY,
          font: 'F1',
          size: 9.6,
        })
        addText(getCurrentPage(), {
          text: line,
          x: marginLeft + 18,
          y: referenceY,
          font: 'F3',
          size: 9.8,
        })
        referenceY -= 12.5
      })

      if (entryIndex < referenceEntries.length - 1) {
        referenceY -= 6
      }
    })
  }

  finalizePageDecorations(pages, {
    pageWidth,
    pageHeight,
    marginLeft,
    marginRight,
    headerText: 'MANUSCRITO CIENTIFICO',
    subheaderText: normalizedCollectionName,
  })

  return { pageWidth, pageHeight, pages }
}

function buildContentStream(page) {
  return page.elements
    .map((element) => {
      if (element.type === 'text') {
        const baseX =
          element.align === 'center'
            ? element.x - (estimateTextWidth(element.text, element.size) / 2)
            : element.align === 'right'
              ? element.x - estimateTextWidth(element.text, element.size)
              : element.x

        return `BT\n/${element.font} ${element.size} Tf\n1 0 0 1 ${baseX} ${element.y} Tm\n(${escapePdfString(element.text)}) Tj\nET`
      }

      if (element.type === 'line') {
        return `${element.width} w\n${element.x1} ${element.y1} m\n${element.x2} ${element.y2} l\nS`
      }

      if (element.type === 'rect') {
        return `${element.lineWidth} w\n${element.x} ${element.y} ${element.width} ${element.height} re\nS`
      }

      return ''
    })
    .filter(Boolean)
    .join('\n')
}

export function createPaperPdfBlob({ title, collectionName, sections }) {
  const { pageWidth, pageHeight, pages } = paginatePaper({
    title,
    collectionName,
    sections,
  })

  const objects = []
  const fontRegularId = 3
  const fontBoldId = 4
  const fontItalicId = 5
  const firstPageObjectId = 6

  objects.push({ id: 1, content: '<< /Type /Catalog /Pages 2 0 R >>' })
  objects.push({
    id: 2,
    content: `<< /Type /Pages /Kids [${pages.map((_, index) => `${firstPageObjectId + index * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`,
  })
  objects.push({ id: fontRegularId, content: '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>' })
  objects.push({ id: fontBoldId, content: '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>' })
  objects.push({ id: fontItalicId, content: '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Italic >>' })

  pages.forEach((page, index) => {
    const pageObjectId = firstPageObjectId + index * 2
    const contentObjectId = pageObjectId + 1
    const stream = buildContentStream(page)

    objects.push({
      id: pageObjectId,
      content: `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R /F3 ${fontItalicId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`,
    })
    objects.push({
      id: contentObjectId,
      content: `<< /Length ${byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    })
  })

  objects.sort((a, b) => a.id - b.id)

  let pdf = '%PDF-1.4\n'
  const offsets = [0]

  objects.forEach((object) => {
    offsets[object.id] = byteLength(pdf)
    pdf += `${object.id} 0 obj\n${object.content}\nendobj\n`
  })

  const xrefOffset = byteLength(pdf)
  const objectCount = objects[objects.length - 1].id

  pdf += `xref\n0 ${objectCount + 1}\n`
  pdf += '0000000000 65535 f \n'

  for (let index = 1; index <= objectCount; index += 1) {
    const offset = String(offsets[index] || 0).padStart(10, '0')
    pdf += `${offset} 00000 n \n`
  }

  pdf += `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  return new Blob([pdf], { type: 'application/pdf' })
}

export function openPdfBlob(blob) {
  const blobUrl = URL.createObjectURL(blob)
  window.open(blobUrl, '_blank', 'noopener,noreferrer')
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)
}

export function downloadPdfBlob(blob, filename) {
  const blobUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = blobUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60000)
}
