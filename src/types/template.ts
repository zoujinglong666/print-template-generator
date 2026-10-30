/** 打印模板编辑器 —— 模板 Schema 类型定义 */

export type ElementType =
  | 'title'      // 大标题（居中加粗）
  | 'text'       // 自由文本，支持 {{字段}} 占位
  | 'labelValue' // 标签:值
  | 'table'      // 数据表格（绑定数组字段）
  | 'image'      // 图片（绑定字段 URL）
  | 'line'       // 分隔线
  | 'barcode'    // 条形码（CODE128 / EAN13 / CODE39）
  | 'qrcode'     // 二维码

export type Align = 'left' | 'center' | 'right'
export type VAlign = 'top' | 'middle' | 'bottom'

export interface ElStyle {
  fontSize?: number          // pt
  bold?: boolean
  align?: Align
  vAlign?: VAlign
  color?: string
  headerBg?: string          // 表格表头背景
  borderColor?: string       // 表格边框颜色
  thickness?: number         // 线条粗细（pt），仅 line 元素
}

export interface BaseElement {
  id: string
  type: ElementType
  /** 位置与尺寸，单位 mm（相对 A4 页面） */
  x: number
  y: number
  w: number
  h: number
  style: ElStyle
  /** 成组：同组元素拖拽时刚体移动；组内锚定成员带动整组跟随 */
  groupId?: string
  /** 锚点跟随：源元素 id。渲染/打印布局后实测源元素底边，本元素（及所在组）top = 源底边 + gapMm（表格行数不定时表尾跟随） */
  anchor?: string
  /** 锚点跟随间距（mm），默认 4 */
  gapMm?: number
}

export interface TitleElement extends BaseElement {
  type: 'title'
  text: string
}
export interface TextElement extends BaseElement {
  type: 'text'
  text: string
}
export interface LabelValueElement extends BaseElement {
  type: 'labelValue'
  label: string
  value: string // 支持 {{field}} 或直接字段名
}
export interface ImageElement extends BaseElement {
  type: 'image'
  field: string // 数据中的图片 URL 字段路径
}
export interface LineElement extends BaseElement {
  type: 'line'
}
export interface BarcodeElement extends BaseElement {
  type: 'barcode'
  /** 编码内容，支持 {{field}} 占位（打印时取数据） */
  value: string
  /** 条码制式 */
  format: 'CODE128' | 'EAN13' | 'CODE39'
  /** 是否在人眼可读区显示文本 */
  showText: boolean
}
export interface QrCodeElement extends BaseElement {
  type: 'qrcode'
  /** 编码内容，支持 {{field}} 占位 */
  value: string
  /** 容错级别 L(7%) M(15%) Q(25%) H(30%) */
  ecl: 'L' | 'M' | 'Q' | 'H'
}
export interface TableColumn {
  title: string
  field: string // '__serial' 表示序号列
  width: string // 如 '8%' 或 '20mm'
  align: Align
  /** 表头合并：跨列数（>1 表示向右合并相邻列） */
  colSpan?: number
  /** 最小宽度（百分比 0-100），拖拽/自适应时约束本列不可窄于此 */
  minWidth?: number
  /** 最大宽度（百分比 0-100），拖拽/自适应时约束本列不可宽于此 */
  maxWidth?: number
}
export interface TableElement extends BaseElement {
  type: 'table'
  srcField: string // 数据源数组字段路径，如 details
  columns: TableColumn[]
  showSummary: boolean
  summaryLabel: string
  /** 合计标签横跨的列数 */
  summarySpan: number
  /** 需要求和的列字段 */
  sumFields: string[]
  /** 编辑器内预览的数据行数（仅设计期显示，不影响导出） */
  previewRows?: number
}

export type TemplateElement =
  | TitleElement | TextElement | LabelValueElement
  | ImageElement | LineElement | TableElement
  | BarcodeElement | QrCodeElement

export interface PageConfig {
  widthMm: number
  heightMm: number
  /** 页面边距（mm）：导出/转换为流式模板时的内容边距，默认 10 */
  marginMm?: number
}

export interface TemplateSchema {
  name: string
  page: PageConfig
  elements: TemplateElement[]
}
