/**
 * 标签模板 Schema + 纯函数（与 print-canvas-designer 的文档结构对齐，类型自含）。
 *
 * ERP 对接方式（整体拷贝 label-kit 目录到 ERP 项目）：
 *   import LabelDoc from './label-kit/LabelDoc.vue'
 *   import { buildLabelSampleData } from './label-kit/label-schema'
 *   import { useLabelPrint } from './label-kit/useLabelPrint'
 *   <LabelDoc :template="tpl.template" :data="tpl.sampleData" />
 * 模板数据 = 设计器「导出模板数据」产物：{ name, template: LabelDocument, sampleData }。
 *
 * 单位约定：页面与元素尺寸均为 px（96dpi，1mm = 96/25.4 px）。
 */

/** 内置 6 类 + 兼容设计器自定义组件类型（string & {}） */
export type LabelElementType = 'text' | 'image' | 'rect' | 'line' | 'qrcode' | 'barcode' | (string & {})
export type LabelPaperType = 'a4' | 'label-100x60' | 'custom'
export type LabelTextWrapMode = 'wrap' | 'nowrap' | 'ellipsis' | 'clip'

export interface LabelPage {
  id: string
  type: 'page'
  paperType?: LabelPaperType
  orientation?: 'portrait' | 'landscape'
  /** px（96dpi） */
  width: number
  height: number
  margin?: { top: number; right: number; bottom: number; left: number }
  backgroundColor: string
  items: LabelElement[]
}

export interface LabelElementStyle {
  position: 'absolute'
  left: number
  top: number
  width: number
  height: number
  rotate?: number
  color?: string
  backgroundColor?: string
  fontSize?: number
  fontWeight?: string | number
  fontStyle?: string
  textDecoration?: string
  justifyContent?: string
  alignItems?: string
  textAlign?: string
  textWrapMode?: LabelTextWrapMode
  letterSpacing?: number
  borderColor?: string
  borderWidth?: number
  borderStyle?: string
  borderRadius?: number
  lineHeight?: string | number
  objectFit?: string
}

export interface LabelElement {
  id: string
  type: LabelElementType
  name: string
  /** 绑定的数据字段路径 */
  field?: string
  /** 静态文本（支持 {{field}} 插值） */
  text?: string
  /** 图片 URL（image） */
  src?: string
  /** 静态码值（qrcode/barcode，支持 {{field}} 插值） */
  value?: string
  barcodeFormat?: string
  showBarcodeText?: boolean
  barcodeTextFontSize?: number
  barcodeTextPosition?: 'top' | 'bottom'
  barcodeTextAlign?: string
  barcodeTextMargin?: number
  barcodeMargin?: number
  qrcodeErrorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
  qrcodeMargin?: number
  barcodeLineWidth?: number
  barcodeHeight?: number
  /**
   * 条码数字文字字体（JsBarcode 的 `font` 选项）。如 'monospace'、'Arial'、'Microsoft YaHei'。
   * 留空/不传时用 JsBarcode 默认字体，与设计器画布保持一致；传入则渲染/打印换为该字体。
   * 注意：设计器（print-canvas-designer）暂不支持配置此项，故画布仍显示默认字体，仅 label-kit 渲染/打印生效。
   */
  barcodeFont?: string
  locked?: boolean
  hidden?: boolean
  style: LabelElementStyle
}

export interface LabelDocument {
  id: string
  name: string
  page: LabelPage
}

export interface LabelData {
  [key: string]: unknown
}

/** 内联样式对象类型（LabelDoc.vue 样式辅助函数返回值） */
export type CSSLikeStyle = Partial<Record<string, string | number | undefined>>

/** px（96dpi）基准 */
export const PX_PER_MM = 96 / 25.4

/** px → mm（用于 @page size），保留 2 位小数 */
export function pxToMm(px: number): number {
  return Math.round((px / PX_PER_MM) * 100) / 100
}

/** mm → px（96dpi 取整，与设计器一致） */
export function mmToPx(mm: number): number {
  return Math.round((mm * 96) / 25.4)
}

/** 按路径取值（'a.b.c'） */
export function readPath(obj: unknown, path: string): unknown {
  if (!path) return obj
  return String(path)
    .split('.')
    .reduce<unknown>((o, k) => (o == null ? undefined : (o as LabelData)[k]), obj)
}

/** 安全 URL：拦截 javascript:/vbscript:/data:/file: 等 XSS 向量 */
export function safeUrl(v: unknown): string {
  const s = String(v ?? '').trim()
  return /^(javascript|vbscript|data|file):/i.test(s) ? '' : s
}

/** {{field}} 插值：缺失字段渲染为空 */
export function fillText(text: string, data: LabelData): string {
  return String(text ?? '').replace(/\{\{([^}]+)\}\}/g, (_m, p: string) => {
    const v = readPath(data, p.trim())
    if (v == null) return ''
    return Array.isArray(v) ? v.map((x) => String(x ?? '')).join(', ') : String(v)
  })
}

/** 元素显示值：绑定字段优先，其次静态文本/value 插值 */
export function elementValue(el: LabelElement, data: LabelData): string {
  if (el.field) {
    const v = readPath(data, el.field)
    if (v != null && v !== '') {
      return Array.isArray(v) ? v.map((x) => String(x ?? '')).join(', ') : String(v)
    }
  }
  return fillText(el.text ?? el.value ?? '', data)
}

/** qrcode/barcode 的码值：绑定字段优先，其次 value 插值 */
export function codeValue(el: LabelElement, data: LabelData): string {
  if (el.field) {
    const v = readPath(data, el.field)
    if (v != null && v !== '') return String(v)
  }
  return fillText(el.value ?? '', data)
}

/**
 * 按模板字段自动生成示例数据：字段值显示为 {{字段名}} 占位，
 * 便于拿到模板后一眼看出字段对应关系（与单据流式 buildSampleData 的占位模式一致）。
 */
export function buildLabelSampleData(
  doc: { page?: { items?: Array<{ field?: string; hidden?: boolean }> } }
): LabelData {
  const data: LabelData = {}
  const items = doc.page?.items ?? []
  for (const el of items) {
    if (!el.field || el.hidden || el.field in data) continue
    data[el.field] = `{{${el.field}}}`
  }
  return data
}
