/**
 * 自研单据模板渲染 —— Schema 宽松类型 + 辅助纯函数。
 *
 * ERP 对接方式（整体拷贝 DocumentDoc.vue / document-runtime.js / document-runtime.d.ts / document-schema.ts）：
 *   import DocumentDoc from './print-kit/DocumentDoc.vue'
 *   import { docPageExtraCss, buildDocSampleData } from './print-kit/document-schema'
 *   // 模板数据 = 单据设计器「导出模板数据」产物：{ name, template, sampleData }
 *   <DocumentDoc :template="tpl.template" :data="tpl.sampleData" />
 *   // 打印：usePrint(hostEl, { extraCss: docPageExtraCss(tpl.template.page) })
 *
 * 与「流式渲染（PrintDoc）」不同：本渲染器直接按绝对定位 mm 坐标渲染自研模板，
 * 版式零损失，所见即所得（与设计器画布完全一致）。
 */

/** 元素类型（内置 6 类，兼容扩展类型） */
export type DocElementType =
  | 'title' | 'text' | 'labelValue' | 'table' | 'image' | 'line'
  | (string & {})

export interface DocElementLike {
  id: string
  type: DocElementType
  /** 位置与尺寸，单位 mm */
  x: number
  y: number
  w: number
  h: number
  style?: Record<string, unknown>
  text?: string
  label?: string
  /** 支持 {{field}} 或直接字段名 */
  value?: string
  /** 图片/表格行数据绑定的字段路径 */
  field?: string
  srcField?: string
  columns?: Array<{
    title?: string
    field?: string
    width?: string
    align?: 'left' | 'center' | 'right' | (string & {})
    colSpan?: number
  }>
  showSummary?: boolean
  summaryLabel?: string
  summarySpan?: number
  sumFields?: string[]
  previewRows?: number
  /** 锚点跟随：源元素 id。渲染后本元素 top = 源元素实际底边 + gapMm（表格行数不定时表尾跟随） */
  anchor?: string
  /** 锚点跟随间距（mm），默认 4 */
  gapMm?: number
}

export interface DocSchemaLike {
  name?: string
  page: { widthMm: number; heightMm: number; marginMm?: number }
  elements: DocElementLike[]
}

export interface DocData {
  [key: string]: unknown
}

/** 内联样式对象类型（DocumentDoc.vue 页面样式） */
export type CSSLikeStyle = Partial<Record<string, string | number | undefined>>

const PLACEHOLDER_RE = /\{\{([^}]+)\}\}/g

/**
 * 打印辅助：@page 尺寸由模板页面驱动。
 * 自研渲染的元素坐标已包含页边距，@page margin 固定为 0，屏幕与打印完全一致。
 */
export function docPageExtraCss(page: { widthMm: number; heightMm: number }): string {
  return `@page { size: ${page.widthMm}mm ${page.heightMm}mm; margin: 0; }`
}

/**
 * 按模板字段自动生成示例数据：字段值显示为 {{字段名}} 占位，
 * 表格按行数组字段生成 rowCount 行。用于导出模板数据时附带测试样例。
 */
export function buildDocSampleData(schema: DocSchemaLike, rowCount = 6): DocData {
  const data: DocData = {}
  const put = (f: string): void => {
    const key = f.trim()
    if (key && !(key in data)) data[key] = `{{${key}}}`
  }
  for (const el of schema.elements) {
    if (el.type === 'title' || el.type === 'text' || el.type === 'labelValue') {
      const src = el.type === 'labelValue' ? el.value : el.text
      for (const m of String(src ?? '').matchAll(PLACEHOLDER_RE)) put(m[1])
    } else if (el.type === 'image') {
      if (el.field) data[el.field] = ''
    } else if (el.type === 'table') {
      const row: DocData = {}
      for (const c of el.columns ?? []) {
        if (c.field && c.field !== '__serial') row[c.field] = `{{${c.field}}}`
      }
      data[el.srcField || 'details'] = Array.from({ length: Math.max(1, rowCount) }, () => ({ ...row }))
    }
  }
  return data
}
