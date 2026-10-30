<template>
  <div class="prop-panel">
    <div class="panel-title">属性</div>

    <!-- 未选中：页面设置 -->
    <template v-if="!primary">
      <el-form label-position="top" size="small">
        <el-form-item label="模板名称">
          <el-input v-model="schema.name" />
        </el-form-item>
        <el-form-item label="页面宽度 (mm)">
          <el-input-number v-model="schema.page.widthMm" :min="50" :max="500" />
        </el-form-item>
        <el-form-item label="页面高度 (mm)">
          <el-input-number v-model="schema.page.heightMm" :min="50" :max="500" />
        </el-form-item>
        <el-form-item label="页面边距 (mm，转流式/打印用)">
          <el-input-number
            :model-value="schema.page.marginMm ?? 10"
            :min="0"
            :max="50"
            @update:model-value="(v: number | undefined) => (schema.page.marginMm = v ?? 10)"
          />
        </el-form-item>
        <div class="quick-page">
          <el-button size="small" @click="setPage(210, 297)">A4 竖版</el-button>
          <el-button size="small" @click="setPage(297, 210)">A4 横版</el-button>
        </div>
        <div class="empty-tip">未选中元素，点击/框选画布中的元素进行编辑</div>
      </el-form>
    </template>

    <!-- 多选：批量操作 -->
    <template v-else-if="selectedIds.length > 1">
      <el-alert :closable="false" type="info" class="multi-tip">
        已选中 {{ selectedIds.length }} 个元素
      </el-alert>
      <el-form label-position="top" size="small">
        <el-form-item label="水平对齐">
          <el-button-group>
            <el-button size="small" @click="align('left')">左</el-button>
            <el-button size="small" @click="align('hcenter')">居中</el-button>
            <el-button size="small" @click="align('right')">右</el-button>
          </el-button-group>
        </el-form-item>
        <el-form-item label="垂直对齐">
          <el-button-group>
            <el-button size="small" @click="align('top')">上</el-button>
            <el-button size="small" @click="align('vcenter')">居中</el-button>
            <el-button size="small" @click="align('bottom')">下</el-button>
          </el-button-group>
        </el-form-item>
        <el-form-item label="批量">
          <el-button-group>
            <el-button size="small" @click="equalize('w')">等宽</el-button>
            <el-button size="small" @click="equalize('h')">等高</el-button>
          </el-button-group>
        </el-form-item>
        <el-form-item label="网格排列（等分安全区宽度）">
          <el-button-group>
            <el-button size="small" @click="gridLayout(1)">一等分</el-button>
            <el-button size="small" @click="gridLayout(2)">两等分</el-button>
            <el-button size="small" @click="gridLayout(3)">三等分</el-button>
            <el-button size="small" @click="gridLayout(4)">四等分</el-button>
          </el-button-group>
          <div class="grid-tip">
            按阅读顺序（先上后下、先左后右）在安全边距内均分排列，列宽自动相等、间距统一 4mm，行高按行内最高元素累加。
          </div>
        </el-form-item>
      </el-form>
      <el-button type="danger" plain class="del-btn" size="small" @click="emit('delete')">
        删除选中 ({{ selectedIds.length }})
      </el-button>
    </template>

    <!-- 单选：元素属性 -->
    <template v-else>
      <el-form label-position="top" size="small">
        <el-collapse>
          <el-collapse-item title="位置与尺寸" name="pos">
            <div class="grid2">
              <el-form-item label="X (mm)"><el-input-number v-model="primary.x" :min="0" :step="1" /></el-form-item>
              <el-form-item label="Y (mm)"><el-input-number v-model="primary.y" :min="0" :step="1" /></el-form-item>
              <el-form-item label="宽 (mm)"><el-input-number v-model="primary.w" :min="2" :step="1" /></el-form-item>
              <el-form-item label="高 (mm)">
                <el-input-number
                  v-model="primary.h"
                  :min="1"
                  :step="1"
                  :disabled="primary.type === 'table'"
                  title="表格高度由内容（表头+行数+字号）自适应，请调整「编辑器预览行数」"
                />
              </el-form-item>
            </div>
          </el-collapse-item>

          <el-collapse-item title="样式" name="style">
            <el-form-item label="字号 (pt)"><el-input-number v-model="style.fontSize" :min="5" :max="48" /></el-form-item>
            <el-form-item label="对齐">
              <el-radio-group v-model="style.align">
                <el-radio-button value="left">左</el-radio-button>
                <el-radio-button value="center">中</el-radio-button>
                <el-radio-button value="right">右</el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="垂直对齐">
              <el-radio-group v-model="style.vAlign">
                <el-radio-button value="top">上</el-radio-button>
                <el-radio-button value="middle">中</el-radio-button>
                <el-radio-button value="bottom">下</el-radio-button>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="加粗"><el-switch v-model="style.bold" /></el-form-item>
            <el-form-item label="颜色"><el-color-picker v-model="style.color" /></el-form-item>
          </el-collapse-item>

          <!-- 类型特有属性 -->
          <el-collapse-item title="内容" name="content">
            <template v-if="primary.type === 'title' || primary.type === 'text'">
              <el-form-item label="文本（支持 {{ '{' + '{field}}' + '}} 占位）">
                <el-input v-model="textEl.text" type="textarea" :rows="2" />
              </el-form-item>
            </template>
            <template v-else-if="primary.type === 'labelValue'">
              <el-form-item label="标签"><el-input v-model="lvEl.label" /></el-form-item>
              <el-form-item label="值（支持 {{ '{' + '{field}}' + '}} 占位）">
                <el-input v-model="lvEl.value" />
              </el-form-item>
            </template>
            <template v-else-if="primary.type === 'image'">
              <el-form-item label="图片 URL 字段">
                <el-input v-model="imgEl.field" placeholder="如 details.0.imageUrl 或 imageUrl" />
              </el-form-item>
            </template>
            <template v-else-if="primary.type === 'barcode'">
              <el-form-item label="编码内容（支持 {{ '{' + '{field}}' + '}} 占位）">
                <el-input v-model="bcEl.value" placeholder="如 {{orderNo}} 或固定文本" />
              </el-form-item>
              <el-form-item label="条码制式">
                <el-radio-group v-model="bcEl.format">
                  <el-radio-button value="CODE128">CODE128</el-radio-button>
                  <el-radio-button value="EAN13">EAN13</el-radio-button>
                  <el-radio-button value="CODE39">CODE39</el-radio-button>
                </el-radio-group>
              </el-form-item>
              <el-form-item label="显示人眼可读文本"><el-switch v-model="bcEl.showText" /></el-form-item>
              <div class="bc-tip">
                CODE128 支持 ASCII 文本；EAN13 需 12/13 位数字（自动补校验位）；CODE39 支持 0-9 A-Z 与 - . 空格 $ / + %
              </div>
            </template>
            <template v-else-if="primary.type === 'qrcode'">
              <el-form-item label="编码内容（支持 {{ '{' + '{field}}' + '}} 占位）">
                <el-input v-model="qrEl.value" type="textarea" :rows="2" placeholder="如 {{qrContent}} 或固定文本/URL" />
              </el-form-item>
              <el-form-item label="容错级别">
                <el-radio-group v-model="qrEl.ecl">
                  <el-radio-button value="L">L 7%</el-radio-button>
                  <el-radio-button value="M">M 15%</el-radio-button>
                  <el-radio-button value="Q">Q 25%</el-radio-button>
                  <el-radio-button value="H">H 30%</el-radio-button>
                </el-radio-group>
              </el-form-item>
              <div class="bc-tip">内容较短时建议提高容错级别（如 H），更耐污损；过长会自动选用更大版本（最大版本 10）</div>
            </template>
            <template v-else-if="primary.type === 'table'">
              <el-form-item label="数据源字段（数组）">
                <el-input v-model="tbEl.srcField" placeholder="如 details" />
              </el-form-item>
              <el-form-item label="编辑器预览行数">
                <el-input-number v-model="tbEl.previewRows" :min="0" :max="50" />
              </el-form-item>

              <div class="col-head">
                <span>表格列（可设「合并」向右合并相邻列）</span>
                <el-button size="small" type="primary" @click="addColumn">+ 添加列</el-button>
              </div>
              <div v-for="(c, i) in tbEl.columns" :key="i" class="col-row">
                <el-input v-model="c.title" placeholder="列名" class="col-input" />
                <el-input v-model="c.field" placeholder="字段" class="col-input" />
                <el-input v-model="c.width" placeholder="宽度%" class="col-input w-sm" />
                <el-select v-model="c.align" class="col-input w-sm">
                  <el-option label="左" value="left" />
                  <el-option label="中" value="center" />
                  <el-option label="右" value="right" />
                </el-select>
                <el-input-number v-model="c.colSpan" :min="1" :max="12" class="col-input w-sm" title="向右合并列数" />
                <el-input-number v-model="c.minWidth" :min="0" :max="100" :step="1" class="col-input w-sm" title="最小宽度(%)" placeholder="最小%" controls-position="right" />
                <el-input-number v-model="c.maxWidth" :min="0" :max="100" :step="1" class="col-input w-sm" title="最大宽度(%)" placeholder="最大%" controls-position="right" />
                <el-button size="small" type="danger" text @click="tbEl.columns.splice(i, 1)">删</el-button>
              </div>

              <el-form-item label="显示合计行"><el-switch v-model="tbEl.showSummary" /></el-form-item>
              <template v-if="tbEl.showSummary">
                <el-form-item label="合计标签"><el-input v-model="tbEl.summaryLabel" /></el-form-item>
                <el-form-item label="标签横跨列数">
                  <el-input-number v-model="tbEl.summarySpan" :min="0" :max="tbEl.columns.length" />
                </el-form-item>
                <el-form-item label="求和字段（多选）">
                  <el-select v-model="tbEl.sumFields" multiple placeholder="选择需要求和的列字段">
                    <el-option v-for="c in tbEl.columns" :key="c.field" :label="c.title" :value="c.field" />
                  </el-select>
                </el-form-item>
              </template>
              <el-form-item label="表头背景"><el-color-picker v-model="style.headerBg" /></el-form-item>
              <el-form-item label="边框颜色"><el-color-picker v-model="style.borderColor" /></el-form-item>
            </template>
          </el-collapse-item>

          <!-- 锚点跟随：表格行数不定时，表尾元素贴紧源元素（如表格）底边 -->
          <el-collapse-item title="锚点跟随" name="anchor">
            <el-form-item label="跟随目标（源元素）">
              <el-select
                :model-value="anchorEl.anchor ?? ''"
                clearable
                placeholder="不跟随（按 Y 坐标定位）"
                @update:model-value="(v: string) => (anchorEl.anchor = v || undefined)"
              >
                <el-option
                  v-for="e in anchorCandidates"
                  :key="e.id"
                  :label="elementLabel(e)"
                  :value="e.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item v-if="anchorEl.anchor" label="间距 (mm)">
              <el-input-number
                :model-value="anchorEl.gapMm ?? 4"
                :min="0"
                :max="100"
                :step="1"
                @update:model-value="(v: number | undefined) => (anchorEl.gapMm = v ?? 4)"
              />
            </el-form-item>
            <div v-if="anchorEl.anchor" class="anchor-tip">
              渲染/打印时本元素 top = 「{{ elementLabel(anchorSrc!) }}」实际底边 + 间距，
              源内容（如表格）变多变少都会自动跟随。
            </div>
          </el-collapse-item>
        </el-collapse>
      </el-form>
      <el-button type="danger" plain class="del-btn" size="small" @click="emit('delete')">删除该元素</el-button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TemplateSchema, TemplateElement, TableColumn, ElStyle } from '../types/template'

const props = defineProps<{
  schema: TemplateSchema
  selectedIds: string[]
}>()

const emit = defineEmits<{
  (e: 'delete'): void
}>()

const primary = computed<TemplateElement | null>(() => {
  const id = props.selectedIds[props.selectedIds.length - 1]
  return id ? (props.schema.elements.find((e) => e.id === id) ?? null) : null
})

const style = computed<ElStyle>(() => primary.value?.style ?? {})

const textEl = computed(() => (primary.value ?? {}) as { text: string })
const lvEl = computed(() => (primary.value ?? {}) as { label: string; value: string })
const imgEl = computed(() => (primary.value ?? {}) as { field: string })
const tbEl = computed(() =>
  (primary.value ?? {}) as {
    srcField: string
    columns: TableColumn[]
    showSummary: boolean
    summaryLabel: string
    summarySpan: number
    sumFields: string[]
    previewRows?: number
  }
)

/* ---- 锚点跟随 ---- */
const bcEl = computed(() => (primary.value ?? {}) as { value: string; format: 'CODE128' | 'EAN13' | 'CODE39'; showText: boolean })
const qrEl = computed(() => (primary.value ?? {}) as { value: string; ecl: 'L' | 'M' | 'Q' | 'H' })
const anchorEl = computed(() => (primary.value ?? {}) as { anchor?: string; gapMm?: number })

/** 可选跟随目标：除自身外的所有元素 */
const anchorCandidates = computed(() =>
  primary.value ? props.schema.elements.filter((e) => e.id !== primary.value?.id) : []
)

const anchorSrc = computed(
  () => props.schema.elements.find((e) => e.id === anchorEl.value.anchor) ?? null
)

function elementLabel(e: TemplateElement): string {
  const kind: Record<string, string> = {
    title: '标题', text: '文本', labelValue: '标签值', table: '表格', image: '图片', line: '线条'
  }
  const t = (e as { text?: string }).text || (e as { label?: string }).label || ''
  return `${kind[e.type] ?? e.type}：${String(t).slice(0, 12) || e.id}`
}

function addColumn(): void {
  tbEl.value.columns?.push({ title: '新列', field: 'field', width: '10%', align: 'left' })
}

function setPage(w: number, h: number): void {
  props.schema.page.widthMm = w
  props.schema.page.heightMm = h
}

/** 多选批量对齐 / 等宽等高 */
function selectedElements(): TemplateElement[] {
  const set = new Set(props.selectedIds)
  return props.schema.elements.filter((e) => set.has(e.id))
}

function align(mode: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom'): void {
  const els = selectedElements()
  if (els.length < 2) return
  const minX = Math.min(...els.map((e) => e.x))
  const maxX = Math.max(...els.map((e) => e.x + e.w))
  const minY = Math.min(...els.map((e) => e.y))
  const maxY = Math.max(...els.map((e) => e.y + e.h))
  for (const e of els) {
    if (mode === 'left') e.x = minX
    else if (mode === 'right') e.x = maxX - e.w
    else if (mode === 'hcenter') e.x = (minX + maxX) / 2 - e.w / 2
    else if (mode === 'top') e.y = minY
    else if (mode === 'bottom') e.y = maxY - e.h
    else if (mode === 'vcenter') e.y = (minY + maxY) / 2 - e.h / 2
  }
}

function equalize(kind: 'w' | 'h'): void {
  const els = selectedElements()
  if (els.length < 2) return
  const avg = Math.round(els.reduce((s, e) => s + (kind === 'w' ? e.w : e.h), 0) / els.length)
  for (const e of els) {
    if (kind === 'w') e.w = avg
    else e.h = avg
  }
}

/** 网格等分排列：选中元素按 N 等分均分安全区宽度，行优先自动排列 */
function gridLayout(n: 1 | 2 | 3 | 4): void {
  const els = selectedElements()
  if (els.length === 0) return
  const m = props.schema.page.marginMm ?? 10
  const areaW = props.schema.page.widthMm - m * 2
  if (areaW <= 0) return
  const gap = 4
  const colW = (areaW - (n - 1) * gap) / n
  const r2 = (v: number): number => Math.round(v * 100) / 100
  // 阅读顺序：先按 Y 再按 X，行优先分块
  const sorted = [...els].sort((a, b) => a.y - b.y || a.x - b.x)
  let rowY = Math.min(...els.map((e) => e.y))
  for (let i = 0; i < sorted.length; i += n) {
    const row = sorted.slice(i, i + n)
    const rowH = Math.max(...row.map((e) => e.h))
    row.forEach((e, col) => {
      e.x = r2(m + col * (colW + gap))
      e.w = r2(colW)
      e.y = r2(rowY)
    })
    rowY += rowH + gap
  }
}
</script>

<style scoped>
.prop-panel {
  width: 300px;
  background: #fff;
  border-left: 1px solid #e4e7ed;
  padding: 12px;
  overflow-y: auto;
}
.panel-title {
  font-weight: bold;
  font-size: 13px;
  color: #606266;
  margin-bottom: 8px;
}
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 8px; }
.grid2 :deep(.el-input-number) { width: 100%; }
.empty-tip { font-size: 12px; color: #909399; text-align: center; padding: 20px 0; }
.quick-page { display: flex; gap: 8px; margin-bottom: 12px; }
.col-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #606266;
  margin: 8px 0 4px;
}
.col-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  margin-bottom: 6px;
}
.col-input { flex: 1; min-width: 0; }
.col-input.w-sm { flex: 0 0 64px; }
.multi-tip { margin-bottom: 12px; }
.grid-tip { font-size: 12px; color: #909399; line-height: 1.5; margin-top: 4px; }
.anchor-tip { font-size: 12px; color: #909399; line-height: 1.5; margin-top: 4px; }
.bc-tip { font-size: 12px; color: #909399; line-height: 1.5; margin: -4px 0 4px; }
.del-btn { width: 100%; margin-top: 12px; }
</style>
