import type { SearchIndex } from './data'

export type SearchScope = 'all' | 'job' | 'bill' | 'customer' | 'content'

export interface SearchHit {
  id: string
  kind: 'document' | 'shipment'
  href: string
  title: string
  subtitle: string
  snippet?: { before: string; match: string; after: string }
  matchedIn: SearchScope
  score: number
}

export function normalize(text: string) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

function levenshtein(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0]
    prev[0] = i
    let rowMin = prev[0]
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1))
      last = tmp
      rowMin = Math.min(rowMin, prev[j])
    }
    if (rowMin > max) return max + 1
  }
  return prev[b.length]
}

const tolerance = (token: string) => (token.length <= 3 ? 0 : token.length <= 6 ? 1 : 2)

/** Score how well `query` tokens match `text`. Returns 0 when any token fails. */
function matchText(query: string[], text: string): { score: number; firstIndex: number; length: number } {
  const norm = normalize(text)
  const words = norm.split(/[^a-z0-9]+/).filter(Boolean)
  let score = 0
  let firstIndex = -1
  let length = 0
  for (const token of query) {
    const exactIdx = norm.indexOf(token)
    if (exactIdx >= 0) {
      score += 3
      if (firstIndex < 0) {
        firstIndex = exactIdx
        length = token.length
      }
      continue
    }
    const tol = tolerance(token)
    const fuzzy = tol > 0 && words.find((w) => levenshtein(token, w.slice(0, token.length + tol), tol) <= tol)
    if (!fuzzy) return { score: 0, firstIndex: -1, length: 0 }
    score += 1
    if (firstIndex < 0) {
      firstIndex = norm.search(new RegExp(`(^|[^a-z0-9])${fuzzy}`)) + 1
      if (firstIndex <= 0) firstIndex = norm.indexOf(fuzzy)
      length = fuzzy.length
    }
  }
  return { score, firstIndex, length }
}

function snippet(text: string, index: number, length: number, radius = 48) {
  const start = Math.max(0, index - radius)
  const end = Math.min(text.length, index + length + radius)
  return {
    before: (start > 0 ? '…' : '') + text.slice(start, index),
    match: text.slice(index, index + length),
    after: text.slice(index + length, end) + (end < text.length ? '…' : ''),
  }
}

export function search(index: SearchIndex, rawQuery: string, scope: SearchScope = 'all'): SearchHit[] {
  const tokens = normalize(rawQuery).split(/\s+/).filter(Boolean)
  if (!tokens.length) return []
  const hits: SearchHit[] = []
  const customerName = (id: string) => index.customers.find((c) => c.id === id)?.shortName ?? ''

  for (const s of index.shipments) {
    const fields: [SearchScope, string][] = [
      ['job', s.jobNo],
      ['bill', s.blNo],
      ['customer', `${customerName(s.customerId)} ${index.customers.find((c) => c.id === s.customerId)?.name}`],
    ]
    for (const [field, value] of fields) {
      if (scope !== 'all' && scope !== field) continue
      const m = matchText(tokens, value)
      if (m.score) {
        hits.push({
          id: `sh_${s.id}`,
          kind: 'shipment',
          href: `/shipments/${s.id}`,
          title: s.jobNo,
          subtitle: `B/L ${s.blNo} · ${customerName(s.customerId)}`,
          matchedIn: field,
          score: m.score + 2,
        })
        break
      }
    }
  }

  for (const d of index.documents) {
    const s = index.shipments.find((x) => x.id === d.shipmentId)!
    const fields: [SearchScope, string][] = [
      ['job', `${s.jobNo} ${d.fileName}`],
      ['bill', s.blNo],
      ['customer', customerName(d.customerId)],
      ['content', d.ocrText],
    ]
    for (const [field, value] of fields) {
      if (scope !== 'all' && scope !== field) continue
      const m = matchText(tokens, field === 'content' ? value : `${d.title} ${value}`)
      if (m.score) {
        const source = field === 'content' ? d.ocrText : `${d.title} ${value}`
        hits.push({
          id: d.id,
          kind: 'document',
          href: `/documents/${d.id}`,
          title: d.title,
          subtitle: `${s.jobNo} · ${customerName(d.customerId)}`,
          snippet: field === 'content' && m.firstIndex >= 0 ? snippet(source, m.firstIndex, m.length) : undefined,
          matchedIn: field,
          score: m.score,
        })
        break
      }
    }
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, 24)
}
