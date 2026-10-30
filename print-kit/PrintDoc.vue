<template>
  <div class="print-doc" :style="pagePadding">
    <div v-if="titleText" class="header">
      <h1 :style="titleStyle">{{ titleText }}</h1>
    </div>

    <div v-if="infoItems.length" class="info-grid" :style="infoGridStyle">
      <div v-for="(item, idx) in infoItems" :key="item.field + idx" class="info-item" :style="itemStyle(item)">
        <span>{{ t(item.label, lang) }}</span>
        <span>{{ infoValue(item, data, lang) }}</span>
      </div>
    </div>

    <div v-if="columns.length" class="outable-container">
      <table class="data-table">
        <thead>
          <tr>
            <th v-for="col in columns" :key="col.key" :style="headCellStyle(col)">
              {{ t(col.label, lang) }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, ri) in rows" :key="ri">
            <td v-for="col in columns" :key="col.key" :style="bodyCellStyle(col)">
              <!-- 序号 -->
              <template v-if="col.cell.kind === 'serial'">{{ ri + 1 }}</template>
              <!-- 图片 -->
              <img
                v-else-if="col.cell.kind === 'image' && imageSrc(col.cell, row)"
                :src="imageSrc(col.cell, row)"
                alt=""
                class="product-img"
              />
              <!-- 普通字段 -->
              <template v-else-if="col.cell.kind === 'text'">{{ textCell(col.cell, row) }}</template>
              <!-- 多行堆叠 -->
              <template v-else-if="col.cell.kind === 'stack'">
                <p v-for="(ln, li) in col.cell.lines" :key="li" :class="{ 'line-small': ln.small }">
                  <strong v-if="ln.label">{{ t(ln.label, lang) }}</strong>{{ lineText(ln, row) }}
                </p>
              </template>
              <!-- 子列表循环 -->
              <template v-else-if="col.cell.kind === 'list'">
                <div v-for="(it, ii) in listItems(col.cell, row)" :key="ii" class="third-party-item">
                  <p v-for="(ln, li) in col.cell.lines" :key="li">
                    <strong v-if="ln.label">{{ t(ln.label, lang) }}</strong>{{ lineText(ln, it) }}
                  </p>
                </div>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 表格下方信息区（如 制单人/审核人/打印日期） -->
    <div v-if="footerItems.length" class="info-grid" :style="footerGridStyle">
      <div v-for="(item, idx) in footerItems" :key="'f' + item.field + idx" class="info-item" :style="itemStyle(item)">
        <span>{{ t(item.label, lang) }}</span>
        <span>{{ infoValue(item, data, lang) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PropType } from 'vue'
// 屏幕预览样式（与 iframe 打印共用同一份，唯一样式源）
// 若 print.css 放在 src/assets/styles 下，请改为 '@/assets/styles/print.css'
import './print.css'
import {
  t,
  infoValue,
  textCell,
  imageSrc,
  listItems,
  lineText,
  pickColumns,
  isItemVisible,
  titleValue,
  readPath
} from './print-schema'
import type {
  PrintTemplate,
  PrintData,
  PrintFlags,
  Lang,
  InfoItem,
  TableColumnDef,
  Row,
  CSSProperties
} from './print-schema'

const props = defineProps({
  /** 模板 JSON（设计器产物 / 后端下发） */
  template: { type: Object as PropType<PrintTemplate>, required: true },
  /** 打印数据（接口返回） */
  data: { type: Object as PropType<PrintData>, required: true },
  /** 语言，标签双语文案按此取值 */
  lang: { type: String as PropType<Lang>, default: 'zh' as Lang },
  /** 条件开关：如 { isShipment: true, printMode: 'batch' } */
  flags: { type: Object as PropType<PrintFlags>, default: () => ({}) }
})

const titleText = computed(() => titleValue(props.template, props.data))

const infoItems = computed<InfoItem[]>(() => {
  const items = props.template.info?.items ?? []
  return items.filter((it) => isItemVisible(it, props.flags))
})

const infoGridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${props.template.info?.columns ?? 3}, 1fr)`
}))

const footerItems = computed<InfoItem[]>(() => {
  const items = props.template.footer?.items ?? []
  return items.filter((it) => isItemVisible(it, props.flags))
})

const footerGridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${props.template.footer?.columns ?? 3}, 1fr)`
}))

const columns = computed<TableColumnDef[]>(() => pickColumns(props.template.table, props.flags))

const rows = computed<Row[]>(() => {
  const v = readPath(props.data, props.template.table?.srcField ?? '')
  return Array.isArray(v) ? (v as Row[]) : []
})

/* ===================== 样式（与自研设计器预览一致） ===================== */

const pagePadding = computed<CSSProperties>(() => ({
  padding: props.template.page?.margin ?? '10mm'
}))

const titleStyle = computed<CSSProperties>(() => {
  const s = props.template.title
  return {
    fontSize: s?.fontSize ? `${s.fontSize}pt` : undefined,
    fontWeight: s?.bold === false ? 400 : 700
  }
})

const itemStyle = (item: InfoItem): CSSProperties => ({
  fontSize: item.fontSize ? `${item.fontSize}pt` : undefined,
  marginTop: item.marginTopMm ? `${item.marginTopMm}mm` : undefined
})

const tableStyle = computed(() => props.template.table?.style)

/** 表头单元格：居中 + 表格样式（背景/边框/内边距/字号） */
const headCellStyle = (col: TableColumnDef): CSSProperties => {
  const st = tableStyle.value
  return {
    width: col.width,
    textAlign: col.align ?? 'center',
    fontSize: st?.fontSize ? `${st.fontSize}pt` : undefined,
    background: st?.headerBg,
    borderColor: st?.borderColor,
    padding: st?.cellPadding
  }
}

/** 表体单元格：默认左对齐（可被列 align 覆盖） */
const bodyCellStyle = (col: TableColumnDef): CSSProperties => {
  const st = tableStyle.value
  return {
    textAlign: col.align ?? 'left',
    fontSize: st?.fontSize ? `${st.fontSize}pt` : undefined,
    borderColor: st?.borderColor,
    padding: st?.cellPadding
  }
}
</script>
