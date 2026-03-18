import type { DesignComponent, DesignNode } from '@tempad-dev/plugins'

import { definePlugin } from '@tempad-dev/plugins'

import { cssToTailwind } from './css-to-tailwind'

const INDENT = '  '

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const NON_TAG_CHAR_RE = /[^\w-]/

function toKebabCase(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_/]+/g, '-')
    .toLowerCase()
}

function toTagName(name: string): string | null {
  const kebab = toKebabCase(name)
  if (!kebab || NON_TAG_CHAR_RE.test(kebab)) {
    return null
  }
  return kebab
}

function buildClassAttr(node: DesignNode, useRem: boolean): string {
  if (!node.style || Object.keys(node.style).length === 0) return ''
  const classes = cssToTailwind(node.style, useRem)
  return classes ? ` class="${escapeHtml(classes)}"` : ''
}

function renderNode(node: DesignNode, depth: number, useRem: boolean): string {
  const indent = INDENT.repeat(depth)

  if (!node.visible) return ''

  switch (node.type) {
    case 'TEXT': {
      const classAttr = buildClassAttr(node, useRem)
      if (classAttr) {
        return `${indent}<span${classAttr}>${escapeHtml(node.characters)}</span>`
      }
      return `${indent}${escapeHtml(node.characters)}`
    }

    case 'VECTOR':
      return `${indent}<!-- vector: ${escapeHtml(node.name)} -->`

    case 'GROUP':
    case 'FRAME': {
      const tag = 'div'
      const classAttr = buildClassAttr(node, useRem)
      const children = node.children
        .map((child) => renderNode(child, depth + 1, useRem))
        .filter(Boolean)

      if (children.length === 0) {
        return `${indent}<${tag}${classAttr} />`
      }
      return `${indent}<${tag}${classAttr}>\n${children.join('\n')}\n${indent}</${tag}>`
    }

    case 'INSTANCE': {
      const tag = toTagName(node.name) ?? 'div'
      const classAttr = buildClassAttr(node, useRem)
      const children = node.children
        .map((child) => renderNode(child, depth + 1, useRem))
        .filter(Boolean)

      if (children.length === 0) {
        return `${indent}<${tag}${classAttr} />`
      }
      return `${indent}<${tag}${classAttr}>\n${children.join('\n')}\n${indent}</${tag}>`
    }

    default:
      return ''
  }
}

function renderChildren(component: DesignComponent, useRem: boolean): string {
  return component.children
    .map((child) => renderNode(child, 2, useRem))
    .filter(Boolean)
    .join('\n')
}

export default definePlugin({
  name: 'Vue Tailwind',
  code: {
    component: {
      lang: 'vue',
      title: 'Vue (Tailwind)',
      transformComponent({ component, style, options }) {
        const classes = cssToTailwind(style, options.useRem)
        const classAttr = classes ? ` class="${escapeHtml(classes)}"` : ''

        if (component) {
          const tag = toTagName(component.name) ?? 'div'
          const childrenStr = renderChildren(component, options.useRem)

          if (childrenStr) {
            return [
              '<template>',
              `${INDENT}<${tag}${classAttr}>`,
              childrenStr,
              `${INDENT}</${tag}>`,
              '</template>'
            ].join('\n')
          }

          return ['<template>', `${INDENT}<${tag}${classAttr} />`, '</template>'].join('\n')
        }

        return ['<template>', `${INDENT}<div${classAttr} />`, '</template>'].join('\n')
      }
    },
    css: false,
    js: false
  }
})
