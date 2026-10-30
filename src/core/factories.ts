import type {
  TableElement, TemplateElement, TemplateSchema, ElementType, ElStyle
} from '../types/template'

let seed = 0
export function uid(prefix = 'el'): string {
  seed += 1
  return `${prefix}_${Date.now().toString(36)}_${seed}`
}

const defaultStyle = (): ElStyle => ({ fontSize: 9, align: 'left', vAlign: 'middle' })

export function createElement(type: ElementType, x = 20, y = 20): TemplateElement {
  const base = { id: uid(type), x, y }
  switch (type) {
    case 'title':
      return { ...base, type, w: 170, h: 10, text: '单据标题', style: { fontSize: 16, bold: true, align: 'center', vAlign: 'middle' } }
    case 'text':
      return { ...base, type, w: 60, h: 6, text: '文本内容 {{field}}', style: defaultStyle() }
    case 'labelValue':
      return { ...base, type, w: 55, h: 6, label: '标签：', value: '{{field}}', style: defaultStyle() }
    case 'image':
      return { ...base, type, w: 20, h: 20, field: 'imageUrl', style: defaultStyle() }
    case 'line':
      return { ...base, type, w: 170, h: 2, style: { color: '#000' } }
    case 'table':
      return { ...base, type, w: 170, h: 40, srcField: 'details', previewRows: 3, columns: [
        { title: '序号', field: '__serial', width: '8%', align: 'center' },
        { title: '品名', field: 'productName', width: '32%', align: 'left' },
        { title: '数量', field: 'qty', width: '12%', align: 'center' }
      ], showSummary: false, summaryLabel: '合计：', summarySpan: 2, sumFields: ['qty'], style: { fontSize: 9, headerBg: '#f2f2f2', borderColor: '#000', vAlign: 'top' } } as TableElement
    case 'barcode':
      return { ...base, type, w: 60, h: 16, value: '{{barcode}}', format: 'CODE128', showText: true, style: defaultStyle() }
    case 'qrcode':
      return { ...base, type, w: 26, h: 26, value: '{{qrContent}}', ecl: 'M', style: defaultStyle() }
  }
}

/** 内置示例模板：贴近常见 WMS 出库/调拨单样式 */
export function createDefaultSchema(): TemplateSchema {
  const el = <T extends TemplateElement>(e: T): T => e
  const tableId = uid('table') // 表尾元素「锚点跟随」的源元素
  return {
    name: '调拨单模板',
    page: { widthMm: 210, heightMm: 297, marginMm: 10 },
    elements: [
      el({ id: uid('title'), type: 'title', x: 20, y: 10, w: 170, h: 12, text: '{{title}}', style: { fontSize: 18, bold: true, align: 'center', vAlign: 'middle' } }),
      el({ id: uid('lv'), type: 'labelValue', x: 10, y: 30, w: 65, h: 6, label: '库存组织：', value: '{{orgName}}', style: { fontSize: 9, align: 'left', vAlign: 'middle' } }),
      el({ id: uid('lv'), type: 'labelValue', x: 75, y: 30, w: 65, h: 6, label: '单据状态：', value: '{{orderStatus}}', style: { fontSize: 9, align: 'left', vAlign: 'middle' } }),
      el({ id: uid('lv'), type: 'labelValue', x: 140, y: 30, w: 60, h: 6, label: '单据编号：', value: '{{orderCode}}', style: { fontSize: 9, align: 'left', vAlign: 'middle' } }),
      el({ id: uid('lv'), type: 'labelValue', x: 10, y: 38, w: 65, h: 6, label: '调出仓库：', value: '{{outWarehouse}}', style: { fontSize: 9, align: 'left', vAlign: 'middle' } }),
      el({ id: uid('lv'), type: 'labelValue', x: 75, y: 38, w: 65, h: 6, label: '出库日期：', value: '{{outDate}}', style: { fontSize: 9, align: 'left', vAlign: 'middle' } }),
      el({ id: uid('lv'), type: 'labelValue', x: 140, y: 38, w: 60, h: 6, label: '出库类型：', value: '{{outType}}', style: { fontSize: 9, align: 'left', vAlign: 'middle' } }),
      el({ id: tableId, type: 'table', x: 10, y: 50, w: 190, h: 60, srcField: 'details', previewRows: 6,
        columns: [
          { title: '序号', field: '__serial', width: '6%', align: 'center' },
          { title: 'SKU', field: 'sku', width: '18%', align: 'left' },
          { title: '品名', field: 'productName', width: '28%', align: 'left' },
          { title: '规格型号', field: 'spec', width: '14%', align: 'left' },
          { title: '单位', field: 'unit', width: '6%', align: 'center' },
          { title: '数量', field: 'qty', width: '8%', align: 'center' },
          { title: '调出仓库', field: 'outWarehouse', width: '10%', align: 'center' },
          { title: '调入仓库', field: 'inWarehouse', width: '10%', align: 'center' },
          { title: '备注', field: 'remark', width: '8%', align: 'left' }
        ],
        showSummary: true, summaryLabel: '合计：', summarySpan: 5, sumFields: ['qty'],
        style: { fontSize: 9, headerBg: '#f2f2f2', borderColor: '#000', vAlign: 'middle' } }),
      el({ id: uid('lv'), type: 'labelValue', x: 15, y: 120, w: 60, h: 6, label: '制单人：', value: '{{creator}}', style: { fontSize: 9, align: 'left', vAlign: 'middle' } }),
      el({ id: uid('lv'), type: 'labelValue', x: 120, y: 120, w: 60, h: 6, label: '审核人：', value: '{{reviewer}}', style: { fontSize: 9, align: 'left', vAlign: 'middle' } }),
      el({ id: uid('lv'), type: 'labelValue', x: 15, y: 130, w: 60, h: 6, label: '验收人：', value: '{{acceptor}}', style: { fontSize: 9, align: 'left', vAlign: 'middle' } }),
      el({ id: uid('lv'), type: 'labelValue', x: 120, y: 130, w: 80, h: 6, label: '打印日期：', value: '{{printDate}}', style: { fontSize: 9, align: 'left', vAlign: 'middle' } })
    ]
  }
}

/** 当前支持的元素类型（用于旧数据净化） */
const KNOWN_TYPES: string[] = ['title', 'text', 'labelValue', 'table', 'image', 'line']

/** 载入旧模板时剔除已废弃/未知类型的元素（如页码） */
export function sanitizeSchema(schema: TemplateSchema): TemplateSchema {
  return {
    ...schema,
    elements: (schema.elements ?? []).filter((e) => e && KNOWN_TYPES.includes(e.type))
  }
}
