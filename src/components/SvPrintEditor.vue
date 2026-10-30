<template>
  <div class="svp-editor">
    <div class="svp-bar">
      <span class="svp-title">A4 单据设计器（sv-print）</span>
      <div class="svp-actions">
        <el-button :disabled="!designerUtils" @click="handleNewTemplate">新建模板</el-button>
        <el-button :disabled="!designerUtils" @click="handleSaveTemplate">保存模板</el-button>
        <el-button :disabled="!designerUtils" @click="loadVisible = true">加载模板</el-button>
        <el-button :disabled="!designerUtils" @click="dataVisible = true">编辑打印数据</el-button>
        <el-button :disabled="!printTemplate" type="primary" @click="handlePreview">预览</el-button>
        <el-button :disabled="!printTemplate" type="success" @click="handlePrint">打印</el-button>
        <el-button :disabled="!printTemplate" @click="handleExportPdf">导出 PDF</el-button>
      </div>
    </div>

    <div class="svp-canvas">
      <Designer
        :template="template"
        :print-data="printData"
        :title="title"
        :auth-key="authKey"
        @onDesigned="onDesigned"
      />
    </div>

    <!-- 加载模板 JSON -->
    <el-dialog v-model="loadVisible" title="加载模板（JSON 字符串）" width="720px" destroy-on-close>
      <el-input v-model="loadJson" type="textarea" :rows="16" spellcheck="false" placeholder="粘贴从「保存模板」得到的 JSON" />
      <template #footer>
        <el-button @click="loadVisible = false">取消</el-button>
        <el-button type="primary" @click="applyLoadedTemplate">应用</el-button>
      </template>
    </el-dialog>

    <!-- 编辑打印数据 -->
    <el-dialog v-model="dataVisible" title="打印数据（JSON）—— 模拟后端返回" width="720px" destroy-on-close>
      <el-alert type="info" :closable="false" show-icon class="svp-tip"
        title="字段路径需与模板拖入的元素 field 一致；表格元素绑定数组字段即可自动循环" />
      <el-input v-model="dataJson" type="textarea" :rows="16" spellcheck="false" />
      <template #footer>
        <el-button @click="resetData">恢复示例数据</el-button>
        <el-button @click="dataVisible = false">取消</el-button>
        <el-button type="primary" @click="applyData">应用</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, shallowRef, onBeforeUnmount } from 'vue'
import { Designer } from '@sv-print/vue3'
import { ElMessage } from 'element-plus'

interface PrintTemplateLike {
  print: (data: unknown, options?: Record<string, unknown>, ext?: Record<string, unknown>) => void
  getHtml: (data: unknown) => string
  toPdf: (data: unknown, options?: Record<string, unknown>) => Promise<unknown>
  toImage: (data: unknown, options?: Record<string, unknown>) => Promise<unknown>
}

interface DesignerUtilsLike {
  printTemplate: PrintTemplateLike
  setPrintData: (data: unknown) => void
  newTemplate: () => void
  export: () => void
  save: () => void
}

interface DesignedDetail {
  hiprint: unknown
  designerUtils: DesignerUtilsLike
}

const template = ref<Record<string, unknown>>({})
const printData = ref<Record<string, unknown> | Record<string, unknown>[]>({})
const title = ref('A4 单据模板')

// 付费授权 key（文档标注 2k/永久）。留空在开发环境通常可正常使用，正式环境填入你的 authKey。
const authKey = ref('')

const designerUtils = shallowRef<DesignerUtilsLike | null>(null)
const printTemplate = shallowRef<PrintTemplateLike | null>(null)

const loadVisible = ref(false)
const loadJson = ref('')
const dataVisible = ref(false)
const dataJson = ref('')

const sampleData: Record<string, unknown> = {
  orgName: '示例库存组织',
  billNo: 'DB-2026-0001',
  billDate: '2026-10-27',
  details: [
    { name: '物料A', spec: '规格A', qty: 10, price: 5.0, amount: 50.0 },
    { name: '物料B', spec: '规格B', qty: 20, price: 3.5, amount: 70.0 }
  ],
  creator: '张三',
  auditor: '李四'
}

dataJson.value = JSON.stringify(sampleData, null, 2)

function onDesigned(event: { detail: DesignedDetail }): void {
  const utils = event.detail.designerUtils
  designerUtils.value = utils
  printTemplate.value = utils.printTemplate
}

function handleNewTemplate(): void {
  designerUtils.value?.newTemplate()
}

function handleSaveTemplate(): void {
  // 调起设计器内置的保存/导出 JSON 能力
  designerUtils.value?.save()
}

function applyLoadedTemplate(): void {
  try {
    const json = JSON.parse(loadJson.value) as Record<string, unknown>
    template.value = json
    loadVisible.value = false
    ElMessage.success('模板已加载，刷新设计器生效')
  } catch {
    ElMessage.error('JSON 解析失败，请检查格式')
  }
}

function applyData(): void {
  try {
    printData.value = JSON.parse(dataJson.value) as Record<string, unknown>
    designerUtils.value?.setPrintData(printData.value)
    dataVisible.value = false
    ElMessage.success('打印数据已应用')
  } catch {
    ElMessage.error('JSON 解析失败，请检查格式')
  }
}

function resetData(): void {
  dataJson.value = JSON.stringify(sampleData, null, 2)
}

function handlePreview(): void {
  // 设计器内置预览弹窗（含打印/导出）
  designerUtils.value?.export()
}

async function handlePrint(): Promise<void> {
  const tpl = printTemplate.value
  if (!tpl) return
  try {
    tpl.print(printData.value)
  } catch (err) {
    ElMessage.error(`打印失败：${(err as Error).message}`)
  }
}

async function handleExportPdf(): Promise<void> {
  const tpl = printTemplate.value
  if (!tpl) return
  try {
    await tpl.toPdf(printData.value, { isDownload: true, name: title.value })
    ElMessage.success('PDF 已生成')
  } catch (err) {
    ElMessage.error(`导出失败：${(err as Error).message}`)
  }
}

onBeforeUnmount(() => {
  designerUtils.value = null
  printTemplate.value = null
})
</script>

<style scoped>
.svp-editor {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.svp-bar {
  height: 48px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
}
.svp-title { font-weight: bold; font-size: 15px; }
.svp-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.svp-canvas {
  flex: 1;
  min-height: 0;
  position: relative;
}
.svp-tip { margin-bottom: 12px; }
</style>
