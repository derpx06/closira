const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const renderInline = (value: string): string => {
  const withImages = value.replace(
    /!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g,
    (_, alt, url) =>
      `<img class="chatbot-image" src="${url}" alt="${alt || 'uploaded image'}" />`,
  )
  const withLinks = withImages.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    (_, text, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`,
  )
  const withAutoLinks = withLinks.replace(
    /&lt;(https?:\/\/[^&]+)&gt;/g,
    (_, url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`,
  )
  const withBold = withAutoLinks.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  const withItalic = withBold.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  return withItalic.replace(/`([^`]+)`/g, '<code>$1</code>')
}

const renderMarkdownBlocks = (value: string): string => {
  const lines = value.split(/\r?\n/)
  const output: string[] = []
  let idx = 0

  const pushParagraph = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    output.push(`<p class="chatbot-md-p">${renderInline(trimmed)}</p>`)
  }

  while (idx < lines.length) {
    const raw = lines[idx] ?? ''
    const line = raw.trim()

    if (!line) {
      output.push('<div class="chatbot-md-spacer"></div>')
      idx += 1
      continue
    }

    const h3 = raw.match(/^###\s+(.+)$/)
    const h2 = raw.match(/^##\s+(.+)$/)
    const h1 = raw.match(/^#\s+(.+)$/)
    if (h3 || h2 || h1) {
      const text = renderInline(escapeHtml((h3 || h2 || h1)?.[1] || ''))
      const cls = h3 ? 'chatbot-md-h3' : h2 ? 'chatbot-md-h2' : 'chatbot-md-h1'
      output.push(`<div class="${cls}">${text}</div>`)
      idx += 1
      continue
    }

    const unordered = raw.match(/^\s*[-*+]\s+(.+)$/)
    if (unordered) {
      const items: string[] = []
      while (idx < lines.length) {
        const entry = lines[idx] ?? ''
        const match = entry.match(/^\s*[-*+]\s+(.+)$/)
        if (!match) break
        items.push(`<li>${renderInline(escapeHtml(match[1]))}</li>`)
        idx += 1
      }
      output.push(`<ul class="chatbot-md-list">${items.join('')}</ul>`)
      continue
    }

    const ordered = raw.match(/^\s*\d+\.\s+(.+)$/)
    if (ordered) {
      const items: string[] = []
      while (idx < lines.length) {
        const entry = lines[idx] ?? ''
        const match = entry.match(/^\s*\d+\.\s+(.+)$/)
        if (!match) break
        items.push(`<li>${renderInline(escapeHtml(match[1]))}</li>`)
        idx += 1
      }
      output.push(`<ol class="chatbot-md-list ordered">${items.join('')}</ol>`)
      continue
    }

    // Paragraph block
    const paragraphLines: string[] = []
    while (idx < lines.length) {
      const entry = lines[idx] ?? ''
      const trimmedEntry = entry.trim()
      if (!trimmedEntry) break
      if (/^###\s+/.test(entry) || /^##\s+/.test(entry) || /^#\s+/.test(entry)) break
      if (/^\s*[-*+]\s+/.test(entry) || /^\s*\d+\.\s+/.test(entry)) break
      paragraphLines.push(trimmedEntry)
      idx += 1
    }
    pushParagraph(escapeHtml(paragraphLines.join(' ')))
  }

  return output.join('')
}

const extractReferenceLinks = (value: string): Array<{ label: string; url: string }> => {
  const text = String(value || '')
  const headerMatch = text.match(/^##+\s+References\s*$/im) || text.match(/^References\s*$/im)
  if (!headerMatch || headerMatch.index == null) return []
  const start = headerMatch.index + headerMatch[0].length
  const after = text.slice(start)
  const lines = after.split(/\r?\n/)
  const links: Array<{ label: string; url: string }> = []
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue
    if (/^##+/.test(line)) break
    const mdMatch = line.match(/^\s*[-*]\s*\[([^\]]+)\]\((https?:\/\/[^)]+)\)/i)
    if (mdMatch) {
      links.push({ label: mdMatch[1], url: mdMatch[2] })
      continue
    }
    const urlMatch = line.match(/(https?:\/\/\S+)/i)
    if (urlMatch) {
      links.push({ label: urlMatch[1], url: urlMatch[1] })
    }
  }
  return links
}

const stripReferenceSection = (value: string): string => {
  const text = String(value || '')
  const headerMatch = text.match(/^##+\s+References\s*$/im) || text.match(/^References\s*$/im)
  if (!headerMatch || headerMatch.index == null) return text
  const before = text.slice(0, headerMatch.index).trimEnd()
  return before
}

export const renderMarkdown = (value: string): string => {
  const refLinks = extractReferenceLinks(value)
  const content = stripReferenceSection(value)
  const segments = String(content || '').split(/```/)
  const body = segments
    .map((segment, idx) => {
      if (idx % 2 === 1) {
        return `<pre><code>${escapeHtml(segment.trim())}</code></pre>`
      }
      const escaped = escapeHtml(segment)
      return renderMarkdownBlocks(escaped)
    })
    .join('')
  if (refLinks.length === 0) return body
  const chips = refLinks
    .map(
      (link) =>
        `<a class="chatbot-ref-chip" href="${link.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a>`,
    )
    .join('')
  return `${body}<div class="chatbot-ref-chips">${chips}</div>`
}
