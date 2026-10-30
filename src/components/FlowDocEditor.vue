<template>
  <div class="flow-editor">
    <div class="toolbar">
      <div class="left">
        <span class="logo">流式单据设计器</span>
        <el-input
          :model-value="nameZh"
          class="name-input"
          placeholder="模板名称"
          size="small"
          @update:model-value="setNameZh"
        />
        <el-radio-group v-model="lang" size="small">
          <el-radio-button value="zh">中文</el-radio-button>
          <el-radio-button value="en">English</el-radio-button>
        </el-radio-group>
      </div>
      <div class="right">
        <span class="flag-label">打印模式</span>
        <el-radio-group v-model="flagMode" size="small">
          <el-radio-button value="single">单份</el-radio-button>
          <el-radio-button value="batch">批量</el-radio-button>
        </el-radio-group>
        <span class="flag-label">单据类型</span>
        <el-select v-model="flagShipment" size="small" class="flag-select">
          <el-option label="不限" value="unset" />
          <el-option label="发货单" value="true" />
          <el-option label="备货单" value="false" />
        </el-select>
        <el-divider direction="vertical" />
        <el-button size="small" type="primary" plain @click="saveVisible = true">保存模板</el-button>
        <el-button size="small" @click="libraryVisible = true">模板库</el-button>
        <el-button size="small" @click="loadPreset">恢复拣货单示例</el-button>
        <el-button size="small" @click="triggerImport">导入JSON</el-button>
        <el-button size="small" @click="handleExportJson">导出JSON</el-button>
        <el-button size="small" @click="copyJson">复制JSON</el-button>
        <el-button size="small" @click="pasteJson">粘贴JSON</el-button>
        <el-button size="small" @click="dataVisible = true">测试数据</el-button>
        <el-button size="small" :type="previewOnly ? 'warning' : 'default'" @click="previewOnly = !previewOnly">
          {{ previewOnly ? '返回编辑' : '查看效果' }}
        </el-button>
        <el-button size="small" type="primary" :loading="printing" @click="handlePrint">打印</el-button>
      </div>
    </div>

    <div class="main">
      <!-- 左：结构编辑 -->
      <div v-show="!previewOnly" class="edit-panel">
        <el-collapse v-model="openSections">
          <!-- 基本信息 -->
          <el-collapse-item title="基本信息" name="basic">
            <template v-if="tpl.title">
              <el-form label-position="top" size="small">
                <el-form-item label="标题字段（取打印数据路径）">
                  <el-input v-model="tpl.title.field" placeholder="如 linkOrderCode" />
                </el-form-item>
                <el-form-item label="标题兜底文案">
                  <el-input v-model="tpl.title.fallback" placeholder="空值时显示" />
                </el-form-item>
                <el-form-item label="页面边距 (mm)">
                  <el-input-number
                    :model-value="pageMarginMm"
                    :min="0"
                    :max="50"
                    @update:model-value="(v: number | undefined) => setPageMargin(v ?? 10)"
                  />
                </el-form-item>
              </el-form>
            </template>
          </el-collapse-item>

          <!-- 信息项 -->
          <el-collapse-item name="info">
            <template #title>
              信息项（拖拽排序）
              <el-tag size="small" class="count-tag">{{ infoItems.length }}</el-tag>
            </template>
            <template v-if="tpl.info">
              <div
                v-for="(item, i) in infoRows"
                :key="item.field + i"
                class="item-card"
                draggable="true"
                @dragstart="onDragStart('info', i, $event)"
                @dragover.prevent
                @drop="onDrop('info', i)"
              >
                <div class="item-head">
                  <span class="drag-handle">≡</span>
                  <el-input v-model="item.label.zh" placeholder="标签(中)" size="small" class="w-flex" />
                  <el-input v-model="item.label.en" placeholder="标签(英)" size="small" class="w-flex" />
                  <el-button size="small" type="danger" text @click="removeInfoItem('info', i)">删</el-button>
                </div>
                <div class="item-row">
                  <el-input v-model="item.field" placeholder="字段路径，如 warehouseName" size="small" class="w-flex" />
                  <el-input v-model="item.fallback" placeholder="兜底，如 -" size="small" class="w-sm" />
                  <el-input v-model="item.join" placeholder="数组拼接符" size="small" class="w-sm" />
                </div>
                <div class="item-row">
                  <span class="mini-label">显示条件</span>
                  <el-select :model-value="itemShip(item)" size="small" class="w-sm" @update:model-value="(v: string) => setItemShip(item, v)">
                    <el-option label="总是显示" value="unset" />
                    <el-option label="仅发货单显示" value="true" />
                    <el-option label="仅备货单显示" value="false" />
                  </el-select>
                  <span class="mini-label">布尔转文案</span>
                  <el-switch :model-value="hasBoolean(item)" size="small" @update:model-value="(v: boolean) => setBoolean(item, v)" />
                  <template v-if="item.boolean">
                    <el-input
                      :model-value="yesZh(item)"
                      placeholder="真值(中)"
                      size="small"
                      class="w-sm"
                      @update:model-value="(v: string) => setYesZh(item, v)"
                    />
                    <el-input
                      :model-value="yesEn(item)"
                      placeholder="真值(en)"
                      size="small"
                      class="w-sm"
                      @update:model-value="(v: string) => setYesEn(item, v)"
                    />
                  </template>
                </div>
              </div>
              <el-button size="small" type="primary" plain class="add-btn" @click="addInfoItem('info')">+ 添加信息项</el-button>
            </template>
          </el-collapse-item>

          <!-- 表格下方信息项 -->
          <el-collapse-item name="footer">
            <template #title>
              表格下方信息（拖拽排序）
              <el-tag size="small" class="count-tag">{{ footerItems.length }}</el-tag>
            </template>
            <template v-if="tpl.footer">
              <div
                v-for="(item, i) in footerRows"
                :key="'f' + item.field + i"
                class="item-card"
                draggable="true"
                @dragstart="onDragStart('footer', i, $event)"
                @dragover.prevent
                @drop="onDrop('footer', i)"
              >
                <div class="item-head">
                  <span class="drag-handle">≡</span>
                  <el-input v-model="item.label.zh" placeholder="标签(中)" size="small" class="w-flex" />
                  <el-input v-model="item.label.en" placeholder="标签(英)" size="small" class="w-flex" />
                  <el-button size="small" type="danger" text @click="removeInfoItem('footer', i)">删</el-button>
                </div>
                <div class="item-row">
                  <el-input v-model="item.field" placeholder="字段路径，如 creator" size="small" class="w-flex" />
                  <el-input v-model="item.fallback" placeholder="兜底，如 -" size="small" class="w-sm" />
                  <el-input v-model="item.join" placeholder="数组拼接符" size="small" class="w-sm" />
                </div>
                <div class="item-row">
                  <span class="mini-label">显示条件</span>
                  <el-select :model-value="itemShip(item)" size="small" class="w-sm" @update:model-value="(v: string) => setItemShip(item, v)">
                    <el-option label="总是显示" value="unset" />
                    <el-option label="仅发货单显示" value="true" />
                    <el-option label="仅备货单显示" value="false" />
                  </el-select>
                </div>
              </div>
              <el-button size="small" type="primary" plain class="add-btn" @click="addInfoItem('footer')">+ 添加信息项</el-button>
            </template>
          </el-collapse-item>

          <!-- 表格 -->
          <el-collapse-item name="table">
            <template #title>
              表格列（拖拽排序）
              <el-tag size="small" class="count-tag">{{ currentVariant?.columns.length ?? 0 }}</el-tag>
            </template>
            <template v-if="tpl.table">
              <el-form label-position="top" size="small" class="tbl-form">
                <el-form-item label="数据源字段（行数组路径）">
                  <el-input v-model="tpl.table.srcField" placeholder="如 productDetails" />
                </el-form-item>
                <el-form-item label="表格样式">
                  <div class="style-row">
                    <span class="mini-label">字号(pt)</span>
                    <el-input-number
                      :model-value="tpl.table.style?.fontSize"
                      :min="6"
                      :max="20"
                      :step="0.5"
                      size="small"
                      controls-position="right"
                      class="w-sm"
                      @update:model-value="(v: number | undefined) => setTableFontSize(v)"
                    />
                    <span class="mini-label">表头背景</span>
                    <el-color-picker
                      :model-value="tpl.table.style?.headerBg"
                      size="small"
                      @update:model-value="(v: string | null) => setTableHeaderBg(v)"
                    />
                    <span class="mini-label">边框色</span>
                    <el-color-picker
                      :model-value="tpl.table.style?.borderColor"
                      size="small"
                      @update:model-value="(v: string | null) => setTableBorderColor(v)"
                    />
                  </div>
                </el-form-item>
              </el-form>

              <div class="variant-bar">
                <el-select v-model="variantIdx" size="small" class="w-flex">
                  <el-option
                    v-for="(v, i) in tpl.table.variants"
                    :key="i"
                    :label="variantLabel(v, i)"
                    :value="i"
                  />
                </el-select>
                <el-button size="small" @click="addVariant">+ 变体</el-button>
                <el-button size="small" type="danger" plain :disabled="(tpl.table.variants.length ?? 0) <= 1" @click="removeVariant">删变体</el-button>
              </div>
              <div v-if="currentVariant" class="variant-when">
                <span class="mini-label">命中条件：</span>
                <el-input
                  :model-value="whenMode(currentVariant)"
                  placeholder="打印模式：批量填 batch，留空不限"
                  size="small"
                  class="w-sm"
                  @update:model-value="(v: string) => setVariantWhen(currentVariant!, v, whenShip(currentVariant!))"
                />
                <el-select
                  :model-value="whenShip(currentVariant)"
                  size="small"
                  class="w-sm"
                  @update:model-value="(v: string) => setVariantWhen(currentVariant!, whenMode(currentVariant!), v)"
                >
                  <el-option label="单据类型不限" value="unset" />
                  <el-option label="仅发货单" value="true" />
                  <el-option label="仅备货单" value="false" />
                </el-select>
              </div>

              <template v-if="currentVariant">
                <div
                  v-for="(col, ci) in colRows"
                  :key="col.key + ci"
                  class="item-card"
                  draggable="true"
                  @dragstart="onDragStart('col', ci, $event)"
                  @dragover.prevent
                  @drop="onDrop('col', ci)"
                >
                  <div class="item-head">
                    <span class="drag-handle">≡</span>
                    <el-input v-model="col.label.zh" placeholder="列名(中)" size="small" class="w-flex" />
                    <el-input v-model="col.label.en" placeholder="列名(英)" size="small" class="w-flex" />
                    <el-button size="small" type="danger" text @click="removeColumn(ci)">删</el-button>
                  </div>
                  <div class="item-row">
                    <el-input v-model="col.width" placeholder="宽度 如 12%" size="small" class="w-sm" />
                    <el-select
                      :model-value="col.align ?? 'left'"
                      size="small"
                      class="w-sm"
                      @update:model-value="(v: string) => (col.align = v as Align)"
                    >
                      <el-option label="左对齐" value="left" />
                      <el-option label="居中" value="center" />
                      <el-option label="右对齐" value="right" />
                    </el-select>
                    <el-select
                      :model-value="col.cell.kind"
                      size="small"
                      class="w-sm"
                      @update:model-value="(k: string) => setCellKind(col, k as Cell['kind'])"
                    >
                      <el-option label="普通字段" value="text" />
                      <el-option label="序号" value="serial" />
                      <el-option label="图片" value="image" />
                      <el-option label="多行堆叠" value="stack" />
                      <el-option label="子列表" value="list" />
                    </el-select>
                    <template v-if="col.cell.kind === 'text' || col.cell.kind === 'image'">
                      <el-input v-model="col.cell.field" placeholder="字段" size="small" class="w-flex" />
                    </template>
                    <template v-if="col.cell.kind === 'text'">
                      <el-input v-model="col.cell.fallback" placeholder="兜底" size="small" class="w-sm" />
                    </template>
                    <template v-if="col.cell.kind === 'list'">
                      <el-input v-model="col.cell.listField" placeholder="子列表字段" size="small" class="w-flex" />
                    </template>
                  </div>

                  <!-- 多行/子列表 的行编辑 -->
                  <template v-if="col.cell.kind === 'stack' || col.cell.kind === 'list'">
                    <div v-for="(ln, li) in cellLines(col.cell)" :key="li" class="line-row">
                      <el-select
                        :model-value="lineMode(ln)"
                        size="small"
                        class="w-sm"
                        @update:model-value="(m: string) => setLineMode(ln, m)"
                      >
                        <el-option label="取字段" value="field" />
                        <el-option label="插值文本" value="text" />
                      </el-select>
                      <el-input v-if="ln.text == null" v-model="ln.field" placeholder="字段" size="small" class="w-flex" />
                      <el-input v-else v-model="ln.text" placeholder="{a} ({b})" size="small" class="w-flex" />
                      <el-input
                        :model-value="lineLabel(ln, 'zh')"
                        placeholder="行首标签(中)"
                        size="small"
                        class="w-sm"
                        @update:model-value="(v: string) => setLineLabel(ln, 'zh', v)"
                      />
                      <el-input
                        :model-value="lineLabel(ln, 'en')"
                        placeholder="标签(en)"
                        size="small"
                        class="w-sm"
                        @update:model-value="(v: string) => setLineLabel(ln, 'en', v)"
                      />
                      <el-checkbox
                        :model-value="ln.small === true"
                        size="small"
                        @update:model-value="(v: boolean) => (ln.small = v)"
                      >小字</el-checkbox>
                      <el-button size="small" type="danger" text @click="removeLine(col.cell, li)">删</el-button>
                    </div>
                    <el-button size="small" text type="primary" @click="addLine(col.cell)">+ 添加行</el-button>
                  </template>
                </div>
                <el-button size="small" type="primary" plain class="add-btn" @click="addColumn">+ 添加列</el-button>
              </template>
            </template>
          </el-collapse-item>
        </el-collapse>
      </div>

      <!-- 右：实时预览（PrintDoc 渲染，与 ERP 端完全同源） -->
      <div class="preview-pane">
        <div class="paper">
          <div ref="printHost" class="print-host">
            <PrintDoc :template="tpl" :data="previewData" :lang="lang" :flags="flags" />
          </div>
        </div>
      </div>
    </div>

    <!-- 测试数据 -->
    <el-dialog v-model="dataVisible" title="测试打印数据（JSON）" width="760px" destroy-on-close>
      <el-input v-model="dataJson" type="textarea" :rows="18" spellcheck="false" />
      <template #footer>
        <el-button @click="dataVisible = false">取消</el-button>
        <el-button type="primary" @click="applyData">应用</el-button>
      </template>
    </el-dialog>

    <input ref="fileInputRef" type="file" accept="application/json,.json" class="hidden-input" @change="onFileChosen" />

    <!-- 保存：命名弹窗 -->
    <TemplateSaveDialog v-model="saveVisible" :initial-name="nameZh" @save="onConfirmSave" />
    <!-- 模板库：载入/删除（流式暂未放开「查看」：PrintDoc 对序列化模板渲染有既有健壮性缺陷，待单独修复） -->
    <TemplateLibraryDialog v-model="libraryVisible" kind="flow" @load="onLoadLibrary" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'
import { ElMessage } from 'element-plus'
import PrintDoc from '../../print-kit/PrintDoc.vue'
import { usePrint } from '../../print-kit/usePrint'
import { loadTemplate } from '../../print-kit/templateLoader'
import { downloadFile } from '../core/renderer'
import { saveTemplate } from '../core/templateLibrary'
import type { StoredTemplate } from '../core/templateLibrary'
import { convertDocumentToFlow } from '../core/convertToFlow'
import { buildSampleData } from '../../print-kit/print-schema'
import type { TemplateSchema } from '../types/template'
import TemplateSaveDialog from './TemplateSaveDialog.vue'
import TemplateLibraryDialog from './TemplateLibraryDialog.vue'
import type {
  Align,
  Cell,
  Condition,
  I18nText,
  InfoItem,
  Lang,
  PrintFlags,
  PrintTemplate,
  StackLine,
  TableColumnDef,
  TableVariant
} from '../../print-kit/print-schema'

/* ---------------- 状态 ---------------- */
const tpl = ref<PrintTemplate>({ name: { zh: '未命名模板' } })
const lang = ref<Lang>('zh')
const flagMode = ref<'single' | 'batch'>('single')
const flagShipment = ref<'unset' | 'true' | 'false'>('true')
const variantIdx = ref(0)
const dataVisible = ref(false)
const previewOnly = ref(false)
const openSections = ref(['basic', 'info', 'footer', 'table'])
const fileInputRef = useTemplateRef<HTMLInputElement>('fileInputRef')
const printHost = useTemplateRef<HTMLElement>('printHost')
const { print, printing } = usePrint()

const sampleData: Record<string, unknown> = {
  linkOrderCode: 'FBDC011160',
  warehouseName: '供应商维修仓',
  destWarehouseName: '维修良品仓',
  outStoreTypeDesc: '标准分步式调出单',
  transportModeName: '物流配送',
  logisticsProviderName: '顺丰速运',
  logisticsChannelName: '顺丰标快',
  outStoreOrderCode: 'CK202610270001',
  shipmentNumber: 'SH-2026-001',
  printTime: '2026-10-27 10:00:00',
  linkOrderCreateName: '张三',
  operationLabelRequirement: ['FBA箱贴', 'Components标'],
  logisticsLabelChange: true,
  remark: '易碎品，轻拿轻放',
  productDetails: [
    {
      imageUrl: 'https://dummyimage.com/60x60',
      productSkuName: '双肩包 K7J30006 WYT16',
      productSkuCode: 'CMNWCAO0OBCN3260',
      shopName: 'US-Store',
      fnsku: 'X00ABC12345',
      msku: 'MK-001',
      asin: 'B0ABCDE12',
      outStockQty: 10,
      packingQuantity: 10,
      skuItemList: [
        { thirdSkuCode: 'T-SKU-001', thirdSkuName: '三方品名A', thirdSkuId: '1001' }
      ],
      goodWarehousePositions: [
        { warehousePositionName: 'A-01-01', qty: 6 },
        { warehousePositionName: 'A-01-02', qty: 4 }
      ]
    },
    {
      productSkuName: '机械键盘 KX8200',
      productSkuCode: 'CMNWCAO0OBCN3261',
      outStockQty: 2,
      packingQuantity: 2,
      goodWarehousePositions: [{ warehousePositionName: 'B-02-01', qty: 2 }]
    }
  ]
}
const dataJson = ref(JSON.stringify(sampleData, null, 2))
const previewData = ref<Record<string, unknown>>(sampleData)

// 模板变化时，把模板字段自动补进测试数据（值显示为 {{字段}} 占位，便于对照），
// 已有的自定义测试数据优先；6 行与自研画布默认预览行数一致
watch(tpl, () => {
  previewData.value = { ...buildSampleData(tpl.value, 6), ...previewData.value }
}, { deep: true })

/* ---------------- 初始化 ---------------- */
/** 把字符串简写文案统一为对象，便于编辑器双向绑定 */
function normalizeI18n(x: I18nText | undefined): { zh: string; en?: string } {
  return typeof x === 'string' ? { zh: x } : x ?? { zh: '' }
}
function normalizeTpl(t: PrintTemplate): void {
  if (!t.name) t.name = { zh: '未命名模板' }
  else t.name = normalizeI18n(t.name)
  if (!t.title) t.title = { field: '' }
  if (!t.info) t.info = { columns: 3, items: [] }
  else for (const it of t.info.items) it.label = normalizeI18n(it.label)
  if (!t.footer) t.footer = { columns: 3, items: [] }
  else for (const it of t.footer.items) it.label = normalizeI18n(it.label)
  if (!t.table) t.table = { srcField: 'details', variants: [{ when: null, columns: [] }] }
  if (!t.table.style) t.table.style = {}
  for (const v of t.table.variants) {
    for (const c of v.columns) c.label = normalizeI18n(c.label)
  }
  variantIdx.value = Math.max(0, t.table.variants.length - 1)
}
normalizeTpl(tpl.value)

// 挂载后从模板注册表加载示例（与 ERP 端取模板方式同源）
onMounted(async () => {
  try {
    tpl.value = await loadTemplate('pickup-order')
    normalizeTpl(tpl.value)
  } catch (err) {
    console.warn('[FlowDocEditor] 示例模板加载失败:', err)
  }
})

/* ---------------- 编辑视图（label 统一为对象，规避 I18nText 联合类型在模板中无法窄化） ---------------- */
type ObjInfoItem = Omit<InfoItem, 'label'> & { label: { zh: string; en?: string } }
type ObjCol = Omit<TableColumnDef, 'label'> & { label: { zh: string; en?: string } }

const infoRows = computed<ObjInfoItem[]>(() => (tpl.value.info?.items ?? []) as ObjInfoItem[])
const footerRows = computed<ObjInfoItem[]>(() => (tpl.value.footer?.items ?? []) as ObjInfoItem[])
const colRows = computed<ObjCol[]>(() => (currentVariant.value?.columns ?? []) as ObjCol[])

const nameZh = computed(() => (typeof tpl.value.name === 'string' ? tpl.value.name : tpl.value.name?.zh ?? ''))
function setNameZh(v: string): void {
  const base =
    typeof tpl.value.name === 'string'
      ? { zh: tpl.value.name }
      : { zh: tpl.value.name?.zh ?? '', en: tpl.value.name?.en }
  base.zh = v
  tpl.value.name = base
}

/* ---------------- 预览 ---------------- */
const pageMarginMm = computed<number>(() => {
  const m = parseFloat(tpl.value.page?.margin ?? '10')
  return Number.isFinite(m) ? m : 10
})
function setPageMargin(v: number): void {
  tpl.value.page = { ...(tpl.value.page ?? {}), margin: `${v}mm` }
}

const flags = computed<PrintFlags>(() => {
  const f: PrintFlags = { printMode: flagMode.value }
  if (flagShipment.value !== 'unset') f.isShipment = flagShipment.value === 'true'
  return f
})
const infoItems = computed<InfoItem[]>(() => tpl.value.info?.items ?? [])
const footerItems = computed<InfoItem[]>(() => tpl.value.footer?.items ?? [])
const currentVariant = computed<TableVariant | null>(() => {
  const vs = tpl.value.table?.variants ?? []
  if (!vs.length) return null
  return vs[Math.min(variantIdx.value, vs.length - 1)] ?? null
})

/* ---------------- 拖拽排序 ---------------- */
type DragList = 'info' | 'footer' | 'col'
const dragFrom = ref<{ list: DragList; index: number } | null>(null)
function onDragStart(list: DragList, index: number, evt: DragEvent): void {
  dragFrom.value = { list, index }
  evt.dataTransfer?.setData('text/plain', String(index))
  if (evt.dataTransfer) evt.dataTransfer.effectAllowed = 'move'
}
function onDrop(list: DragList, index: number): void {
  const from = dragFrom.value
  dragFrom.value = null
  if (!from || from.list !== list || from.index === index) return
  if (list === 'info' || list === 'footer') {
    const arr = list === 'info' ? tpl.value.info?.items : tpl.value.footer?.items
    if (!arr) return
    const [moved] = arr.splice(from.index, 1)
    if (moved) arr.splice(index, 0, moved)
  } else {
    const arr = currentVariant.value?.columns
    if (!arr) return
    const [moved] = arr.splice(from.index, 1)
    if (moved) arr.splice(index, 0, moved)
  }
}

/* ---------------- 信息项编辑（info = 表格上方，footer = 表格下方） ---------------- */
function addInfoItem(list: 'info' | 'footer'): void {
  const target = list === 'info' ? tpl.value.info : tpl.value.footer
  target?.items.push({ label: { zh: '新字段：', en: 'New Field:' }, field: '' })
}
function removeInfoItem(list: 'info' | 'footer', i: number): void {
  const target = list === 'info' ? tpl.value.info : tpl.value.footer
  target?.items.splice(i, 1)
}
function itemShip(item: InfoItem): string {
  const w = item.visibleWhen
  if (w?.isShipment === true) return 'true'
  if (w?.isShipment === false) return 'false'
  return 'unset'
}
function setItemShip(item: InfoItem, val: string): void {
  if (val === 'true') item.visibleWhen = { isShipment: true }
  else if (val === 'false') item.visibleWhen = { isShipment: false }
  else item.visibleWhen = null
}
function hasBoolean(item: InfoItem): boolean {
  return !!item.boolean
}
function setBoolean(item: InfoItem, on: boolean): void {
  if (on) item.boolean = { yes: { zh: '是', en: 'Yes' } }
  else delete item.boolean
}
function yesZh(item: InfoItem): string {
  const y = item.boolean?.yes
  return typeof y === 'string' ? y : y?.zh ?? ''
}
function setYesZh(item: InfoItem, v: string): void {
  const b = item.boolean
  if (!b) return
  b.yes = typeof b.yes === 'string' ? { zh: v } : { zh: v, en: b.yes.en ?? '' }
}
function yesEn(item: InfoItem): string {
  return typeof item.boolean?.yes === 'object' ? item.boolean.yes.en ?? '' : ''
}
function setYesEn(item: InfoItem, v: string): void {
  const b = item.boolean
  if (!b) return
  b.yes = typeof b.yes === 'string' ? { zh: b.yes, en: v } : { zh: b.yes.zh, en: v }
}

/* ---------------- 变体编辑 ---------------- */
/** 表格样式编辑：不直接 v-model（style 可能为 undefined），统一走更新函数 */
function setTableFontSize(v: number | undefined): void {
  if (!tpl.value.table) return
  tpl.value.table.style = { ...tpl.value.table.style, fontSize: v }
}
function setTableHeaderBg(v: string | null): void {
  if (!tpl.value.table) return
  tpl.value.table.style = { ...tpl.value.table.style, headerBg: v ?? undefined }
}
function setTableBorderColor(v: string | null): void {
  if (!tpl.value.table) return
  tpl.value.table.style = { ...tpl.value.table.style, borderColor: v ?? undefined }
}

function addVariant(): void {
  if (!tpl.value.table) return
  tpl.value.table.variants.push({ when: null, columns: [] })
  variantIdx.value = tpl.value.table.variants.length - 1
}
function removeVariant(): void {
  const vs = tpl.value.table?.variants
  if (!vs || vs.length <= 1) return
  vs.splice(Math.min(variantIdx.value, vs.length - 1), 1)
  variantIdx.value = Math.max(0, variantIdx.value - 1)
}
function whenMode(v: TableVariant): string {
  const w = v.when
  return w && typeof w.printMode === 'string' ? w.printMode : ''
}
function whenShip(v: TableVariant): string {
  const w = v.when
  if (w?.isShipment === true) return 'true'
  if (w?.isShipment === false) return 'false'
  return 'unset'
}
function setVariantWhen(v: TableVariant, mode: string, ship: string): void {
  const w: Condition = {}
  if (mode) w.printMode = mode
  if (ship === 'true') w.isShipment = true
  else if (ship === 'false') w.isShipment = false
  v.when = Object.keys(w).length ? w : null
}
function variantLabel(v: TableVariant, i: number): string {
  const parts: string[] = []
  const m = whenMode(v)
  const s = whenShip(v)
  if (m) parts.push(`打印模式=${m === 'batch' ? '批量' : m === 'single' ? '单份' : m}`)
  if (s === 'true') parts.push('单据类型=发货单')
  else if (s === 'false') parts.push('单据类型=备货单')
  return `变体${i + 1}${parts.length ? '：' + parts.join('、') : '（兜底）'}`
}

/* ---------------- 列编辑 ---------------- */
let seq = 0
function addColumn(): void {
  const v = currentVariant.value
  if (!v) return
  seq += 1
  v.columns.push({
    key: `col_${seq}`,
    label: { zh: '新列', en: 'New Col' },
    width: '10%',
    cell: { kind: 'text', field: '' }
  })
}
function removeColumn(i: number): void {
  currentVariant.value?.columns.splice(i, 1)
}
function setCellKind(col: TableColumnDef, kind: Cell['kind']): void {
  if (kind === 'text') col.cell = { kind: 'text', field: '', fallback: '' }
  else if (kind === 'serial') col.cell = { kind: 'serial' }
  else if (kind === 'image') col.cell = { kind: 'image', field: '' }
  else if (kind === 'stack') col.cell = { kind: 'stack', lines: [] }
  else col.cell = { kind: 'list', listField: '', lines: [] }
}
function cellLines(cell: Cell): StackLine[] {
  return cell.kind === 'stack' || cell.kind === 'list' ? cell.lines : []
}
function addLine(cell: Cell): void {
  if (cell.kind === 'stack' || cell.kind === 'list') cell.lines.push({ field: '' })
}
function removeLine(cell: Cell, i: number): void {
  if (cell.kind === 'stack' || cell.kind === 'list') cell.lines.splice(i, 1)
}
function lineMode(ln: StackLine): string {
  return ln.text != null ? 'text' : 'field'
}
function setLineMode(ln: StackLine, m: string): void {
  if (m === 'text') {
    ln.text = ''
    delete ln.field
  } else {
    ln.field = ''
    delete ln.text
  }
}
function lineLabel(ln: StackLine, l: Lang): string {
  if (!ln.label) return ''
  return typeof ln.label === 'string' ? ln.label : ln.label[l] ?? ''
}
function setLineLabel(ln: StackLine, l: Lang, val: string): void {
  const base: { zh: string; en?: string } =
    typeof ln.label === 'string' ? { zh: ln.label } : { zh: ln.label?.zh ?? '', en: ln.label?.en }
  if (l === 'zh') base.zh = val
  else base.en = val
  if (!base.zh && !base.en) delete ln.label
  else ln.label = base
}

/* ---------------- 导入 / 导出 / 打印 ---------------- */
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
      applyTemplateJson(JSON.parse(String(reader.result)))
    } catch {
      ElMessage.error('模板 JSON 格式有误')
    }
  }
  reader.readAsText(file)
  input.value = ''
}
function handleExportJson(): void {
  const name = typeof tpl.value.name === 'string' ? tpl.value.name : tpl.value.name?.zh || 'template'
  downloadFile(`${name}.template.json`, JSON.stringify(tpl.value, null, 2), 'application/json')
}
async function copyJson(): Promise<void> {
  try {
    await navigator.clipboard.writeText(JSON.stringify(tpl.value, null, 2))
    ElMessage.success('模板 JSON 已复制，可直接粘贴到模板库或后端')
  } catch {
    ElMessage.error('复制失败，请使用导出 JSON')
  }
}
/** 应用模板 JSON：自动识别自研单据模板并转换为流式模板 */
function applyTemplateJson(parsed: unknown): void {
  const obj = parsed as Record<string, unknown> | null
  if (obj && Array.isArray(obj.elements)) {
    const { tpl: converted, infoCount, columnCount, skipped } = convertDocumentToFlow(obj as unknown as TemplateSchema)
    tpl.value = converted
    normalizeTpl(tpl.value)
    ElMessage.success(
      `已识别自研单据模板并转换：信息项 ${infoCount} 个、表格列 ${columnCount} 列` +
        (skipped ? `；跳过不兼容元素 ${skipped} 个（线条/图片等）` : '')
    )
    return
  }
  const t = parsed as PrintTemplate
  if (!t.info && !t.table) throw new Error('格式不正确')
  tpl.value = t
  normalizeTpl(tpl.value)
  ElMessage.success('模板 JSON 已应用')
}

async function pasteJson(): Promise<void> {
  try {
    const text = await navigator.clipboard.readText()
    if (!text) {
      ElMessage.warning('剪贴板为空')
      return
    }
    applyTemplateJson(JSON.parse(text))
  } catch {
    ElMessage.error('剪贴板内容不是有效的模板 JSON')
  }
}
async function loadPreset(): Promise<void> {
  try {
    tpl.value = await loadTemplate('pickup-order')
    normalizeTpl(tpl.value)
    ElMessage.success('已载入拣货单示例模板')
  } catch {
    ElMessage.error('示例模板加载失败')
  }
}
function applyData(): void {
  try {
    previewData.value = JSON.parse(dataJson.value) as Record<string, unknown>
    dataVisible.value = false
    ElMessage.success('测试数据已应用')
  } catch {
    ElMessage.error('JSON 解析失败，请检查格式')
  }
}
async function handlePrint(): Promise<void> {
  if (!printHost.value) return
  // @page 边距归零：页边距由 PrintDoc 内联 padding（tpl.page.margin）统一提供，屏幕预览与打印一致
  await print(printHost.value, { copies: 1, extraCss: '@page { margin: 0 }' })
}

/* ---------------- 模板库 ---------------- */
const saveVisible = ref(false)
const libraryVisible = ref(false)

function onConfirmSave(name: string): void {
  setNameZh(name)
  try {
    const { updated } = saveTemplate('flow', name, tpl.value)
    ElMessage.success(updated ? `模板「${name}」已更新` : `模板「${name}」已保存到模板库`)
  } catch {
    ElMessage.error('保存失败，请重试')
  }
}

function onLoadLibrary(item: StoredTemplate): void {
  tpl.value = JSON.parse(JSON.stringify(item.data)) as PrintTemplate
  normalizeTpl(tpl.value)
  libraryVisible.value = false
  ElMessage.success(`已载入模板：${item.name}`)
}
</script>

<style scoped>
.flow-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.toolbar {
  height: 50px;
  flex-shrink: 0;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
}
.left { display: flex; align-items: center; gap: 12px; }
.logo { font-weight: bold; font-size: 15px; }
.name-input { width: 160px; }
.right { display: flex; align-items: center; gap: 6px; flex-wrap: nowrap; }
.flag-label { font-size: 12px; color: #909399; }
.flag-select { width: 96px; }

.main {
  flex: 1;
  display: flex;
  overflow: hidden;
}
.edit-panel {
  width: 500px;
  flex-shrink: 0;
  background: #fff;
  border-right: 1px solid #e4e7ed;
  overflow-y: auto;
  padding: 10px 12px;
}
.preview-pane {
  flex: 1;
  overflow: auto;
  background: #f0f2f5;
  padding: 24px 0;
}
.paper {
  width: 210mm;
  min-height: 297mm;
  margin: 0 auto;
  background: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  /* 内容边距由 PrintDoc 内联 padding（tpl.page.margin）提供，此处归零保证所见即所得 */
  padding: 0;
  box-sizing: border-box;
}
.print-host { min-height: 100%; }

.item-card {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 8px;
  margin-bottom: 8px;
  background: #fafafa;
  cursor: grab;
}
.item-card:active { cursor: grabbing; }
.item-head { display: flex; align-items: center; gap: 4px; margin-bottom: 6px; }
.item-row { display: flex; align-items: center; gap: 4px; margin-bottom: 4px; flex-wrap: wrap; }
.line-row { display: flex; align-items: center; gap: 4px; margin: 4px 0; flex-wrap: wrap; }
.drag-handle { color: #c0c4cc; font-size: 14px; user-select: none; }
.w-flex { flex: 1; min-width: 0; }
.w-sm { flex: 0 0 118px; min-width: 0; }
.mini-label { font-size: 12px; color: #909399; white-space: nowrap; }
.add-btn { width: 100%; }
.count-tag { margin-left: 6px; }
.variant-bar { display: flex; gap: 6px; margin-bottom: 6px; }
.variant-when { display: flex; align-items: center; gap: 6px; margin-bottom: 8px; flex-wrap: wrap; }
.tbl-form :deep(.el-form-item) { margin-bottom: 8px; }
.style-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; width: 100%; }
.hidden-input { display: none; }
</style>
