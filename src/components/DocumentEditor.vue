<template>
  <div class="document-editor">
    <Toolbar
      v-model:template-name="schema.name"
      :zoom="zoom"
      :can-undo="canUndo"
      @zoom="changeZoom"
      @undo="doUndo"
      @data="dataVisible = true"
      @preview="openPreview"
      @print="handlePrint"
      @save="handleSave"
      @loadTemplate="handleLoad"
      @importJson="triggerImport"
      @copyJson="handleCopyJson"
      @exportJson="handleExportJson"
      @exportHtml="handleExportHtml"
      @exportKit="handleExportKit"
      @renderPreview="openRenderPreview"
      @convertFlow="handleConvertFlow"
      @reset="handleReset"
    />

    <div class="main">
      <PalettePanel />
      <CanvasEditor :schema="schema" :selected-ids="selectedIds" :zoom="zoom" @select="onSelect" />
      <PropertyPanel :schema="schema" :selected-ids="selectedIds" @delete="deleteSelected" />
    </div>

    <!-- 预览 -->
    <el-dialog v-model="previewVisible" title="打印预览" width="880px" destroy-on-close>
      <iframe :srcdoc="previewHtml" class="preview-frame"></iframe>
    </el-dialog>

    <!-- 打印数据 -->
    <el-dialog v-model="dataVisible" title="打印数据（JSON）—— 模拟后端返回" width="720px" destroy-on-close>
      <el-alert type="info" :closable="false" show-icon class="data-tip"
        title="字段路径需与模板中的 {{占位符}} 一致，表格组件绑定数组字段（如 details）" />
      <el-input v-model="dataJson" type="textarea" :rows="18" class="data-editor" spellcheck="false" />
      <template #footer>
        <el-button @click="dataJson = JSON.stringify(mockPrintData, null, 2)">恢复示例数据</el-button>
        <el-button @click="dataVisible = false">取消</el-button>
        <el-button type="primary" @click="applyData">应用</el-button>
      </template>
    </el-dialog>

    <!-- 渲染器预览：print-kit DocumentDoc，与 ERP 端渲染同源（绝对定位，版式零损失） -->
    <el-dialog v-model="renderVisible" title="渲染器预览（print-kit DocumentDoc，与 ERP 端同源）" width="860px" destroy-on-close>
      <div class="render-host">
        <DocumentDoc ref="renderHost" :template="schema" :data="renderData" />
      </div>
      <template #footer>
        <el-button @click="renderVisible = false">关闭</el-button>
        <el-button type="primary" :loading="renderPrinting" @click="printRenderer">打印</el-button>
      </template>
    </el-dialog>

    <input ref="fileInputRef" type="file" accept="application/json,.json" class="hidden-input" @change="onFileChosen" />

    <!-- 保存：命名弹窗 -->
    <TemplateSaveDialog v-model="saveVisible" :initial-name="schema.name" @save="onConfirmSave" />
    <!-- 模板库：载入/删除/查看 -->
    <TemplateLibraryDialog v-model="libraryVisible" kind="document" :enable-preview="true" @load="onLoadLibrary" @preview="onPreviewLibrary" />

    <!-- 模板记录预览（不覆盖当前，仅供查看已保存模板长什么样） -->
    <el-dialog v-model="recordPreviewVisible" title="模板记录预览（不影响当前编辑）" width="860px" destroy-on-close>
      <div class="render-host">
        <DocumentDoc v-if="recordPreviewData" :template="recordPreviewData" :data="{}" />
      </div>
      <template #footer>
        <el-button @click="recordPreviewVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import { ElMessage } from 'element-plus'
import Toolbar from './Toolbar.vue'
import PalettePanel from './PalettePanel.vue'
import CanvasEditor from './CanvasEditor.vue'
import PropertyPanel from './PropertyPanel.vue'
import { createDefaultSchema, sanitizeSchema } from '../core/factories'
import { useHistory } from '../core/useHistory'
import { convertDocumentToFlow } from '../core/convertToFlow'
import { buildDocumentHTML, printHtml, downloadFile } from '../core/renderer'
import { saveTemplate } from '../core/templateLibrary'
import type { StoredTemplate } from '../core/templateLibrary'
import DocumentDoc from '../../print-kit/DocumentDoc.vue'
import { usePrint } from '../../print-kit/usePrint'
import { docPageExtraCss, buildDocSampleData } from '../../print-kit/document-schema'
import TemplateSaveDialog from './TemplateSaveDialog.vue'
import TemplateLibraryDialog from './TemplateLibraryDialog.vue'
import { mockPrintData } from '../mock/data'
import type { TemplateSchema } from '../types/template'

const STORAGE_KEY = 'print-template-editor:schema'

const schema = ref<TemplateSchema>(createDefaultSchema())
const selectedIds = ref<string[]>([])
const zoom = ref(1)
const previewVisible = ref(false)

/* ---- 撤销历史：覆盖所有 schema 变更（画布/属性面板/列操作等） ---- */
const { undo: historyUndo, canUndo, resetBaseline } = useHistory(schema)
function doUndo(): void {
  if (!historyUndo()) {
    ElMessage.info('没有可撤销的操作')
    return
  }
  // 撤销后清理已不存在的选中项，保持选中态与数据一致
  selectedIds.value = selectedIds.value.filter((id) =>
    schema.value.elements.some((e) => e.id === id)
  )
}
const dataVisible = ref(false)
const dataJson = ref(JSON.stringify(mockPrintData, null, 2))
const fileInputRef = useTemplateRef<HTMLInputElement>('fileInputRef')

let currentData: Record<string, unknown> = { ...mockPrintData }

function onSelect(ids: string[]): void {
  selectedIds.value = ids
}

function changeZoom(delta: number): void {
  zoom.value = Math.round(Math.min(2, Math.max(0.4, zoom.value + delta)) * 10) / 10
}

function deleteSelected(): void {
  if (!selectedIds.value.length) return
  const set = new Set(selectedIds.value)
  schema.value.elements = schema.value.elements.filter((e) => !set.has(e.id))
  selectedIds.value = []
}

function parseData(): Record<string, unknown> | null {
  try {
    return JSON.parse(dataJson.value) as Record<string, unknown>
  } catch {
    ElMessage.error('打印数据 JSON 格式有误，请检查')
    return null
  }
}

function applyData(): void {
  const d = parseData()
  if (!d) return
  currentData = d
  dataVisible.value = false
  ElMessage.success('打印数据已应用')
}

/* ---- 预览 / 打印 ---- */
const previewHtml = ref('')

function openPreview(): void {
  const d = parseData()
  if (!d) return
  currentData = d
  previewHtml.value = buildDocumentHTML(schema.value, d, { copies: 1 })
  previewVisible.value = true
}

function handlePrint(): void {
  const d = parseData()
  if (!d) return
  currentData = d
  printHtml(buildDocumentHTML(schema.value, d, { copies: 1 }))
}

/* ---- 保存 / 载入（模板库） ---- */
const saveVisible = ref(false)
const libraryVisible = ref(false)

function handleSave(): void {
  saveVisible.value = true
}

function onConfirmSave(name: string): void {
  schema.value.name = name
  try {
    const { updated } = saveTemplate('document', name, schema.value)
    ElMessage.success(updated ? `模板「${name}」已更新` : `模板「${name}」已保存到模板库`)
  } catch {
    ElMessage.error('保存失败，请重试')
  }
}

function handleLoad(): void {
  libraryVisible.value = true
}

function onLoadLibrary(item: StoredTemplate): void {
  const data = item.data as TemplateSchema
  if (!data || !Array.isArray(data.elements) || !data.page) {
    ElMessage.error('模板数据损坏，无法载入')
    return
  }
  schema.value = sanitizeSchema(data)
  selectedIds.value = []
  libraryVisible.value = false
  ElMessage.success(`已载入模板：${item.name}`)
}

/** 仅查看已保存模板的版式，不覆盖当前编辑 */
const recordPreviewVisible = ref(false)
const recordPreviewData = ref<TemplateSchema | null>(null)
function onPreviewLibrary(item: StoredTemplate): void {
  const data = item.data as TemplateSchema
  if (!data || !Array.isArray(data.elements) || !data.page) {
    ElMessage.error('模板数据损坏，无法预览')
    return
  }
  recordPreviewData.value = data
  recordPreviewVisible.value = true
}

/* ---- 导入 / 导出 ---- */
async function handleCopyJson(): Promise<void> {
  try {
    await navigator.clipboard.writeText(JSON.stringify(schema.value, null, 2))
    ElMessage.success('模板 JSON 已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败，请检查浏览器剪贴板权限')
  }
}

function handleExportJson(): void {
  downloadFile(`${schema.value.name}.template.json`, JSON.stringify(schema.value, null, 2), 'application/json')
}

async function handleConvertFlow(): Promise<void> {
  // 一键把自研模板转成流式（pickup-order 同款格式）：
  // 下载 .flow.json 文件 + 复制到剪贴板，可直接粘贴进流式设计器微调，
  // 或存入 print-kit/templates/（文件名即业务键）供 ERP 使用
  const { tpl, infoCount, columnCount, skipped } = convertDocumentToFlow(schema.value)
  const json = JSON.stringify(tpl, null, 2)
  downloadFile(`${schema.value.name}.flow.json`, json, 'application/json')
  try {
    await navigator.clipboard.writeText(json)
  } catch {
    /* 剪贴板失败不影响下载 */
  }
  ElMessage.success(
    `已转换：信息项 ${infoCount} 个、表格列 ${columnCount} 列` +
      (skipped ? `；跳过 ${skipped} 个不兼容元素（线条/图片等）` : '') +
      '。JSON 已下载并复制，可直接粘贴到「单据（流式 JSON）」继续微调'
  )
}

function handleExportHtml(): void {
  // 导出独立 HTML：内嵌模板 Schema + 填充运行时，
  // 后端返回数据后调用 PrintTemplate.print(data) 即可打印
  const html = buildDocumentHTML(schema.value, {}, { withRuntime: true })
  downloadFile(`${schema.value.name}.html`, html)
}

/**
 * 导出当前模板数据（供 ERP 渲染器 DocumentDoc 使用）：
 * { name, template: TemplateSchema, sampleData }
 * sampleData = 按模板字段生成的 {{字段}} 占位（含表格行）+ 当前测试数据（已有值优先）。
 * 自研模板保留绝对定位坐标，ERP 端渲染版式零损失。
 */
async function handleExportKit(): Promise<void> {
  const payload = {
    name: schema.value.name,
    template: schema.value,
    sampleData: { ...buildDocSampleData(schema.value), ...currentData }
  }
  const text = JSON.stringify(payload, null, 2)
  downloadFile(`${schema.value.name || 'document'}.doc.json`, text, 'application/json')
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('模板数据已导出并复制（template + sampleData，供 ERP 渲染器 DocumentDoc 使用）')
  } catch {
    ElMessage.success('模板数据已导出')
  }
}

/* ---- 渲染器预览（print-kit DocumentDoc，与 ERP 端同源） ---- */
const renderVisible = ref(false)
const renderData = ref<Record<string, unknown>>({})
const renderHost = useTemplateRef<{ $el: HTMLElement } | null>('renderHost')
const { print: printViaKit, printing: renderPrinting } = usePrint()

function openRenderPreview(): void {
  const d = parseData()
  if (!d) return
  currentData = d
  renderData.value = { ...d }
  renderVisible.value = true
}

async function printRenderer(): Promise<void> {
  const el = renderHost.value?.$el
  if (!el) return
  // @page 尺寸/边距由模板驱动，与屏幕预览完全一致
  await printViaKit(el, { copies: 1, extraCss: docPageExtraCss(schema.value.page) })
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
      const parsed = JSON.parse(String(reader.result)) as TemplateSchema
      if (!parsed.elements || !parsed.page) throw new Error('格式不正确')
      schema.value = sanitizeSchema(parsed)
      selectedIds.value = []
      ElMessage.success(`已导入模板：${parsed.name ?? '未命名'}`)
    } catch {
      ElMessage.error('模板 JSON 格式有误')
    }
  }
  reader.readAsText(file)
  input.value = ''
}

function handleReset(): void {
  schema.value = createDefaultSchema()
  selectedIds.value = []
  // 重置后以此为撤销基线，撤销不会回退到旧模板
  resetBaseline()
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* 忽略存储异常 */
  }
  ElMessage.success('已重置为示例模板')
}

/* ---- 自动恢复 / 防抖自动保存 ---- */
let saveTimer = 0

onMounted(() => {
  // 挂载即恢复上次保存的模板，解决"保存后刷新页面丢失"
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return
  try {
    const parsed = JSON.parse(raw) as TemplateSchema
    if (parsed && Array.isArray(parsed.elements) && parsed.page) {
      schema.value = sanitizeSchema(parsed)
      selectedIds.value = []
      // 以恢复后的状态为撤销基线，避免把"自动恢复"当成可撤销操作
      resetBaseline()
    }
  } catch {
    /* 数据损坏则保留默认模板 */
  }
})

// 编辑即存（防抖 600ms），无需手动点保存也不会丢
watch(
  schema,
  (val) => {
    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
      } catch {
        /* 忽略容量超限等异常 */
      }
    }, 600)
  },
  { deep: true }
)

// 页面尺寸变化时，将元素钳制回页面内，避免缩小页面后元素溢出画布
watch(
  () => [schema.value.page.widthMm, schema.value.page.heightMm],
  ([w, h]) => {
    for (const e of schema.value.elements) {
      e.x = Math.max(0, Math.min(e.x, w - e.w))
      e.y = Math.max(0, Math.min(e.y, h - e.h))
    }
  }
)

/* ---- 快捷键：Delete 删除选中元素；Ctrl/Cmd+Z 撤销 ---- */
function onKeydown(e: KeyboardEvent): void {
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return
  if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
    e.preventDefault()
    doUndo()
    return
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.value.length) {
    deleteSelected()
  }
}
window.addEventListener('keydown', onKeydown)
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  window.clearTimeout(saveTimer)
})
</script>

<style scoped>
.document-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.main {
  flex: 1;
  display: flex;
  overflow: hidden;
}
.render-host {
  display: flex;
  justify-content: center;
  overflow: auto;
  max-height: 70vh;
}
.preview-frame {
  width: 100%;
  height: 65vh;
  border: 1px solid #e4e7ed;
  background: #fff;
}
.data-tip { margin-bottom: 12px; }
.data-editor :deep(textarea) { font-family: Consolas, Monaco, monospace; font-size: 12px; }
.hidden-input { display: none; }
</style>
