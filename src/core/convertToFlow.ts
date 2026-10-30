/**
 * 自研单据模板（TemplateSchema，绝对定位）→ 流式模板（PrintTemplate）转换器。
 * 映射规则：
 *   title       → 标题字段（取第一个 {{占位符}}）
 *   labelValue  → 信息项（值含占位符取字段；纯文本走兜底显示）
 *   text        → 值含占位符时转为信息项，否则跳过
 *   table       → 表格（仅取第一个；__serial 列转序号，其余转普通字段）
 *   line/image 等其余类型 → 流式暂不支持，跳过并计数
 */
import type { TemplateSchema } from '../types/template'
import type { PrintTemplate } from '../../print-kit/print-schema'

export interface ConvertResult {
  tpl: PrintTemplate
  infoCount: number
  columnCount: number
  skipped: number
}

const PLACEHOLDER_RE = /\{\{([^}]+)\}\}/

function firstField(text: unknown): string | null {
  const m = String(text ?? '').match(PLACEHOLDER_RE)
  return m ? m[1].trim() : null
}

export function convertDocumentToFlow(schema: TemplateSchema): ConvertResult {
  let infoCount = 0
  let columnCount = 0
  let skipped = 0

  const tpl: PrintTemplate = {
    name: { zh: schema.name || '转换模板' },
    // 页面边距：取自研模板的页面边距设置（属性面板「页面设置」可自定义，默认 10mm）
    page: { margin: `${schema.page.marginMm ?? 10}mm` },
    info: { columns: 3, items: [] },
    footer: { columns: 3, items: [] },
    table: { srcField: 'details', variants: [{ when: null, columns: [] }] }
  }
  const items = tpl.info!.items
  const footerItems = tpl.footer!.items
  const cols = tpl.table!.variants[0]!.columns
  let titleDone = false
  let tableSeen = false

  /* 行距还原：自研是绝对定位，行间隙由元素 y 坐标决定。
   * 流式布局按 y 排序后，把换行处的 y 差转换为行首元素的 marginTopMm，
   * 同一行（y 相差 ≤0.5mm）共享同一间距。 */
  let rowY = -1
  let rowH = 0
  let rowMargin = 0
  const itemMargin = (el: { y: number; h: number }): number => {
    if (rowY < 0) {
      rowY = el.y
      rowH = el.h
      rowMargin = 0
      return 0
    }
    if (el.y > rowY + 0.5) {
      rowMargin = Math.max(0, Math.round((el.y - rowY - rowH) * 10) / 10)
      rowY = el.y
      rowH = el.h
    } else {
      rowH = Math.max(rowH, el.h)
    }
    return rowMargin
  }

  // 流式布局只能表达纵向顺序，按视觉位置（y → x）排序
  const els = [...schema.elements].sort((a, b) => a.y - b.y || a.x - b.x)

  for (const el of els) {
    switch (el.type) {
      case 'title': {
        const f = firstField(el.text)
        if (!titleDone && f) {
          tpl.title = {
            field: f,
            fontSize: el.style.fontSize,
            bold: el.style.bold ?? true
          }
          titleDone = true
        } else {
          skipped += 1
        }
        break
      }
      case 'labelValue': {
        const f = firstField(el.value)
        // 表格之后的元素进入表格下方信息区，保持原单据的版式顺序
        const target = tableSeen ? footerItems : items
        target.push({
          label: { zh: el.label ?? '' },
          field: f ?? '__const__',
          fallback: f ? undefined : String(el.value ?? ''),
          fontSize: el.style.fontSize,
          marginTopMm: itemMargin(el)
        })
        infoCount += 1
        break
      }
      case 'text': {
        const f = firstField(el.text)
        if (f) {
          ;(tableSeen ? footerItems : items).push({
            label: { zh: '' },
            field: f,
            fontSize: el.style.fontSize,
            marginTopMm: itemMargin(el)
          })
          infoCount += 1
        } else {
          skipped += 1
        }
        break
      }
      case 'table': {
        // 仅转换第一个表格，其余跳过
        if (columnCount > 0) {
          skipped += 1
          break
        }
        tableSeen = true
        // footer 是独立信息区（中间隔着表格），行距跟踪重新起算
        rowY = -1
        rowH = 0
        rowMargin = 0
        tpl.table!.srcField = el.srcField || 'details'
        // 表格视觉样式：始终写入，未设置时用自研渲染器的默认值（表头灰底/黑框/1.2mm 1.5mm 内边距）
        const st = el.style
        tpl.table!.style = {
          fontSize: st.fontSize,
          headerBg: st.headerBg ?? '#f2f2f2',
          borderColor: st.borderColor ?? '#000',
          cellPadding: '1.2mm 1.5mm'
        }
        for (const c of el.columns) {
          const align = c.align ?? 'left'
          cols.push(
            c.field === '__serial'
              ? { key: 'serialNo', label: { zh: c.title, en: '' }, width: c.width || '8%', align, cell: { kind: 'serial' } }
              : {
                  key: c.field || `col_${cols.length + 1}`,
                  label: { zh: c.title, en: '' },
                  width: c.width || '10%',
                  align,
                  cell: { kind: 'text', field: c.field }
                }
          )
          columnCount += 1
        }
        break
      }
      default:
        skipped += 1
    }
  }

  return { tpl, infoCount, columnCount, skipped }
}
