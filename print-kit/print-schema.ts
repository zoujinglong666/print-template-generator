/**
 * 流式单据打印模板 Schema（JSON 驱动）
 *
 * 设计器产物 = 本 Schema 的 JSON；ERP 端用 PrintDoc.vue 通用渲染器渲染。
 * 模板是数据：新增/微调模板不改代码、不发版。
 *
 * 5 种单元格类型覆盖常见单据：
 *   text   普通字段（支持兜底）
 *   serial 序号（行号+1）
 *   image  图片（内置 URL 协议安全校验）
 *   stack  多行堆叠（字段/插值文本/加粗标签）
 *   list   子列表循环（如三方仓 SKU、仓位明细）
 */

export type Lang = 'zh' | 'en'

/** 双语文案；也允许直接传字符串（单语言快捷写法） */
export type I18nText = string | { zh: string; en?: string }

/** 显示条件：与 flags 逐键严格相等；null/undefined = 兜底命中（放最后一个变体） */
export type Condition = Record<string, unknown>
export type PrintFlags = Record<string, unknown>
export type PrintData = Record<string, unknown>
export type Row = Record<string, unknown>

export type Align = 'left' | 'center' | 'right'

/** 内联样式对象类型（PrintDoc.vue 样式辅助函数返回值） */
export type CSSProperties = Partial<Record<string, string | number | undefined>>

export interface InfoItem {
  label: I18nText
  field: string
  /** 空值兜底文案，如 '-' */
  fallback?: string
  /** 数组值拼接分隔符，如 ', ' */
  join?: string
  /** 布尔值转文案（truthy 判定：true/'true'/1） */
  boolean?: { yes: I18nText; no?: string }
  /** 字号（pt），转换自研模板时携带 */
  fontSize?: number
  /** 与上一行的间距（mm），转换自研模板时按元素 y 坐标差计算，还原大间隙版式 */
  marginTopMm?: number
  visibleWhen?: Condition | null
}

export interface StackLine {
  /** 直接取字段 */
  field?: string
  /** 插值模板，如 '{warehousePositionName} ({qty})' */
  text?: string
  /** 行首加粗标签（双语文案） */
  label?: I18nText
  small?: boolean
}

export type Cell =
  | { kind: 'text'; field: string; fallback?: string }
  | { kind: 'serial' }
  | { kind: 'image'; field: string }
  | { kind: 'stack'; lines: StackLine[] }
  | { kind: 'list'; listField: string; lines: StackLine[] }

export interface TableColumnDef {
  key: string
  label: I18nText
  /** 如 '8%' 或 '20mm' */
  width: string
  /** 列内容对齐（缺省：表头居中、单元格左对齐） */
  align?: Align
  cell: Cell
}

/** 列变体：按 flags 命中第一个匹配的列集（如 单选/批打印/备货单批打印） */
export interface TableVariant {
  when?: Condition | null
  columns: TableColumnDef[]
}

export interface TableSpec {
  /** 行数组字段路径，如 'productDetails' */
  srcField: string
  variants: TableVariant[]
  /** 表格视觉样式（转换自研模板时携带，缺省用 print.css 默认） */
  style?: {
    /** 单元格字号（pt） */
    fontSize?: number
    /** 表头背景色 */
    headerBg?: string
    /** 边框颜色 */
    borderColor?: string
    /** 单元格内边距，如 '1.2mm 1.5mm' */
    cellPadding?: string
  }
}

/** 信息栅格（info 在表格上方，footer 在表格下方） */
export interface InfoSpec {
  columns?: number
  items: InfoItem[]
}

export interface PrintTemplate {
  name?: I18nText
  page?: { margin?: string }
  title?: { field: string; fallback?: string; fontSize?: number; bold?: boolean }
  info?: InfoSpec
  /** 表格下方的信息区（如 制单人/审核人/打印日期） */
  footer?: InfoSpec
  table?: TableSpec
}

/* ===================== 纯函数（渲染器与测试共用） ===================== */

export function readPath(obj: unknown, path: string): unknown {
  if (!path) return obj
  return path.split('.').reduce<unknown>((o, k) => (o == null ? undefined : (o as Row)[k]), obj)
}

export function t(text: I18nText | undefined, lang: Lang): string {
  if (text == null) return ''
  if (typeof text === 'string') return text
  return text[lang] ?? text.zh ?? ''
}

export function matchCondition(cond: Condition | null | undefined, flags: PrintFlags): boolean {
  if (!cond) return true
  return Object.keys(cond).every((k) => flags[k] === cond[k])
}

export function pickColumns(table: TableSpec | undefined, flags: PrintFlags): TableColumnDef[] {
  if (!table) return []
  const hit = table.variants.find((v) => matchCondition(v.when, flags))
  return hit?.columns ?? []
}

export function isItemVisible(item: InfoItem, flags: PrintFlags): boolean {
  return matchCondition(item.visibleWhen ?? null, flags)
}

const str = (v: unknown): string => (v == null ? '' : String(v))

/** 安全 URL：拦截 javascript:/vbscript:/data:/file: 等 XSS 向量 */
export function safeUrl(v: unknown): string {
  const s = str(v).trim()
  return /^(javascript|vbscript|data|file):/i.test(s) ? '' : s
}

/** 文本插值：'{a} ({b})' → 用 scope 中的字段替换 */
export function interpolate(text: string, scope: unknown): string {
  return text.replace(/\{(\w+(?:\.\w+)*)\}/g, (_m, p: string) => str(readPath(scope, p)))
}

export function lineText(line: StackLine, scope: unknown): string {
  if (line.field != null) return str(readPath(scope, line.field))
  if (line.text != null) return interpolate(line.text, scope)
  return ''
}

export function listItems(cell: Cell, row: Row): Row[] {
  if (cell.kind !== 'list') return []
  const v = readPath(row, cell.listField)
  return Array.isArray(v) ? (v as Row[]) : []
}

export function textCell(cell: Cell, row: Row): string {
  if (cell.kind !== 'text') return ''
  const v = readPath(row, cell.field)
  if (v == null || v === '') return cell.fallback ?? ''
  return Array.isArray(v) ? v.map((x) => str(x)).join(', ') : str(v)
}

export function imageSrc(cell: Cell, row: Row): string {
  return cell.kind === 'image' ? safeUrl(readPath(row, cell.field)) : ''
}

/** 信息项取值：boolean 转文案 → 数组 join → 兜底 */
export function infoValue(item: InfoItem, data: PrintData, lang: Lang): string {
  const v = readPath(data, item.field)
  if (item.boolean) {
    const truthy = v === true || v === 'true' || v === 1
    return truthy ? t(item.boolean.yes, lang) : item.boolean.no ?? item.fallback ?? ''
  }
  if (Array.isArray(v)) {
    if (item.join != null) return v.map((x) => str(x)).join(item.join) || item.fallback || ''
    return item.fallback ?? ''
  }
  if (v == null || v === '') return item.fallback ?? ''
  return str(v)
}

export function titleValue(tpl: PrintTemplate, data: PrintData): string {
  if (!tpl.title) return ''
  const v = readPath(data, tpl.title.field)
  if (v == null || v === '') return tpl.title.fallback ?? ''
  return str(v)
}

const TEMPLATE_FIELD_RE = /\{(\w+(?:\.\w+)*)\}/g

/**
 * 按模板字段自动生成测试数据：字段值显示为 {{字段名}} 占位，
 * 便于设计器预览时一眼看出字段与位置的对应关系（与自研预览的占位模式一致）。
 */
export function buildSampleData(tpl: PrintTemplate, rowCount = 3): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  const ph = (f: string): string => `{{${f}}}`

  if (tpl.title?.field) data[tpl.title.field] = ph(tpl.title.field)

  for (const item of [...(tpl.info?.items ?? []), ...(tpl.footer?.items ?? [])]) {
    if (item.field && item.field !== '__const__' && !(item.field in data)) {
      data[item.field] = ph(item.field)
    }
  }

  const table = tpl.table
  if (!table) return data

  const cols = pickColumns(table, {})
  const row: Row = {}
  for (const col of cols) {
    const c = col.cell
    if (c.kind === 'text' && c.field) row[c.field] = ph(c.field)
    else if (c.kind === 'image' && c.field) row[c.field] = ''
    else if (c.kind === 'stack') {
      for (const ln of c.lines) {
        if (ln.field) row[ln.field] = ph(ln.field)
        else if (ln.text) {
          for (const m of ln.text.matchAll(TEMPLATE_FIELD_RE)) {
            if (!(m[1] in row)) row[m[1]] = ph(m[1])
          }
        }
      }
    }
  }

  const rows: Row[] = Array.from({ length: rowCount }, () => ({ ...row }))
  for (const col of cols) {
    const c = col.cell
    if (c.kind !== 'list' || !c.listField) continue
    const sub: Row = {}
    for (const ln of c.lines) {
      if (ln.field) sub[ln.field] = ph(ln.field)
      else if (ln.text) {
        for (const m of ln.text.matchAll(TEMPLATE_FIELD_RE)) sub[m[1]] = ph(m[1])
      }
    }
    for (const r of rows) r[c.listField] = [{ ...sub }, { ...sub }]
  }

  data[table.srcField] = rows
  return data
}
