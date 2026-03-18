import { transformStyleToTailwindcss } from 'transform-to-tailwindcss-core'

const CSS_COMMENT_RE = /\/\*.*?\*\//g
const CSS_VAR_RE = /var\(--[\w-]+(?:,\s*.+?)?\)/

function cleanValue(value: string): string {
  return value.replace(CSS_COMMENT_RE, '').trim()
}

const IGNORED_PROPERTIES = new Set(['font-family', 'border-image', 'border-image-slice'])

const FONT_WEIGHT_MAP: Record<string, string> = {
  '100': 'font-thin',
  '200': 'font-extralight',
  '300': 'font-light',
  '400': 'font-normal',
  '500': 'font-medium',
  '600': 'font-semibold',
  '700': 'font-bold',
  '800': 'font-extrabold',
  '900': 'font-black'
}

const FONT_WEIGHT_ARBITRARY_RE = /font-\[weight:(\d+)\]/g
const BG_GRADIENT_RE = /bg-gradient-linear\s+bg-gradient-\[([^\]]+)\]/g
const BORDER_PX_SOLID_RE = /border-\[(\d+)px\]\s+border-solid/g

function postProcess(converted: string): string {
  let result = converted

  result = result.replace(FONT_WEIGHT_ARBITRARY_RE, (_, weight) => {
    return FONT_WEIGHT_MAP[weight] ?? `[font-weight:${weight}]`
  })

  result = result.replace(BG_GRADIENT_RE, (_, params) => {
    return `[background:linear-gradient(${params})]`
  })

  result = result.replace(BORDER_PX_SOLID_RE, (_, width) => {
    return width === '1' ? 'border' : `border-${width} border-solid`
  })

  result = result
    .split(' ')
    .filter((cls) => cls !== 'not-italic')
    .join(' ')

  return result
}

function toArbitrary(prop: string, value: string): string {
  const normalized = value
    .replace(/var\(-{3,}/g, 'var(--')
    .replace(/\s+/g, '_')
    .replace(/["']/g, '')
  return `[${prop}:${normalized}]`
}

export function cssToTailwind(style: Record<string, string>, isRem: boolean): string {
  if (!style || Object.keys(style).length === 0) return ''

  const standardEntries: string[] = []
  const varClasses: string[] = []

  for (const [key, rawValue] of Object.entries(style)) {
    if (!rawValue || IGNORED_PROPERTIES.has(key)) continue
    const value = cleanValue(rawValue)
    if (!value) continue

    if (CSS_VAR_RE.test(value)) {
      varClasses.push(toArbitrary(key, value))
    } else {
      standardEntries.push(`${key}: ${value}`)
    }
  }

  const parts: string[] = []

  if (standardEntries.length > 0) {
    const cleaned = standardEntries.join('; ')
    const [converted, unconverted] = transformStyleToTailwindcss(cleaned, isRem)

    if (converted) parts.push(postProcess(converted))

    for (const entry of unconverted) {
      const match = entry.trim().match(/^([\w-]+)\s*:\s*(.+)$/)
      if (match) {
        parts.push(toArbitrary(match[1], match[2].trim()))
      }
    }
  }

  parts.push(...varClasses)

  return parts.join(' ')
}
