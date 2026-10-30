<template>
  <div class="canvas-wrap" @scroll="closeCtxMenu" @contextmenu.prevent="closeCtxMenu">
    <div class="canvas-inner">
      <div
        ref="pageRef"
        class="a4-page"
        :style="pageStyle"
        @dragover.prevent
        @drop="onDrop"
        @pointerdown.self="onPagePointerDown"
      >
        <!-- 对齐参考线（蓝色为页面中线，红色为元素对齐线，绿色为安全边距） -->
        <div v-for="(g, i) in guides.x" :key="'gx' + i" class="guide guide-v" :class="{ 'is-page': g.page, 'is-safe': g.safe }" :style="{ left: g.v + 'mm' }"></div>
        <div v-for="(g, i) in guides.y" :key="'gy' + i" class="guide guide-h" :class="{ 'is-page': g.page, 'is-safe': g.safe }" :style="{ top: g.v + 'mm' }"></div>

        <!-- 安全边距：四边等值的留白参考区，属性面板可自定义（mm）；打印不渲染 -->
        <div v-if="pageMarginMm > 0" class="safe-margin" :style="safeMarginStyle" aria-hidden="true"></div>
        <span v-if="pageMarginMm > 0" class="safe-margin-tag">安全边距 {{ pageMarginMm }}mm</span>

        <div
          v-for="el in schema.elements"
          :key="el.id"
          class="ed-el"
          :class="[
            'is-' + el.type,
            { 'is-selected': selectedIds.includes(el.id) }
          ]"
          :data-id="el.id"
          :style="elStyle(el)"
          @pointerdown.stop="onElementPointerDown($event, el)"
          @dblclick.stop="onElementDblClick(el)"
          @contextmenu.prevent.stop="onElementContextMenu($event, el)"
        >
          <template v-if="el.type === 'title'">{{ el.text }}</template>
          <template v-else-if="el.type === 'text'">{{ el.text }}</template>
          <template v-else-if="el.type === 'labelValue'">
            <span class="pv-label">{{ el.label }}</span>
            <span class="pv-value">{{ el.value }}</span>
          </template>
          <template v-else-if="el.type === 'image'">
            <div class="pv-image">图片 {{ el.field }}</div>
          </template>
          <template v-else-if="el.type === 'line'">
            <div class="pv-line" :style="{
              borderTopWidth: (el.style?.thickness || 1) + 'px',
              borderTopColor: el.style?.color || '#000',
              borderTopStyle: 'solid'
            }"></div>
            <span class="type-tag">线条</span>
          </template>
          <template v-else-if="el.type === 'barcode' || el.type === 'qrcode'">
            <!-- 含 {{字段}} 占位时画布不编码占位文本，给出占位提示；打印时按数据编码 -->
            <div v-if="el.value.includes('{{')" class="code-placeholder">
              <span>{{ el.type === 'barcode' ? '条形码' : '二维码' }}</span>
              <small>{{ el.value }}</small>
            </div>
            <div v-else class="code-svg" v-html="codeSvg(el)"></div>
          </template>
          <template v-else-if="el.type === 'table'">
            <table class="pv-table">
              <thead>
                <tr>
                  <th
                    v-for="h in visibleTableHeaders(el)"
                    :key="h.start"
                    :colspan="h.span"
                    :style="{ width: h.col.width, textAlign: h.col.align }"
                    :class="{ 'is-col-selected': isColSelected(el, h.start) }"
                    title="点击选中列 / 双击修改列名"
                    @pointerdown.stop="selectColumn(el, h.start)"
                    @dblclick.stop="startTitleEdit(el, h.start)"
                  >
                    <el-input
                      v-if="isTitleEditing(el, h.start)"
                      :model-value="h.col.title"
                      size="small"
                      class="th-editor"
                      @update:model-value="(v: string) => (h.col.title = v)"
                      @pointerdown.stop
                      @dblclick.stop
                      @keydown.enter.prevent="stopTitleEdit"
                      @keydown.esc.prevent="cancelTitleEdit"
                      @blur="stopTitleEdit"
                    />
                    <template v-else>{{ h.col.title }}</template>
                    <span
                      v-if="isTableSelected(el) && !isTitleEditing(el, h.start) && h.start + h.span < el.columns.length"
                      class="col-resize"
                      title="拖拽调整列宽（双击该手柄可让本列按内容自适应）"
                      @pointerdown.stop="startColResize($event, el, h)"
                      @dblclick.stop="autoFitColumn($event, el, h)"
                    ></span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in (el.previewRows || 1)" :key="'r' + r">
                  <td
                    v-for="(cell, ci) in visibleTableCells(el)"
                    :key="'c' + ci"
                    :colspan="cell.span"
                    :style="{ textAlign: cell.col.align }"
                  >{{ cell.col.field === '__serial' ? r : '' }}</td>
                </tr>
              </tbody>
              <!-- 合计行：与导出端 printRuntime 同构（标签跨列右对齐 + 求和列），Σ 为设计期占位 -->
              <tfoot v-if="el.showSummary && el.columns.length">
                <tr>
                  <td
                    v-if="summarySpanOf(el) > 0"
                    :colspan="summarySpanOf(el)"
                    class="pv-summary-label"
                  >{{ el.summaryLabel || '合计：' }}</td>
                  <td
                    v-for="(sc, si) in el.columns.slice(summarySpanOf(el))"
                    :key="'s' + si"
                    :style="{ textAlign: sc.align }"
                  >
                    <span
                      v-if="(el.sumFields || []).includes(sc.field)"
                      class="sum-ph"
                      title="打印时按数据自动求和"
                    >Σ</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </template>

          <div
            v-if="selectedIds.length === 1 && selectedIds[0] === el.id"
            class="resize-handle"
            @pointerdown.stop="onResizeDown($event, el)"
          ></div>
          <span v-if="el.anchor" class="anchor-badge" title="已锚定跟随，随源元素底边移动">锚</span>
        </div>

        <!-- 框选矩形 -->
        <div
          v-if="box.active"
          class="sel-box"
          :style="{
            left: Math.min(box.x1, box.x2) + 'mm',
            top: Math.min(box.y1, box.y2) + 'mm',
            width: Math.abs(box.x2 - box.x1) + 'mm',
            height: Math.abs(box.y2 - box.y1) + 'mm'
          }"
        ></div>

        <!-- 上下等距提示：选中元素与上/下相邻元素间距相等时的简易标注 -->
        <div
          v-if="gapHint"
          class="gap-equal-hint"
          :style="{ left: gapHint.cx + 'mm', top: gapHint.y + 'mm' }"
        >⇅ 上下间距相等 · {{ gapHint.gap }}mm</div>

        <!-- 选中表格时，画布内可直接增删列 / 合并拆分 -->
        <div
          v-for="el in selectedTables"
          :key="'tb-' + el.id"
          class="table-edit-bar"
          :data-id="el.id"
          :style="{ left: el.x + 'mm', top: Math.max(0, el.y - 9) + 'mm', width: el.w + 'mm' }"
          @pointerdown.stop
        >
          <button class="tb-add" @click.stop="addColumn(el)">＋ 列</button>
          <span
            v-for="(c, i) in el.columns"
            :key="c.field + c.title + i"
            class="col-chip"
            :class="{ 'is-active': isColSelected(el, i), 'is-dragging': isColDragging(el, i) }"
            :title="c.title + '（' + c.field + '）\n拖拽调整列顺序 / 点击选中列，× 删除'"
            @pointerdown="startChipDrag($event, el, i)"
            @click.stop="selectColumn(el, i)"
          >{{ c.title }}<i class="col-x" title="删除该列" @click.stop="removeColumn(el, i)">×</i></span>
          <button
            class="tb-more"
            :class="{ on: tbMenu?.tableId === el.id }"
            title="列工具：对齐 / 合并 / 拆分 / 均分 / 自适应"
            @click.stop="toggleTbMenu(el)"
          >⋯</button>
          <!-- 列工具弹出菜单：低频操作收纳，工具栏只保留高频对象（＋列 / 列 chip） -->
          <div v-if="tbMenu?.tableId === el.id" class="tb-menu" @pointerdown.stop>
            <div class="tb-menu-row">
              <span class="tb-menu-label">列对齐</span>
              <span class="tb-align">
                <button
                  class="tb-align-btn"
                  :disabled="!colOf(el)"
                  :class="{ on: colOf(el) && (colOf(el)?.align ?? 'left') === 'left' }"
                  @click.stop="setColAlign(el, 'left')"
                >左</button>
                <button
                  class="tb-align-btn"
                  :disabled="!colOf(el)"
                  :class="{ on: colOf(el)?.align === 'center' }"
                  @click.stop="setColAlign(el, 'center')"
                >中</button>
                <button
                  class="tb-align-btn"
                  :disabled="!colOf(el)"
                  :class="{ on: colOf(el)?.align === 'right' }"
                  @click.stop="setColAlign(el, 'right')"
                >右</button>
              </span>
            </div>
            <button class="tb-menu-item" @click.stop="distributeColumns(el); closeTbMenu()">≡ 所有列等宽均分</button>
            <button class="tb-menu-item" @click.stop="autoFitColumns(el); closeTbMenu()">⤡ 按内容自适应列宽</button>
            <button class="tb-menu-item" :disabled="!canMergeRight(el)" @click.stop="mergeRight(el); closeTbMenu()">⇥ 与右侧列合并</button>
            <button
              v-if="colOf(el) && (colOf(el)?.colSpan || 1) > 1"
              class="tb-menu-item"
              @click.stop="splitColumn(el); closeTbMenu()"
            >⤫ 取消合并（当前跨 {{ colOf(el)?.colSpan }} 列）</button>
            <div v-if="!colOf(el)" class="tb-menu-hint">先点击列 chip 或表头选中一列</div>
          </div>
        </div>
        <!-- 列宽拖拽时的宽度指示反馈（fixed 定位，不受画布缩放影响） -->
        <div
          v-if="colResize.active"
          class="col-width-tip"
          :class="{ 'is-limit': colResize.atLimit }"
          :style="{ left: colResize.tipX + 'px', top: colResize.tipY + 'px' }"
        >{{ colResizeTip }}</div>
        <!-- 拖拽时的竖向参考线，贯穿表格给出空间参照 -->
        <div
          v-if="colResize.active"
          class="col-resize-guide"
          :style="{ left: colResize.guideX + 'px' }"
        ></div>

        <!-- 就地编辑浮层（Element Plus；点击画布空白处自动收起） -->
        <div
          v-if="editEl"
          class="inline-editor"
          :style="{ left: editEl.x + 'mm', top: editEl.y + 'mm', width: editEl.w + 'mm', height: editEl.h + 'mm' }"
          @pointerdown.stop
        >
          <template v-if="editKind === 'label'">
            <el-input v-model="editEl.label" size="small" placeholder="标签" @keydown.enter="stopEdit" @keydown.esc="stopEdit" />
            <el-input v-model="editEl.value" size="small" placeholder="值/字段" @keydown.enter="stopEdit" @keydown.esc="stopEdit" />
          </template>
          <el-input
            v-else
            v-model="editEl.text"
            type="textarea"
            :rows="2"
            @blur="stopEdit"
            @keydown.esc="stopEdit"
          />
        </div>
      </div>
    </div>

    <!-- 右键菜单 -->
    <div
      v-if="ctx.visible"
      class="ctx-menu"
      :style="{ left: ctx.x + 'px', top: ctx.y + 'px' }"
      @click.stop
      @contextmenu.prevent.stop
    >
      <div class="ctx-item" @click="doDuplicate">复制</div>
      <div class="ctx-item" @click="doBringForward">上移一层</div>
      <div class="ctx-item" @click="doSendBackward">下移一层</div>
      <div class="ctx-item" @click="doBringFront">置于顶层</div>
      <div class="ctx-item" @click="doSendBack">置于底层</div>
      <div class="ctx-sep"></div>
      <div v-if="canGroup" class="ctx-item" @click="groupSelected">成组（整组刚体移动）</div>
      <div v-if="canUngroup" class="ctx-item" @click="ungroupSelected">解散组</div>
      <div class="ctx-item" @click="anchorToNearestTable">锚定到表格底部（内容变高自动跟随）</div>
      <div v-if="canClearAnchor" class="ctx-item" @click="clearAnchor">取消锚点跟随</div>
      <div class="ctx-sep"></div>
      <div class="ctx-item danger" @click="doDelete">删除</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, useTemplateRef, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { TemplateElement, TemplateSchema, TableElement, BarcodeElement, QrCodeElement } from '../types/template'
import { createElement, uid } from '../core/factories'
import { __peBarcodeSvg, __peQrSvg } from '../core/printRuntime.js'

const props = defineProps<{
  schema: TemplateSchema
  selectedIds: string[]
  zoom: number
}>()

const emit = defineEmits<{
  (e: 'select', ids: string[]): void
}>()

const PX_PER_MM = 3.7795
const SNAP_MM = 1
const GUIDE_THRESHOLD = 4
const BOX_THRESHOLD_MM = 2 // 拖动超过该距离视为框选

const pageRef = useTemplateRef<HTMLDivElement>('pageRef')

const pageStyle = computed(() => ({
  width: `${props.schema.page.widthMm * PX_PER_MM}px`,
  height: `${props.schema.page.heightMm * PX_PER_MM}px`,
  transform: `scale(${props.zoom})`
}))

const selectedTables = computed(() =>
  props.schema.elements.filter(
    (e) => props.selectedIds.includes(e.id) && e.type === 'table'
  ) as TableElement[]
)

const guides = reactive<{ x: { v: number; page?: boolean; safe?: boolean }[]; y: { v: number; page?: boolean; safe?: boolean }[] }>({
  x: [],
  y: []
})

/* ---- 安全边距：四边等值的统一留白（画布参考区 + 流式转换边距），属性面板可自定义 ---- */
const pageMarginMm = computed(() => {
  const m = props.schema.page.marginMm ?? 10
  return Math.max(0, Math.min(50, m))
})
const safeMarginStyle = computed(() => {
  const m = `${pageMarginMm.value}mm`
  return { left: m, top: m, right: m, bottom: m }
})

const ctx = reactive<{ visible: boolean; x: number; y: number }>({
  visible: false,
  x: 0,
  y: 0
})

/* 框选状态 */
const box = reactive<{ active: boolean; x1: number; y1: number; x2: number; y2: number; moved: boolean }>({
  active: false, x1: 0, y1: 0, x2: 0, y2: 0, moved: false
})

/* 就地编辑状态 */
const editing = ref<{ id: string; kind: 'text' | 'label' } | null>(null)
const editKind = computed(() => editing.value?.kind ?? 'text')
const editEl = computed((): Record<string, any> | null =>
  editing.value ? (props.schema.elements.find((e) => e.id === editing.value!.id) as unknown as Record<string, any>) : null
)

function stopEdit(): void {
  editing.value = null
}

/** 条形码 / 二维码 SVG（与导出端共用同一编码器，保证所见即所得） */
function codeSvg(el: BarcodeElement | QrCodeElement): string {
  const r =
    el.type === 'barcode'
      ? __peBarcodeSvg(el.value, el.format, {
          showText: el.showText !== false,
          fontSize: el.style?.fontSize || 9
        })
      : __peQrSvg(el.value, el.ecl)
  if (r.error) {
    const msg = r.error.replace(/[<>&"]/g, (ch: string) =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[ch] ?? ch
    )
    return `<div class="code-error">${msg}</div>`
  }
  return r.svg
}

/** 表格表头（按 colSpan 合并后）的可视列；start 为其在 columns 中的底层索引 */function visibleTableHeaders(el: TableElement): { col: TableElement['columns'][number]; span: number; start: number }[] {
  const out: { col: TableElement['columns'][number]; span: number; start: number }[] = []
  let i = 0
  while (i < el.columns.length) {
    const c = el.columns[i]
    const span = Math.max(1, Math.min(c.colSpan || 1, el.columns.length - i))
    out.push({ col: c, span, start: i })
    i += span
  }
  return out
}

/** 合计标签横跨的列数（钳制到列数范围内），与导出端一致 */
function summarySpanOf(el: TableElement): number {
  return Math.max(0, Math.min(el.summarySpan || 0, el.columns.length))
}

/**
 * 合并列分组：锚点列（colSpan>1）与其吸收列构成一个组。
 * 拖拽排序/删除列必须以组为原子单位，否则会把列拖进/拖出合并区间，
 * 导致锚点吞掉别的列、被吸收列弹出来（表头列数与列 chip 不一致的根因）。
 */
function tableGroups(el: TableElement): { start: number; size: number }[] {
  const groups: { start: number; size: number }[] = []
  let i = 0
  while (i < el.columns.length) {
    const size = Math.max(1, Math.min(el.columns[i].colSpan || 1, el.columns.length - i))
    groups.push({ start: i, size })
    i += size
  }
  return groups
}

/** 表格数据行单元格（按 colSpan 合并后），与导出渲染保持一致 */
function visibleTableCells(el: TableElement): { col: TableElement['columns'][number]; span: number }[] {
  const out: { col: TableElement['columns'][number]; span: number }[] = []
  let i = 0
  while (i < el.columns.length) {
    const c = el.columns[i]
    const span = Math.max(1, Math.min(c.colSpan || 1, el.columns.length - i))
    out.push({ col: c, span })
    i += span
  }
  return out
}

function elStyle(el: TemplateElement): Record<string, string> {
  const s = el.style ?? {}
  const css: Record<string, string> = {
    left: `${el.x}mm`,
    top: `${el.y}mm`,
    width: `${el.w}mm`,
    height: `${el.h}mm`,
    fontSize: `${s.fontSize ?? 9}pt`,
    textAlign: s.align ?? 'left',
    color: s.color ?? '#000'
  }
  if (s.bold) css.fontWeight = 'bold'
  if (s.vAlign === 'middle') css.alignItems = 'center'
  else if (s.vAlign === 'bottom') css.alignItems = 'flex-end'
  // 表格高度由内容（表头+行数+字号）决定：盒子自适应，避免选中框与内容间出现空白
  if (el.type === 'table') css.height = 'auto'
  return css
}

function getPageRect(): DOMRect | null {
  return pageRef.value ? pageRef.value.getBoundingClientRect() : null
}

function clampPos(el: TemplateElement, x: number, y: number): { x: number; y: number } {
  return {
    x: Math.max(0, Math.min(x, props.schema.page.widthMm - el.w)),
    y: Math.max(0, Math.min(y, props.schema.page.heightMm - el.h))
  }
}

function snapPosition(el: TemplateElement, targetX: number, targetY: number): { x: number; y: number; gx: { v: number; page?: boolean; safe?: boolean }[]; gy: { v: number; page?: boolean; safe?: boolean }[] } {
  const others = props.schema.elements.filter((e) => !props.selectedIds.includes(e.id))
  const ev = [targetX, targetX + el.w / 2, targetX + el.w]
  const eh = [targetY, targetY + el.h / 2, targetY + el.h]
  let bestX = { off: targetX, dist: Infinity, guide: null as number | null, page: false, safe: false }
  let bestY = { off: targetY, dist: Infinity, guide: null as number | null, page: false, safe: false }

  // 1) 元素对齐：边缘/中心对齐其它元素
  for (const o of others) {
    const ov = [o.x, o.x + o.w / 2, o.x + o.w]
    const oh = [o.y, o.y + o.h / 2, o.y + o.h]
    ev.forEach((v) =>
      ov.forEach((g) => {
        const d = Math.abs(v - g)
        if (d <= GUIDE_THRESHOLD && d < bestX.dist) bestX = { off: targetX + (g - v), dist: d, guide: g, page: false, safe: false }
      })
    )
    eh.forEach((v) =>
      oh.forEach((g) => {
        const d = Math.abs(v - g)
        if (d <= GUIDE_THRESHOLD && d < bestY.dist) bestY = { off: targetY + (g - v), dist: d, guide: g, page: false, safe: false }
      })
    )
  }

  // 2) 安全边距：元素边缘贴近安全区边界时吸附，保证内容与容器边缘的舒适留白
  if (pageMarginMm.value > 0) {
    const safeX = [pageMarginMm.value, props.schema.page.widthMm - pageMarginMm.value]
    const safeY = [pageMarginMm.value, props.schema.page.heightMm - pageMarginMm.value]
    ev.forEach((v) =>
      safeX.forEach((g) => {
        const d = Math.abs(v - g)
        if (d <= GUIDE_THRESHOLD && d < bestX.dist) bestX = { off: targetX + (g - v), dist: d, guide: g, page: false, safe: true }
      })
    )
    eh.forEach((v) =>
      safeY.forEach((g) => {
        const d = Math.abs(v - g)
        if (d <= GUIDE_THRESHOLD && d < bestY.dist) bestY = { off: targetY + (g - v), dist: d, guide: g, page: false, safe: true }
      })
    )
  }

  // 3) 页面中线：元素中心对页面中心；平局时优先（更全局的参照，蓝色线与元素线区分）
  const pageCx = props.schema.page.widthMm / 2
  const pageCy = props.schema.page.heightMm / 2
  {
    const v = targetX + el.w / 2
    const d = Math.abs(v - pageCx)
    if (d <= GUIDE_THRESHOLD && d <= bestX.dist) bestX = { off: targetX + (pageCx - v), dist: d, guide: pageCx, page: true, safe: false }
  }
  {
    const v = targetY + el.h / 2
    const d = Math.abs(v - pageCy)
    if (d <= GUIDE_THRESHOLD && d <= bestY.dist) bestY = { off: targetY + (pageCy - v), dist: d, guide: pageCy, page: true, safe: false }
  }

  const gx = bestX.guide !== null ? [{ v: bestX.guide, page: bestX.page, safe: bestX.safe }] : []
  const gy = bestY.guide !== null ? [{ v: bestY.guide, page: bestY.page, safe: bestY.safe }] : []
  const x = gx.length ? bestX.off : Math.round(targetX / SNAP_MM) * SNAP_MM
  const y = gy.length ? bestY.off : Math.round(targetY / SNAP_MM) * SNAP_MM
  return { x, y, gx, gy }
}

/* ---- 画布空白：点选 / 框选 ---- */
function onPagePointerDown(evt: PointerEvent): void {
  if (evt.button !== 0) return
  closeCtxMenu()
  // 点击画布空白：收起就地编辑 / 列名编辑 / 列选中
  stopEdit()
  stopTitleEdit()
  selCol.value = null
  const rect = getPageRect()
  if (!rect) return
  const mmPerPx = props.schema.page.widthMm / rect.width
  const sx = (evt.clientX - rect.left) * mmPerPx
  const sy = (evt.clientY - rect.top) * mmPerPx

  box.active = true
  box.x1 = sx
  box.y1 = sy
  box.x2 = sx
  box.y2 = sy
  box.moved = false
  const shift = evt.shiftKey

  const move = (e: PointerEvent) => {
    const cx = (e.clientX - rect.left) * mmPerPx
    const cy = (e.clientY - rect.top) * mmPerPx
    box.x2 = cx
    box.y2 = cy
    if (Math.abs(cx - sx) > BOX_THRESHOLD_MM || Math.abs(cy - sy) > BOX_THRESHOLD_MM) box.moved = true
  }
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    box.active = false
    if (!box.moved) {
      // 单击空白：取消选择（Shift 时保留）
      if (!shift) emit('select', [])
      return
    }
    // 框选：选中与矩形相交的元素
    const x1 = Math.min(box.x1, box.x2)
    const x2 = Math.max(box.x1, box.x2)
    const y1 = Math.min(box.y1, box.y2)
    const y2 = Math.max(box.y1, box.y2)
    const hit = props.schema.elements
      .filter((e) => e.x < x2 && e.x + e.w > x1 && e.y < y2 && e.y + e.h > y1)
      .map((e) => e.id)
    if (shift) {
      const set = new Set([...props.selectedIds, ...hit])
      emit('select', [...set])
    } else {
      emit('select', hit)
    }
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

/* ---- 元素拖动（移动所有选中） ---- */
function onElementPointerDown(evt: PointerEvent, el: TemplateElement): void {
  if (evt.button !== 0) return
  closeCtxMenu()
  if (titleEdit.value && titleEdit.value.tableId !== el.id) stopTitleEdit()
  selCol.value = null // 选中元素即退出列选中，方向键恢复微调元素
  const shift = evt.shiftKey

  let selection = props.selectedIds
  if (shift) {
    const set = new Set(props.selectedIds)
    if (set.has(el.id)) set.delete(el.id)
    else set.add(el.id)
    selection = [...set]
    emit('select', selection)
    if (!set.has(el.id)) return // 取消选中不再拖动
  } else if (!props.selectedIds.includes(el.id)) {
    selection = [el.id]
    emit('select', selection)
  }

  evt.preventDefault()
  const startX = evt.clientX
  const startY = evt.clientY
  // 成组刚体：被拖元素所在组的其他成员一起移动（保持相对位置）
  const dragIds = new Set(selection)
  for (const id of selection) {
    const e = props.schema.elements.find((x) => x.id === id)
    if (!e?.groupId) continue
    for (const m of props.schema.elements) {
      if (m.groupId === e.groupId) dragIds.add(m.id)
    }
  }
  const origins = new Map<string, { x: number; y: number }>()
  for (const id of dragIds) {
    const e = props.schema.elements.find((x) => x.id === id)
    if (e) origins.set(id, { x: e.x, y: e.y })
  }
  const move = (e: PointerEvent) => {
    const dx = (e.clientX - startX) / props.zoom / PX_PER_MM
    const dy = (e.clientY - startY) / props.zoom / PX_PER_MM
    let gx: { v: number; page?: boolean; safe?: boolean }[] = []
    let gy: { v: number; page?: boolean; safe?: boolean }[] = []
    origins.forEach((o, id) => {
      const e = props.schema.elements.find((x) => x.id === id)
      if (!e) return
      const snap = snapPosition(e, o.x + dx, o.y + dy)
      const c = clampPos(e, snap.x, snap.y)
      e.x = c.x
      e.y = c.y
      gx = snap.gx
      gy = snap.gy
    })
    guides.x = gx
    guides.y = gy
  }
  const up = () => {
    guides.x = []
    guides.y = []
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    // 锚点收尾：表格被拖动 → 跟随元素跟上；锚定元素被拖动 → 按新位置重算间距（再整组归位）
    for (const id of dragIds) {
      const e = props.schema.elements.find((x) => x.id === id)
      if (!e) continue
      if (e.type === 'table') resolveAnchorsFor(e)
      if (e.anchor) {
        const src = props.schema.elements.find((x) => x.id === e.anchor)
        if (src) {
          e.gapMm = Math.max(0, Math.round((e.y - (src.y + src.h)) * 10) / 10)
          resolveAnchorsFor(src)
        }
      }
    }
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

/* ---- 缩放（仅单选时） ---- */
function onResizeDown(evt: PointerEvent, el: TemplateElement): void {
  if (evt.button !== 0) return
  closeCtxMenu()
  evt.preventDefault()
  const startX = evt.clientX
  const startY = evt.clientY
  const origW = el.w
  const origH = el.h
  const move = (e: PointerEvent) => {
    const dx = (e.clientX - startX) / props.zoom / PX_PER_MM
    const dy = (e.clientY - startY) / props.zoom / PX_PER_MM
    el.w = Math.max(5, Math.min(origW + dx, props.schema.page.widthMm - el.x))
    // 表格高度由内容自适应（同步自渲染结果），缩放只调宽
    if (el.type !== 'table') el.h = Math.max(2, Math.min(origH + dy, props.schema.page.heightMm - el.y))
  }
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

/* ---- 就地编辑 ---- */
function onElementDblClick(el: TemplateElement): void {
  if (el.type === 'table' || el.type === 'image' || el.type === 'line') return
  editing.value = { id: el.id, kind: el.type === 'labelValue' ? 'label' : 'text' }
}

/* ---- 拖入新元素 ---- */
function onDrop(evt: DragEvent): void {
  const type = evt.dataTransfer?.getData('application/x-pe-type')
  if (!type) return
  const rect = getPageRect()
  if (!rect) return
  const mmPerPx = props.schema.page.widthMm / rect.width
  const x = Math.max(0, (evt.clientX - rect.left) * mmPerPx - 10)
  const y = Math.max(0, (evt.clientY - rect.top) * mmPerPx - 5)
  const el = createElement(type as never, Math.round(x), Math.round(y))
  props.schema.elements.push(el)
  emit('select', [el.id])
  closeCtxMenu()
}

/* ---- 表格列增删 ---- */
function addColumn(el: TableElement): void {
  el.columns.push({ title: '新列', field: 'field', width: '10%', align: 'left' })
  selectColumn(el, el.columns.length - 1)
  ElMessage.success('已添加列，可在右侧属性面板设置字段')
}
function removeColumn(el: TableElement, index: number): void {
  const col = el.columns[index]
  if (!col) return
  const field = col.field
  // 合并组感知：删被吸收列→锚点 colSpan 收缩；删锚点→下一列接任，保持表头列数与数据一致
  const g = tableGroups(el).find((gr) => index >= gr.start && index < gr.start + gr.size)
  if (g && g.size > 1) {
    if (index === g.start) {
      const next = el.columns[index + 1]
      if (next) {
        next.colSpan = g.size - 1
        if ((next.colSpan || 1) <= 1) delete next.colSpan
      }
    } else {
      const anchor = el.columns[g.start]
      anchor.colSpan = g.size - 1
      if ((anchor.colSpan || 1) <= 1) delete anchor.colSpan
    }
  }
  el.columns.splice(index, 1)
  if (field) {
    const i = el.sumFields.indexOf(field)
    if (i >= 0) el.sumFields.splice(i, 1)
  }
  if (selCol.value?.tableId === el.id && selCol.value.index === index) selCol.value = null
  ElMessage.success('已删除列')
}

/* ---- 表格列选中 / 表头合并拆分 / 列名就地编辑（画布直接操作，导出渲染一致） ---- */
const selCol = ref<{ tableId: string; index: number } | null>(null)
const titleEdit = ref<{ tableId: string; index: number; orig: string } | null>(null)

/* ---- 列工具弹出菜单（工具栏 ⋯ 收纳） ---- */
const tbMenu = ref<{ tableId: string } | null>(null)
function toggleTbMenu(el: TableElement): void {
  tbMenu.value = tbMenu.value?.tableId === el.id ? null : { tableId: el.id }
}
function closeTbMenu(): void {
  tbMenu.value = null
}
/** 当前表格被选中的列（无则 null），供菜单项启用/取值 */
function colOf(el: TableElement): TableElement['columns'][number] | null {
  if (!selCol.value || selCol.value.tableId !== el.id) return null
  return el.columns[selCol.value.index] ?? null
}

function isColSelected(el: TableElement, index: number): boolean {
  return selCol.value?.tableId === el.id && selCol.value.index === index
}
function isTitleEditing(el: TableElement, index: number): boolean {
  return titleEdit.value?.tableId === el.id && titleEdit.value.index === index
}
function selectColumn(el: TableElement, index: number): void {
  if (titleEdit.value && !(titleEdit.value.tableId === el.id && titleEdit.value.index === index)) stopTitleEdit()
  selCol.value = { tableId: el.id, index }
}
function startTitleEdit(el: TableElement, index: number): void {
  const col = el.columns[index]
  if (!col) return
  selCol.value = { tableId: el.id, index }
  titleEdit.value = { tableId: el.id, index, orig: col.title }
}
function stopTitleEdit(): void {
  titleEdit.value = null
}
function cancelTitleEdit(): void {
  const t = titleEdit.value
  if (!t) return
  const el = props.schema.elements.find((e) => e.id === t.tableId) as TableElement | undefined
  const col = el?.columns[t.index]
  if (col) col.title = t.orig
  titleEdit.value = null
}
/** 是否还能向右合并（右侧尚有未被吸收的列） */
function canMergeRight(el: TableElement): boolean {
  if (!selCol.value || selCol.value.tableId !== el.id) return false
  const c = el.columns[selCol.value.index]
  if (!c) return false
  return selCol.value.index + (c.colSpan || 1) < el.columns.length
}
function mergeRight(el: TableElement): void {
  if (!selCol.value || selCol.value.tableId !== el.id) return
  const c = el.columns[selCol.value.index]
  if (!c || !canMergeRight(el)) return
  c.colSpan = (c.colSpan || 1) + 1
  ElMessage.success(`已向右合并 1 列（当前跨 ${c.colSpan} 列），表头与数据列同步生效`)
}
function splitColumn(el: TableElement): void {
  if (!selCol.value || selCol.value.tableId !== el.id) return
  const c = el.columns[selCol.value.index]
  if (!c || (c.colSpan || 1) <= 1) return
  delete c.colSpan
  ElMessage.success('已取消合并，恢复被吸收的列')
}

/* ---- 列顺序拖拽：编辑条内拖动列 chip 排序，表头/数据/列宽随列整体移动 ---- */
const colDrag = reactive<{ tableId: string; from: number; cur: number; moved: boolean }>({
  tableId: '',
  from: -1,
  cur: -1,
  moved: false
})
function isColDragging(el: TableElement, index: number): boolean {
  return colDrag.moved && colDrag.tableId === el.id && colDrag.cur === index
}
function startChipDrag(evt: PointerEvent, el: TableElement, index: number): void {
  if (evt.button !== 0) return
  if (el.columns.length < 2) return
  if ((evt.target as HTMLElement).closest('.col-x')) return // 命中删除按钮：不进入拖拽
  selectColumn(el, index)
  closeCtxMenu()
  if (titleEdit.value) stopTitleEdit()
  colDrag.tableId = el.id
  colDrag.from = index
  colDrag.cur = index
  colDrag.moved = false
  const startX = evt.clientX
  const startY = evt.clientY
  const move = (e: PointerEvent) => {
    // 超过阈值才视为拖拽，避免误伤单击选中
    if (!colDrag.moved && Math.hypot(e.clientX - startX, e.clientY - startY) < 4) return
    colDrag.moved = true
    const bar = document.querySelector(`.table-edit-bar[data-id="${el.id}"]`)
    if (!bar) return
    const chips = Array.from(bar.querySelectorAll<HTMLElement>('.col-chip'))
    // 合并组原子移动：按组（而非单列）计算目标位置，防止拖拽拆散/错位合并关系
    const groups = tableGroups(el)
    const gi = groups.findIndex((gr) => gr.start <= colDrag.cur && colDrag.cur < gr.start + gr.size)
    if (gi < 0) return
    // 目标组序：指针越过该组末 chip 与下一组首 chip 的中线即归入下一组
    let t = groups.length - 1
    for (let k = 0; k < groups.length - 1; k++) {
      const gr = groups[k]
      const lastR = chips[gr.start + gr.size - 1].getBoundingClientRect()
      const nextFirst = chips[groups[k + 1].start].getBoundingClientRect()
      if (e.clientX < (lastR.right + nextFirst.left) / 2) {
        t = k
        break
      }
    }
    if (t === gi) return
    const cols = el.columns
    const gStart = groups[gi].start
    const gSize = groups[gi].size
    // 记录选中列对象，重排后按对象回查新索引（选中态不丢不错位）
    const selObj =
      selCol.value?.tableId === el.id ? el.columns[selCol.value.index] : undefined
    const dragged = cols.splice(gStart, gSize)
    const dest = t < gi ? groups[t].start : groups[t].start + groups[t].size - gSize
    cols.splice(dest, 0, ...dragged)
    colDrag.cur = dest + (colDrag.cur - gStart)
    if (selObj) {
      const ni = el.columns.indexOf(selObj)
      if (ni >= 0) selCol.value = { tableId: el.id, index: ni }
    }
  }
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    if (colDrag.moved) ElMessage.success('已调整列顺序')
    colDrag.tableId = ''
    colDrag.from = -1
    colDrag.cur = -1
    colDrag.moved = false
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

/* ---- 列宽调整：拖拽列边框实时改宽 / 均分 / 自适应 ---- */
const COL_MIN_PCT = 3
const COL_MAX_PCT = 70
/** 将 width 字符串统一解析为百分比（相对表格宽度），支持 '8%' / '20mm' / 裸数字 */
function parseWidthPct(w: string, tableWmm: number): number {
  const s = (w || '').trim()
  if (s.endsWith('%')) return parseFloat(s) || 0
  if (s.endsWith('mm')) return tableWmm > 0 ? (parseFloat(s) / tableWmm) * 100 : 0
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}
function fmtPct(p: number): string {
  return `${Math.round(p * 10) / 10}%`
}
function isTableSelected(el: TableElement): boolean {
  return props.selectedIds.includes(el.id)
}

const colResize = reactive<{
  active: boolean
  tableId: string
  leftIdx: number
  rightIdx: number
  startLeftPct: number
  startRightPct: number
  minLeft: number
  maxLeft: number
  elW: number
  clientX0: number
  curPct: number
  tipX: number
  tipY: number
  guideX: number
  atLimit: boolean
}>({
  active: false,
  tableId: '',
  leftIdx: -1,
  rightIdx: -1,
  startLeftPct: 0,
  startRightPct: 0,
  minLeft: COL_MIN_PCT,
  maxLeft: COL_MAX_PCT,
  elW: 0,
  clientX0: 0,
  curPct: 0,
  tipX: 0,
  tipY: 0,
  guideX: 0,
  atLimit: false
})
const colResizeTip = computed(() => {
  if (!colResize.active) return ''
  const mm = (colResize.curPct / 100) * colResize.elW
  return `${Math.round(mm * 10) / 10} mm`
})

/** 拖拽列边框：调整相邻两列宽度，保持表格总宽不变（避免整表错位） */
function startColResize(
  evt: PointerEvent,
  el: TableElement,
  h: { col: TableElement['columns'][number]; span: number; start: number }
): void {
  if (evt.button !== 0) return
  evt.preventDefault()
  closeCtxMenu()
  if (titleEdit.value) stopTitleEdit()
  const leftIdx = h.start + h.span - 1
  const rightIdx = h.start + h.span
  if (rightIdx >= el.columns.length) return
  const leftCol = el.columns[leftIdx]
  const rightCol = el.columns[rightIdx]
  if (!leftCol || !rightCol) return
  const tableW = el.w
  const minLeft = leftCol.minWidth ?? COL_MIN_PCT
  const maxLeft = Math.min(leftCol.maxWidth ?? COL_MAX_PCT, 100 - COL_MIN_PCT)
  colResize.active = true
  colResize.tableId = el.id
  colResize.leftIdx = leftIdx
  colResize.rightIdx = rightIdx
  colResize.startLeftPct = parseWidthPct(leftCol.width, tableW)
  colResize.startRightPct = parseWidthPct(rightCol.width, tableW)
  colResize.minLeft = minLeft
  colResize.maxLeft = maxLeft
  colResize.elW = tableW
  colResize.clientX0 = evt.clientX
  colResize.curPct = colResize.startLeftPct
  colResize.tipX = evt.clientX + 12
  colResize.tipY = evt.clientY - 10
  colResize.guideX = evt.clientX
  colResize.atLimit = false

  const move = (e: PointerEvent) => {
    const dxMm = (e.clientX - colResize.clientX0) / props.zoom / PX_PER_MM
    const dPct = (dxMm / colResize.elW) * 100
    const sum = colResize.startLeftPct + colResize.startRightPct
    let newLeft = colResize.startLeftPct + dPct
    newLeft = Math.max(colResize.minLeft, Math.min(colResize.maxLeft, newLeft))
    let newRight = sum - newLeft
    // 右列也不得低于最小宽度，超出则回压左列
    if (newRight < COL_MIN_PCT) {
      newRight = COL_MIN_PCT
      newLeft = sum - newRight
    }
    const cur = props.schema.elements.find((x) => x.id === colResize.tableId) as TableElement | undefined
    if (!cur) return
    cur.columns[colResize.leftIdx].width = fmtPct(newLeft)
    cur.columns[colResize.rightIdx].width = fmtPct(newRight)
    colResize.curPct = newLeft
    colResize.tipX = e.clientX + 12
    colResize.tipY = e.clientY - 10
    colResize.guideX = e.clientX
    // 触达最小/最大限制时给出警示反馈
    colResize.atLimit = newLeft <= colResize.minLeft + 0.05 || newRight <= COL_MIN_PCT + 0.05
  }
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    colResize.active = false
    ElMessage.success('已调整列宽')
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

/** 所有列等宽均分剩余空间 */
function distributeColumns(el: TableElement): void {
  const n = el.columns.length
  if (!n) return
  const each = Math.round((100 / n) * 10) / 10
  el.columns.forEach((c) => {
    c.width = fmtPct(each)
  })
  ElMessage.success(`已均分 ${n} 列为等宽`)
}

/** 按列名内容长度自适应宽度（受每列 min/max 约束，并归一到 100%） */
function autoFitColumns(el: TableElement): void {
  const cols = el.columns
  if (!cols.length) return
  const raw = cols.map((c) => Math.max(2, (c.title || '列').length))
  const total = raw.reduce((a, b) => a + b, 0) || 1
  let pcts = raw.map((r, i) => {
    const p = (r / total) * 100
    return Math.max(cols[i].minWidth ?? COL_MIN_PCT, Math.min(cols[i].maxWidth ?? COL_MAX_PCT, p))
  })
  const sum = pcts.reduce((a, b) => a + b, 0) || 1
  pcts = pcts.map((p) => (p / sum) * 100)
  cols.forEach((c, i) => {
    c.width = fmtPct(pcts[i])
  })
  ElMessage.success('已按列名内容自适应列宽')
}

/** 双击列边框：仅让该列按自身内容自适应，其余列按比例压缩以保表格总宽不变 */
function autoFitColumn(
  _evt: MouseEvent,
  el: TableElement,
  h: { col: TableElement['columns'][number]; span: number; start: number }
): void {
  const leftIdx = h.start + h.span - 1
  const leftCol = el.columns[leftIdx]
  if (!leftCol) return
  const desired = Math.max(2, (leftCol.title || '列').length) * 4
  const target = Math.max(leftCol.minWidth ?? COL_MIN_PCT, Math.min(leftCol.maxWidth ?? COL_MAX_PCT, desired))
  const others = el.columns.filter((_, i) => i !== leftIdx)
  const othersSum = others.reduce((s, c) => s + parseWidthPct(c.width, el.w), 0)
  const remaining = 100 - target
  if (othersSum > 0) {
    others.forEach((c) => {
      c.width = fmtPct((parseWidthPct(c.width, el.w) / othersSum) * remaining)
    })
  }
  leftCol.width = fmtPct(target)
  ElMessage.success(`已按内容自适应「${leftCol.title}」列`)
}

/** 选中列后的对齐快捷设置（左/中/右） */
function setColAlign(el: TableElement, align: 'left' | 'center' | 'right'): void {
  if (!selCol.value || selCol.value.tableId !== el.id) return
  const c = el.columns[selCol.value.index]
  if (c) {
    c.align = align
    ElMessage.success(`已设置列对齐：${align === 'left' ? '左' : align === 'center' ? '中' : '右'}`)
  }
}

/* ---- 键盘微调选中列宽：←/→ 微调 1%，Shift+←/→ 微调 5%（min/max 约束内） ---- */
function onColKey(e: KeyboardEvent): void {
  if (!selCol.value) return
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
  const el = props.schema.elements.find((x) => x.id === selCol.value!.tableId) as TableElement | undefined
  const c = el?.columns[selCol.value!.index]
  if (!el || !c) return
  e.preventDefault()
  const step = e.shiftKey ? 5 : 1
  const cur = parseWidthPct(c.width, el.w)
  const min = c.minWidth ?? COL_MIN_PCT
  const max = c.maxWidth ?? COL_MAX_PCT
  const next = Math.max(min, Math.min(max, cur + (e.key === 'ArrowRight' ? step : -step)))
  c.width = fmtPct(next)
}

/* ---- 方向键微调选中元素：←/→/↑/↓ 移动 1mm，Shift 加持移动 5mm ----
 * 仅在无就地编辑 / 无列选中 / 焦点不在输入框时生效，不干扰其它键盘逻辑。
 * 依赖系统按键自动重复实现连续按住的流畅移动。 */
function onNudgeKey(e: KeyboardEvent): void {
  if (selCol.value || editing.value || titleEdit.value || ctx.visible) return
  if (e.ctrlKey || e.altKey || e.metaKey) return
  const t = e.target as HTMLElement | undefined
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
  const dx = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
  const dy = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0
  if (!dx && !dy) return
  if (!props.selectedIds.length) return
  e.preventDefault()
  const step = e.shiftKey ? 5 : 1
  const pw = props.schema.page.widthMm
  const ph = props.schema.page.heightMm
  for (const el of props.schema.elements) {
    if (!props.selectedIds.includes(el.id)) continue
    el.x = Math.max(0, Math.min(pw - el.w, el.x + dx * step))
    el.y = Math.max(0, Math.min(ph - el.h, el.y + dy * step))
  }
}

/* ---- 上下等距提示：单选元素与上/下相邻元素（水平方向有交叠）间距相等时展示 ---- */
/* 容差取一个微调步长 1mm：元素边缘常带小数（如 y=119.98），1mm 整数步长往往无法命中严格相等；
 * 差距小于 1mm 在打印预览约 4px，视觉不可分辨，视为等距 */
const GAP_EQ_TOL = 1
const gapHint = computed<{ cx: number; y: number; gap: number } | null>(() => {
  if (props.selectedIds.length !== 1) return null
  const el = props.schema.elements.find((e) => e.id === props.selectedIds[0])
  if (!el) return null
  let above: number | null = null // 上方元素最大底边
  let below: number | null = null // 下方元素最小顶边
  for (const o of props.schema.elements) {
    if (o.id === el.id) continue
    if (Math.min(el.x + el.w, o.x + o.w) - Math.max(el.x, o.x) <= 0.01) continue // 水平无交叠
    if (o.y + o.h <= el.y + 0.01) above = above === null ? o.y + o.h : Math.max(above, o.y + o.h)
    else if (o.y >= el.y + el.h - 0.01) below = below === null ? o.y : Math.min(below, o.y)
  }
  if (above === null || below === null) return null
  const gapUp = el.y - above
  const gapDown = below - (el.y + el.h)
  if (gapUp < 0 || gapDown < 0 || Math.abs(gapUp - gapDown) > GAP_EQ_TOL) return null
  return { cx: el.x + el.w / 2, y: el.y, gap: Math.round(gapUp * 100) / 100 }
})

/* ---- 成组 / 锚点跟随 ----
 * 成组：同 groupId 的元素拖拽时刚体移动，保持相对位置（表格尾部签名区等场景）。
 * 锚点：anchor 指向源元素（通常为表格）。表格行数/字号变化导致高度变化后，
 * 锚定元素连同所在组贴到源底边 + gapMm，表尾元素不再与表格脱节。 */
const canGroup = computed(() => props.selectedIds.length >= 2)
const canUngroup = computed(() =>
  props.schema.elements.some((e) => props.selectedIds.includes(e.id) && e.groupId)
)
const canClearAnchor = computed(() =>
  props.schema.elements.some((e) => props.selectedIds.includes(e.id) && e.anchor)
)

function groupSelected(): void {
  const sel = props.schema.elements.filter((e) => props.selectedIds.includes(e.id))
  if (sel.length < 2) return
  const gid = uid('grp')
  sel.forEach((e) => {
    e.groupId = gid
  })
  ElMessage.success(`已把 ${sel.length} 个元素成组，拖动任一组员整组一起移动`)
  closeCtxMenu()
}
function ungroupSelected(): void {
  const ids = new Set(props.selectedIds)
  props.schema.elements.forEach((e) => {
    if (ids.has(e.id)) delete e.groupId
  })
  closeCtxMenu()
}

/** 锚定到最近的表格：组内以最顶部成员为基准，gap 取当前与表格底边的距离 */
function anchorToNearestTable(): void {
  const sel = props.schema.elements.filter((e) => props.selectedIds.includes(e.id))
  if (!sel.length) return closeCtxMenu()
  // 排除当前选中的元素：不能把元素锚定到它自己（否则高度同步时会自我叠加下坠）
  const tables = props.schema.elements.filter(
    (e): e is TableElement => e.type === 'table' && !props.selectedIds.includes(e.id)
  )
  if (!tables.length) {
    ElMessage.warning('没有可锚定的表格（表格自身不能锚定自己，请取消选中表格再试）')
    return closeCtxMenu()
  }
  const selTop = Math.min(...sel.map((e) => e.y))
  let best = tables[0]
  let bestDist = Infinity
  for (const t of tables) {
    const bottom = t.y + t.h
    const d = selTop >= bottom ? selTop - bottom : bottom - selTop + 0.01
    if (d < bestDist) {
      bestDist = d
      best = t
    }
  }
  const leader = sel.reduce((a, b) => (b.y < a.y ? b : a))
  leader.anchor = best.id
  leader.gapMm = Math.max(0, Math.round((leader.y - (best.y + best.h)) * 10) / 10)
  resolveAnchorsFor(best)
  ElMessage.success(leader.groupId ? '已锚定：整组跟随表格底边' : '已锚定：跟随表格底边')
  closeCtxMenu()
}
function clearAnchor(): void {
  const ids = new Set(props.selectedIds)
  props.schema.elements.forEach((e) => {
    if (ids.has(e.id)) {
      delete e.anchor
      delete e.gapMm
    }
  })
  closeCtxMenu()
}

/** 把锚定到 src 的元素（连同所在组）移到 源底边 + gap；组去重避免整组被推移多次 */
let resolvingAnchors = false // 防重入：避免锚定链/循环在一次同步内反复叠加
function resolveAnchorsFor(src: TemplateElement): void {
  if (resolvingAnchors) return
  const followers = props.schema.elements.filter((e) => e.anchor === src.id && e.id !== src.id)
  if (!followers.length) return
  resolvingAnchors = true
  try {
    const srcBottom = src.y + src.h
    const handled = new Set<string>()
    for (const f of followers) {
      if (f.groupId) {
        if (handled.has(f.groupId)) continue
        handled.add(f.groupId)
      }
      const dy = srcBottom + (f.gapMm ?? 4) - f.y
      if (Math.abs(dy) < 0.01) continue
      const members = f.groupId
        ? props.schema.elements.filter((e) => e.groupId === f.groupId)
        : [f]
      members.forEach((m) => {
        m.y += dy
      })
    }
  } finally {
    resolvingAnchors = false
  }
}

/* ---- 右键菜单 ---- */
function onElementContextMenu(evt: MouseEvent, el: TemplateElement): void {
  if (!props.selectedIds.includes(el.id)) emit('select', [el.id])
  ctx.visible = true
  ctx.x = evt.clientX
  ctx.y = evt.clientY
}
function closeCtxMenu(): void {
  ctx.visible = false
}

function onDocPointerDown(e: PointerEvent): void {
  const target = e.target as HTMLElement
  // 工具栏内点选列 chip / 点表头选中列时保持菜单打开（选列 → 对齐是连续动作）
  if (
    tbMenu.value &&
    !target.closest('.tb-menu') &&
    !target.closest('.tb-more') &&
    !target.closest('.table-edit-bar') &&
    !target.closest('.pv-table th')
  ) {
    closeTbMenu()
  }
  if (!ctx.visible) return
  if (!target.closest('.ctx-menu')) closeCtxMenu()
}

onMounted(() => {
  window.addEventListener('pointerdown', onDocPointerDown, true)
  window.addEventListener('keydown', onColKey)
  window.addEventListener('keydown', onNudgeKey)
})
onUnmounted(() => {
  window.removeEventListener('pointerdown', onDocPointerDown, true)
  window.removeEventListener('keydown', onColKey)
  window.removeEventListener('keydown', onNudgeKey)
})

/* ---- 表格高度自适应内容：渲染后把真实高度同步回 el.h ----
 * 表格实际高度由表头 + 行数 + 字号决定，el.h 原本只是个无用的盒子值，
 * 会导致选中框留白、吸附参考线与边界限制（page.heightMm - el.h）不准。
 * 浏览器 1mm = 96/25.4 CSS px，offsetHeight 不受 zoom 缩放影响。 */
const MM_IN_PX = 96 / 25.4
function syncTableHeights(): void {
  nextTick(() => {
    const nodes = pageRef.value?.querySelectorAll<HTMLElement>('.ed-el.is-table')
    if (!nodes) return
    nodes.forEach((node) => {
      const id = node.dataset.id
      const el = props.schema.elements.find((e) => e.id === id)
      if (!el || el.type !== 'table') return
      const mm = Math.round((node.offsetHeight / MM_IN_PX) * 100) / 100
      if (mm > 0 && Math.abs(mm - el.h) > 0.05) {
        el.h = mm
        // 表格高度变化（数据行数/字号/合计行）→ 锚定表尾元素连同所在组自动跟随
        resolveAnchorsFor(el)
      }
    })
  })
}
watch(() => props.schema, syncTableHeights, { deep: true, immediate: true })

function cloneElement(el: TemplateElement): TemplateElement {
  const copy = JSON.parse(JSON.stringify(el)) as TemplateElement
  copy.id = uid(el.type)
  return copy
}

function doDuplicate(): void {
  const ids = [...props.selectedIds]
  if (!ids.length) return closeCtxMenu()
  const clones: TemplateElement[] = []
  for (const id of ids) {
    const idx = props.schema.elements.findIndex((e) => e.id === id)
    if (idx < 0) continue
    const copy = cloneElement(props.schema.elements[idx])
    copy.x = Math.min(copy.x + 4, props.schema.page.widthMm - copy.w)
    copy.y = Math.min(copy.y + 4, props.schema.page.heightMm - copy.h)
    props.schema.elements.splice(idx + 1, 0, copy)
    clones.push(copy)
  }
  emit('select', clones.map((c) => c.id))
  closeCtxMenu()
}

function reorder(toFront: boolean): void {
  const ids = new Set(props.selectedIds)
  if (!ids.size) return closeCtxMenu()
  const moving = props.schema.elements.filter((e) => ids.has(e.id))
  props.schema.elements = props.schema.elements.filter((e) => !ids.has(e.id))
  props.schema.elements = toFront ? [...props.schema.elements, ...moving] : [...moving, ...props.schema.elements]
  closeCtxMenu()
}
function doBringFront(): void {
  reorder(true)
}
function doSendBack(): void {
  reorder(false)
}
function doBringForward(): void {
  const ids = new Set(props.selectedIds)
  if (!ids.size) return closeCtxMenu()
  const els = [...props.schema.elements]
  for (let i = els.length - 2; i >= 0; i--) {
    if (ids.has(els[i].id) && !ids.has(els[i + 1].id)) {
      ;[els[i], els[i + 1]] = [els[i + 1], els[i]]
    }
  }
  props.schema.elements = els
  closeCtxMenu()
}
function doSendBackward(): void {
  const ids = new Set(props.selectedIds)
  if (!ids.size) return closeCtxMenu()
  const els = [...props.schema.elements]
  for (let i = 1; i < els.length; i++) {
    if (ids.has(els[i].id) && !ids.has(els[i - 1].id)) {
      ;[els[i], els[i - 1]] = [els[i - 1], els[i]]
    }
  }
  props.schema.elements = els
  closeCtxMenu()
}
function doDelete(): void {
  props.schema.elements = props.schema.elements.filter((e) => !props.selectedIds.includes(e.id))
  emit('select', [])
  closeCtxMenu()
}
</script>

<style scoped>
.canvas-wrap {
  flex: 1;
  overflow: auto;
  /* 响应式留白：随视口宽度伸缩，宽屏不贴边、窄屏不浪费 */
  padding: clamp(16px, 3vw, 36px) clamp(12px, 2.5vw, 32px);
  display: flex;
  justify-content: center;
  position: relative;
}
.canvas-inner {
  width: max-content;
}
.a4-page {
  position: relative;
  background: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  transform-origin: top center;
  background-image:
    linear-gradient(rgba(0, 0, 0, 0.04) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 0, 0, 0.04) 1px, transparent 1px);
  background-size: 3.7795mm 3.7795mm;
}
.ed-el {
  position: absolute;
  cursor: move;
  border: 1px dashed transparent;
  display: flex;
  overflow: hidden;
  white-space: nowrap;
  user-select: none;
  border-radius: 1px;
}
.ed-el:hover { border-color: #a0cfff; }
.ed-el.is-selected { border: 1px solid #409eff; box-shadow: 0 0 0 1px #409eff; }
.ed-el.is-line { cursor: row-resize; }
.ed-el.is-line:hover { border-color: #79bbff; }
.ed-el.is-table { cursor: move; }
.pv-label { font-weight: bold; color: #333; margin-right: 4px; }
.pv-value { color: #888; }
.pv-image {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  color: #909399;
  font-size: 11px;
}
.pv-line {
  width: 100%;
  align-self: center;
}
.type-tag {
  position: absolute;
  left: 2px;
  top: -2px;
  font-size: 9px;
  line-height: 1;
  padding: 1px 3px;
  background: #409eff;
  color: #fff;
  border-radius: 2px;
  opacity: 0;
  transform: translateY(-100%);
  pointer-events: none;
}
.ed-el.is-line.is-selected .type-tag { opacity: 1; }
.pv-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 9pt;
}
.pv-table th,
.pv-table td {
  border: 1px solid #000;
  padding: 2px 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: normal;
}
.pv-table th { background: #f2f2f2; font-weight: bold; text-align: center; position: relative; }
.pv-table th.is-col-selected {
  background: #ecf5ff;
  box-shadow: inset 0 0 0 2px #409eff;
}
.th-editor { width: 100%; }
.th-editor :deep(.el-input__wrapper) { padding: 0 4px; }
.th-editor :deep(.el-input__inner) {
  height: 20px;
  line-height: 20px;
  font-size: 9pt;
  text-align: center;
  font-weight: bold;
}
/* 列宽拖拽手柄（覆盖在表头右边缘，触控可用） */
.col-resize {
  position: absolute;
  right: -3px;
  top: 0;
  width: 8px;
  height: 100%;
  cursor: col-resize;
  touch-action: none;
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: center;
}
.col-resize::after {
  content: '';
  width: 2px;
  height: 64%;
  background: transparent;
  transition: background 0.1s;
}
.col-resize:hover::after,
.col-resize:active::after {
  background: #409eff;
}
/* 拖拽时的宽度指示反馈 */
.col-width-tip {
  position: fixed;
  z-index: 9999;
  background: #303133;
  color: #fff;
  font-size: 11px;
  line-height: 1.4;
  padding: 2px 6px;
  border-radius: 3px;
  pointer-events: none;
  white-space: nowrap;
  transform: translateY(-50%);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
}
.col-width-tip.is-limit { background: #e6a23c; }
/* 拖拽时的竖向参考线，贯穿视口给出空间参照 */
.col-resize-guide {
  position: fixed;
  top: 0;
  width: 0;
  height: 100vh;
  border-left: 2px dashed #409eff;
  opacity: 0.7;
  pointer-events: none;
  z-index: 9998;
}
/* 合计行（与导出端一致：加粗、标签右对齐） */
.pv-table tfoot td { font-weight: bold; }
.pv-summary-label { text-align: right; }
.sum-ph {
  color: #b0b3b8;
  font-weight: normal;
  font-size: 0.9em;
}

/* 框选矩形 */
.sel-box {
  position: absolute;
  background: rgba(64, 158, 255, 0.12);
  border: 1px dashed #409eff;
  pointer-events: none;
  z-index: 60;
}

/* 上下等距简易标注 */
.gap-equal-hint {
  position: absolute;
  transform: translate(-50%, calc(-100% - 2px));
  background: #409eff;
  color: #fff;
  font-size: 10px;
  line-height: 1;
  padding: 3px 6px;
  border-radius: 3px;
  white-space: nowrap;
  pointer-events: none;
  z-index: 6;
}

/* 就地编辑浮层 */
.inline-editor {
  position: absolute;
  z-index: 70;
  display: flex;
  flex-direction: column;
  gap: 2px;
  background: #fff;
  border: 1px solid #409eff;
  border-radius: 2px;
  padding: 2px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  user-select: text;
  cursor: default;
  overflow: visible;
}
.inline-editor :deep(.el-textarea__inner) { font-size: 9pt; min-height: 100%; }

/* 对齐参考线 */
.guide {
  position: absolute;
  background: #f56c6c;
  z-index: 50;
  pointer-events: none;
}
.guide-v { top: 0; width: 1px; height: 100%; }
.guide-h { left: 0; height: 1px; width: 100%; }
.guide.is-page { background: #409eff; }
.guide.is-safe { background: #67c23a; }

/* 安全边距参考区：四边等值留白，打印不渲染；z-index 低于元素，不遮挡内容 */
.safe-margin {
  position: absolute;
  border: 1px dashed #67c23a;
  border-radius: 1mm;
  pointer-events: none;
}
.safe-margin-tag {
  position: absolute;
  left: 2mm;
  top: 2mm;
  z-index: 2;
  font-size: 8px;
  line-height: 1.4;
  color: #67c23a;
  background: rgba(255, 255, 255, 0.9);
  padding: 0 1mm;
  border-radius: 1mm;
  white-space: nowrap;
  pointer-events: none;
}

/* 条形码 / 二维码画布渲染 */
.code-svg { width: 100%; height: 100%; display: flex; }
.code-svg svg { width: 100%; height: 100%; display: block; }
.code-placeholder {
  width: 100%;
  height: 100%;
  border: 1px dashed #c0c4cc;
  border-radius: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  color: #909399;
  font-size: 11px;
}
.code-placeholder small {
  font-size: 10px;
  max-width: 92%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.code-error { color: #f56c6c; font-size: 10px; padding: 4px; text-align: center; line-height: 1.3; }

/* 锚定跟随角标（画布内标识，打印不渲染） */
.anchor-badge {
  position: absolute;
  right: 2px;
  top: 2px;
  font-size: 9px;
  line-height: 1;
  color: #e6a23c;
  border: 1px solid #f0c78a;
  background: #fdf6ec;
  border-radius: 3px;
  padding: 1px 3px;
  pointer-events: none;
  z-index: 6;
}

/* 表格编辑浮条 */
.table-edit-bar {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 4px;
  z-index: 40;
  pointer-events: auto;
  /* 质感升级：圆角 + 半透明白 + 轻投影，允许换行避免溢出画布 */
  flex-wrap: wrap;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.14);
  padding: 3px 5px;
  backdrop-filter: blur(2px);
}
.tb-add {
  border: 1px solid #409eff;
  background: #ecf5ff;
  color: #409eff;
  border-radius: 4px;
  font-size: 11px;
  padding: 1px 6px;
  cursor: pointer;
  white-space: nowrap;
}
.tb-add:hover { background: #409eff; color: #fff; }
.col-chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  background: #f4f4f5;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 1px 4px;
  cursor: pointer;
}
.col-chip:hover { border-color: #409eff; color: #409eff; }
.col-chip.is-active { border-color: #409eff; color: #409eff; background: #ecf5ff; }
.col-chip { cursor: grab; touch-action: none; user-select: none; }
.col-chip.is-dragging {
  opacity: 0.45;
  outline: 2px dashed #409eff;
  cursor: grabbing;
}
.col-x { font-style: normal; font-size: 12px; margin-left: 2px; }
.col-x:hover { color: #f56c6c; }
/* × 悬停才显示，降低 10 个 chip 的视觉噪声；触屏无 hover 则常显 */
.col-chip .col-x { opacity: 0; transition: opacity 0.12s; }
.col-chip:hover .col-x { opacity: 1; }
@media (hover: none) {
  .col-chip .col-x { opacity: 1; }
}
/* 列工具「⋯」按钮与弹出菜单 */
.tb-more {
  margin-left: auto;
  border: 1px solid #dcdfe6;
  background: #fff;
  color: #606266;
  border-radius: 4px;
  font-size: 13px;
  line-height: 1;
  width: 24px;
  height: 20px;
  cursor: pointer;
  letter-spacing: 1px;
  padding: 0 0 2px;
}
.tb-more:hover,
.tb-more.on { border-color: #409eff; color: #409eff; }
.tb-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 190px;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.16);
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  z-index: 60;
}
.tb-menu-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 2px 4px;
}
.tb-menu-label { font-size: 11px; color: #909399; }
.tb-menu-item {
  border: none;
  background: transparent;
  color: #303133;
  font-size: 12px;
  padding: 5px 8px;
  border-radius: 4px;
  cursor: pointer;
  text-align: left;
}
.tb-menu-item:hover { background: #ecf5ff; color: #409eff; }
.tb-menu-item:disabled { color: #c0c4cc; cursor: not-allowed; background: transparent; }
.tb-menu-hint { font-size: 11px; color: #c0c4cc; padding: 2px 4px; }
.tb-act {
  border: 1px solid #67c23a;
  background: #f0f9eb;
  color: #67c23a;
  border-radius: 4px;
  font-size: 11px;
  padding: 1px 8px;
  cursor: pointer;
  white-space: nowrap;
}
.tb-align {
  display: inline-flex;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
}
.tb-align-btn {
  border: none;
  background: #f4f4f5;
  color: #606266;
  font-size: 11px;
  padding: 1px 7px;
  cursor: pointer;
  border-right: 1px solid #dcdfe6;
}
.tb-align-btn:last-child { border-right: none; }
.tb-align-btn.on { background: #409eff; color: #fff; }
.tb-act:hover { background: #67c23a; color: #fff; }
.tb-act:disabled { opacity: 0.4; cursor: not-allowed; }
.tb-act:disabled:hover { background: #f0f9eb; color: #67c23a; }

/* 右键菜单 */
.ctx-menu {
  position: fixed;
  z-index: 9999;
  min-width: 120px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  padding: 4px;
}
.ctx-item {
  padding: 7px 12px;
  font-size: 13px;
  color: #303133;
  border-radius: 4px;
  cursor: pointer;
}
.ctx-item:hover { background: #f5f7fa; }
.ctx-item.danger { color: #f56c6c; }
.ctx-item.danger:hover { background: #fef0f0; }
.ctx-sep { height: 1px; background: #ebeef5; margin: 4px 0; }

.resize-handle {
  position: absolute;
  right: -5px;
  bottom: -5px;
  width: 10px;
  height: 10px;
  background: #409eff;
  border: 2px solid #fff;
  border-radius: 2px;
  cursor: se-resize;
}
</style>
