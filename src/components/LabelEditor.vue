<template>
  <div class="label-editor">
    <PrintDesigner
      v-model="doc"
      :data="currentData"
      height="100%"
      @save="handleSave"
      @change="doc = $event"
    >
      <template #toolbar="{ designer }">
        <div class="label-toolbar">
          <DesignerToolbar />
          <el-divider direction="vertical" />

          <span class="lbl">纸张:</span>
          <el-select
            :model-value="paperPreset"
            size="small"
            class="paper-select"
            @change="applyPreset($event, designer)"
          >
            <el-option v-for="p in presets" :key="p.value" :label="p.label" :value="p.value" />
          </el-select>

          <template v-if="paperPreset === 'custom'">
            <el-input-number v-model="customW" size="small" :min="10" :max="500" :controls="false" class="mm-input" />
            <span class="lbl">×</span>
            <el-input-number v-model="customH" size="small" :min="10" :max="500" :controls="false" class="mm-input" />
            <span class="lbl">mm</span>
            <el-button size="small" type="primary" plain @click="applyCustom(designer)">应用尺寸</el-button>
          </template>

          <el-divider direction="vertical" />
          <el-button size="small" @click="dataVisible = true">打印数据…</el-button>
          <el-button size="small" @click="triggerImport">导入JSON</el-button>
          <el-button size="small" @click="handleExportJson">导出模板</el-button>
          <el-button size="small" type="success" plain @click="handleExportKit">导出模板数据</el-button>
          <el-button size="small" type="warning" plain @click="openRenderer">渲染器预览</el-button>
          <el-button size="small" type="primary" plain @click="designer.preview()">预览</el-button>
          <el-button size="small" type="primary" @click="designer.print()">打印</el-button>
          <el-button size="small" @click="designer.save ? designer.save() : handleSave()">保存</el-button>
          <el-button size="small" @click="handleLoad">载入</el-button>
          <el-button size="small" @click="resetTemplate">恢复默认</el-button>
        </div>
      </template>
    </PrintDesigner>

    <!-- 打印数据 -->
    <el-dialog v-model="dataVisible" title="打印数据（JSON）—— 模拟后端返回" width="680px" destroy-on-close>
      <el-alert type="info" :closable="false" show-icon class="data-tip"
        title="元素的 field 与此数据的字段名对应；应用后画布实时预览填充效果" />
      <el-input v-model="dataJson" type="textarea" :rows="14" class="data-editor" spellcheck="false" />
      <template #footer>
        <el-button @click="dataJson = JSON.stringify(mockLabelData, null, 2)">恢复示例数据</el-button>
        <el-button @click="dataVisible = false">取消</el-button>
        <el-button type="primary" @click="applyData">应用</el-button>
      </template>
    </el-dialog>

    <!-- 渲染器预览：label-kit LabelDoc，与 ERP 端渲染同源；左侧勾选本次要打印的元素 -->
    <el-dialog v-model="rendererVisible" title="标签渲染器预览（label-kit，与 ERP 端同源）" width="640px" destroy-on-close>
      <div class="renderer-layout">
        <aside class="element-picker">
          <div class="picker-head">
            <span class="lbl">打印元素</span>
            <div class="picker-actions">
              <el-button link type="primary" size="small" @click="selectAll">全选</el-button>
              <el-button link type="info" size="small" @click="clearVisible">清空</el-button>
            </div>
          </div>
          <div class="picker-list">
            <label v-for="el in selectableElements" :key="el.id" class="picker-item">
              <el-checkbox
                :model-value="visibleIds.includes(el.id)"
                @change="(v: unknown) => toggleVisible(el.id, v as boolean)"
              />
              <span class="picker-name" :title="el.name || el.type">{{ el.name || el.type }}</span>
              <span class="picker-type">{{ typeLabel(el.type) }}</span>
            </label>
            <p v-if="!selectableElements.length" class="picker-empty">模板暂无可打印元素</p>
          </div>
        </aside>
        <div class="renderer-host">
          <LabelDoc ref="rendererHost" :template="doc" :data="rendererData" :visible-ids="visibleIds" />
        </div>
      </div>
      <template #footer>
        <el-button @click="rendererVisible = false">关闭</el-button>
        <el-button type="primary" :loading="printing" @click="printRenderer">打印勾选元素</el-button>
      </template>
    </el-dialog>

    <input ref="fileInputRef" type="file" accept="application/json,.json" class="hidden-input" @change="onFileChosen" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { ElMessage } from 'element-plus'
import {
  PrintDesigner,
  DesignerToolbar,
  createDefaultDocument,
  createDefaultElement
} from 'print-canvas-designer'
import type { PrintDocument, PrintElement, PrintDesignerContext } from 'print-canvas-designer'
import { downloadFile } from '../core/renderer'
import { buildLabelSampleData } from '../../label-kit/label-schema'
import LabelDoc from '../../label-kit/LabelDoc.vue'
import { useLabelPrint } from '../../label-kit/useLabelPrint'
import { mockLabelData } from '../mock/data'

const STORAGE_KEY = 'print-template-editor:label-doc'

/** mm -> px（96dpi，与库内置 A4=794x1123px 一致） */
const mmToPx = (mm: number) => Math.round((mm * 96) / 25.4)

interface Preset { value: string; label: string; w: number; h: number; paperType: 'a4' | 'label-100x60' | 'custom' }

/** 内置 + 常用小尺寸标签预设 */
const presets: Preset[] = [
  { value: 'a4', label: 'A4 (210×297)', w: 210, h: 297, paperType: 'a4' },
  { value: '30x20', label: '30×20 商品贴纸', w: 30, h: 20, paperType: 'custom' },
  { value: '40x30', label: '40×30 标签', w: 40, h: 30, paperType: 'custom' },
  { value: '50x30', label: '50×30 标签', w: 50, h: 30, paperType: 'custom' },
  { value: '60x40', label: '60×40 货品标签', w: 60, h: 40, paperType: 'custom' },
  { value: '70x50', label: '70×50 标签', w: 70, h: 50, paperType: 'custom' },
  { value: '100x50', label: '100×50 面单', w: 100, h: 50, paperType: 'custom' },
  { value: 'label-100x60', label: '100×60 面单', w: 100, h: 60, paperType: 'label-100x60' },
  { value: '100x100', label: '100×100 鞋盒标', w: 100, h: 100, paperType: 'custom' },
  { value: '100x150', label: '100×150 面单', w: 100, h: 150, paperType: 'custom' },
  { value: 'custom', label: '自定义尺寸…', w: 0, h: 0, paperType: 'custom' }
]

/** 默认 60×40 货品标签模板 */
function createDefaultLabelDoc(): PrintDocument {
  const doc = createDefaultDocument({
    width: mmToPx(60),
    height: mmToPx(40),
    margin: { top: 6, right: 6, bottom: 6, left: 6 }
  })
  doc.name = '货品标签 60×40'
  const W = mmToPx(60) - 12 // 内容宽度
  const text = (field: string, name: string, top: number, height: number, fontSize: number): PrintElement => {
    const el = createDefaultElement('text', { x: 6, y: top })
    el.field = field
    el.name = name
    el.style.left = 6
    el.style.top = top
    el.style.width = W
    el.style.height = height
    el.style.fontSize = fontSize
    el.style.borderWidth = 0
    return el
  }
  const barcode = createDefaultElement('barcode', { x: 6, y: 58 })
  barcode.field = 'barcode'
  barcode.name = '条码'
  barcode.style.left = 6
  barcode.style.top = 58
  barcode.style.width = W
  barcode.style.height = mmToPx(13)
  barcode.style.borderWidth = 0
  doc.page.items = [
    text('productName', '品名', 6, mmToPx(7), 9),
    text('spec', '规格', 6 + mmToPx(7), mmToPx(5), 7),
    text('sku', 'SKU', 6 + mmToPx(12), mmToPx(5), 7),
    barcode,
    text('qty', '数量', 58 + mmToPx(13), mmToPx(5), 7)
  ]
  return doc
}

/** 初始化时从本地恢复上次保存的标签模板；无/损坏则回退默认（修复：刷新后不再丢失） */
function loadInitialDoc(): PrintDocument {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as PrintDocument
      if (parsed && parsed.page && Array.isArray(parsed.page.items)) return parsed
    } catch {
      /* 忽略损坏数据 */
    }
  }
  return createDefaultLabelDoc()
}

const doc = ref<PrintDocument>(loadInitialDoc())
const dataVisible = ref(false)
const dataJson = ref(JSON.stringify(mockLabelData, null, 2))
const fileInputRef = useTemplateRef<HTMLInputElement>('fileInputRef')
let currentData: Record<string, unknown> = { ...mockLabelData }

const customW = ref(60)
const customH = ref(40)

/** 根据当前页面尺寸反推选中的预设 */
const paperPreset = computed<string>(() => {
  const w = doc.value.page.width
  const h = doc.value.page.height
  const hit = presets.find((p) => p.w > 0 && mmToPx(p.w) === w && mmToPx(p.h) === h)
  return hit ? hit.value : 'custom'
})

function applyPreset(value: string, designer: PrintDesignerContext): void {
  const p = presets.find((x) => x.value === value)
  if (!p) return
  if (value === 'custom') return // 等用户输入自定义尺寸
  designer.updatePageSize({
    width: mmToPx(p.w),
    height: mmToPx(p.h),
    paperType: p.paperType
  })
  ElMessage.success(`已切换为 ${p.label}`)
}

function applyCustom(designer: PrintDesignerContext): void {
  designer.updatePageSize({
    width: mmToPx(customW.value),
    height: mmToPx(customH.value),
    paperType: 'custom'
  })
  ElMessage.success(`已应用 ${customW.value}×${customH.value}mm`)
}

/* ---- 数据 ---- */
function applyData(): void {
  try {
    currentData = JSON.parse(dataJson.value) as Record<string, unknown>
    dataVisible.value = false
    ElMessage.success('打印数据已应用')
  } catch {
    ElMessage.error('JSON 格式有误，请检查')
  }
}

/* ---- 渲染器预览（label-kit，与 ERP 端同源） ---- */
const rendererVisible = ref(false)
const rendererData = ref<Record<string, unknown>>({ ...mockLabelData })
const rendererHost = useTemplateRef<{ $el: HTMLElement } | null>('rendererHost')
const { print: printLabel, printing } = useLabelPrint()

/**
 * 业务勾选的可见元素 id（打印环节临时决定展示哪些，不写回模板）。
 * 记忆到 localStorage（按模板名），重复打印免重勾。LabelDoc 不传则展示全部。
 */
const VISIBLE_KEY = 'print-template-editor:label-visible:'
const visibleIds = ref<string[]>([])

/** 可被勾选的元素：模板内未永久隐藏（hidden）的元素 */
const selectableElements = computed(() =>
  (doc.value.page?.items ?? []).filter((el) => !el.hidden && el.style)
)

const TYPE_LABELS: Record<string, string> = {
  text: '文本', image: '图片', rect: '矩形', line: '线条', qrcode: '二维码', barcode: '条码'
}
function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type
}

function allIds(): string[] {
  return selectableElements.value.map((el) => el.id)
}

function restoreVisible(): void {
  const key = VISIBLE_KEY + (doc.value.name ?? '')
  const raw = localStorage.getItem(key)
  if (raw) {
    try {
      const saved = JSON.parse(raw) as string[]
      const valid = new Set(allIds())
      // 仅保留当前模板中仍存在的元素 id，丢弃陈旧 id
      visibleIds.value = saved.filter((id) => valid.has(id))
      return
    } catch {
      /* 忽略损坏数据，回退到全选 */
    }
  }
  visibleIds.value = allIds() // 默认全选
}

function persistVisible(): void {
  try {
    localStorage.setItem(VISIBLE_KEY + (doc.value.name ?? ''), JSON.stringify(visibleIds.value))
  } catch {
    /* 容量溢出等忽略 */
  }
}

function toggleVisible(id: string, checked: boolean): void {
  visibleIds.value = checked
    ? [...visibleIds.value, id]
    : visibleIds.value.filter((x) => x !== id)
  persistVisible()
}

function selectAll(): void {
  visibleIds.value = allIds()
  persistVisible()
}

function clearVisible(): void {
  visibleIds.value = []
  persistVisible()
}

function openRenderer(): void {
  rendererData.value = { ...currentData }
  restoreVisible()
  rendererVisible.value = true
}

async function printRenderer(): Promise<void> {
  const el = rendererHost.value?.$el
  if (!el) return
  await printLabel(el, { template: doc.value, copies: 1 })
}

/* ---- 保存 / 载入 / 导入导出 ---- */
function handleSave(value?: PrintDocument): void {
  const toSave = value ?? doc.value
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
    if (value) doc.value = value // 同步库回写的最新文档
    ElMessage.success('标签模板已保存到浏览器本地存储')
  } catch {
    ElMessage.error('保存失败')
  }
}

/** 恢复默认模板（并清掉本地保存），让「自动恢复」可撤销 */
function resetTemplate(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* 忽略存储异常 */
  }
  doc.value = createDefaultLabelDoc()
  ElMessage.info('已恢复默认模板')
}

function handleLoad(): void {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    ElMessage.warning('本地没有已保存的标签模板')
    return
  }
  try {
    doc.value = JSON.parse(raw) as PrintDocument
    ElMessage.success('标签模板已载入')
  } catch {
    ElMessage.error('本地模板数据损坏')
  }
}

function handleExportJson(): void {
  downloadFile(`${doc.value.name}.label.json`, JSON.stringify(doc.value, null, 2), 'application/json')
}

/**
 * 导出当前模板数据（供 ERP 标签渲染器 LabelDoc 使用）：
 * { name, template: PrintDocument, sampleData }
 * sampleData = 按模板字段生成的 {{字段}} 占位 + 当前测试数据（已有值优先）。
 */
async function handleExportKit(): Promise<void> {
  const payload = {
    name: doc.value.name,
    template: doc.value,
    sampleData: { ...buildLabelSampleData(doc.value), ...currentData }
  }
  const text = JSON.stringify(payload, null, 2)
  downloadFile(`${doc.value.name || 'label'}.label.json`, text, 'application/json')
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('模板数据已导出并复制（template + sampleData，供 ERP 标签渲染器使用）')
  } catch {
    ElMessage.success('模板数据已导出')
  }
}

function triggerImport(): void {
  fileInputRef.value?.click()
}

function onFileChosen(evt: Event): void {
  const input = evt.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result)) as PrintDocument
      if (!parsed.page || !Array.isArray(parsed.page.items)) throw new Error('格式不正确')
      doc.value = parsed
      ElMessage.success(`已导入标签模板：${parsed.name ?? '未命名'}`)
    } catch {
      ElMessage.error('模板 JSON 格式有误')
    }
  }
  reader.readAsText(file)
  input.value = ''
}
</script>

<style scoped>
.label-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}
.label-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 0 8px;
}
.lbl { font-size: 12px; color: #606266; }
.paper-select { width: 150px; }
.mm-input { width: 56px; }
.data-tip { margin-bottom: 12px; }
.data-editor :deep(textarea) { font-family: Consolas, Monaco, monospace; font-size: 12px; }
.renderer-host { display: flex; justify-content: center; overflow: auto; flex: 1; min-width: 0; }
.hidden-input { display: none; }
.renderer-layout { display: flex; gap: 12px; align-items: flex-start; }
.element-picker { width: 184px; flex: none; border: 1px solid #ebeef5; border-radius: 6px; padding: 8px; max-height: 58vh; overflow: auto; box-sizing: border-box; }
.picker-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.picker-actions { display: flex; gap: 2px; }
.picker-list { display: flex; flex-direction: column; gap: 2px; }
.picker-item { display: flex; align-items: center; gap: 6px; padding: 4px 4px; border-radius: 4px; cursor: pointer; }
.picker-item:hover { background: #f5f7fa; }
.picker-name { flex: 1; font-size: 13px; color: #303133; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.picker-type { font-size: 11px; color: #909399; background: #f4f4f5; border-radius: 3px; padding: 0 5px; flex: none; }
.picker-empty { font-size: 12px; color: #909399; text-align: center; padding: 12px 0; margin: 0; }
</style>
