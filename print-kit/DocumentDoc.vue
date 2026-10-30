<template>
  <div ref="rootRef" class="doc-doc" :style="pageStyle" v-html="html"></div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { __peRuntime } from './document-runtime.js'
import type { DocSchemaLike, DocData, CSSLikeStyle } from './document-schema'

const props = defineProps({
  /** 自研单据模板 JSON（设计器「导出模板数据」的 template 字段） */
  template: { type: Object as () => DocSchemaLike, required: true },
  /** 打印数据（接口返回），{{field}} 占位按此填充 */
  data: { type: Object as () => DocData, default: () => ({}) },
  /** 占位模式：缺失字段显示 {{field}} 本身（预览模板结构用） */
  placeholder: { type: Boolean, default: false }
})

/**
 * 渲染：复用与「导出HTML打印」同一份运行时（document-runtime），数据值已做 HTML 转义，v-html 安全。
 * 渲染后做「锚点跟随」：声明了 anchor(源元素id) 的元素（如表尾）按源元素实际底边 + gapMm 重定位 top，
 * 因此表格内容再多，表尾也始终贴紧表格底部，不会重叠/悬空。
 * 重定位结果是内联样式，usePrint 取 outerHTML 打印时原样保留，屏幕与打印一致。
 */
const rootRef = ref<HTMLElement | null>(null)
const html = computed<string>(() => __peRuntime(props.template, props.data, props.placeholder))

const pageStyle = computed<CSSLikeStyle>(() => ({
  position: 'relative',
  width: `${props.template.page.widthMm}mm`,
  minHeight: `${props.template.page.heightMm}mm`,
  backgroundColor: '#fff',
  boxSizing: 'border-box',
  fontFamily: "'Microsoft YaHei', 'SimSun', 'Segoe UI', sans-serif",
  color: '#000'
}))

const MM_TO_PX = 96 / 25.4

/**
 * 自动锚定兜底：未显式声明 anchor 的元素，若位于某表格下方，则自动跟随
 * 「最近的上方表格」。基于模板坐标计算相对间距，幂等稳定，不依赖已被重定位的 DOM 状态。
 * 效果：导出的模板数据无需任何 anchor 字段，一粘到 ERP 页面即可自动跟随。
 * 手动 anchor 优先级更高（已声明的元素会被跳过）。
 */
function ensureAnchors(): void {
  const root = rootRef.value
  if (!root || !props.template?.elements?.length) return
  const els = props.template.elements
  const tables = els.filter((e) => e && e.type === 'table')
  if (!tables.length) return
  for (const e of els) {
    if (!e || e.type === 'table' || e.anchor) continue
    // 上方最近表格：table.y <= e.y，取 y 最大者
    const cand = tables.filter((t) => (t.y ?? 0) <= (e.y ?? 0) + 0.01)
    if (!cand.length) continue
    const t = cand.reduce((a, b) => ((b.y ?? 0) > (a.y ?? 0) ? b : a))
    const tBottom = (t.y ?? 0) + (t.h || 0)
    if ((e.y ?? 0) < tBottom - 0.01) continue // 不在表格下方，不自动跟随
    const gap = Math.max(0, (e.y ?? 0) - tBottom)
    const el = root.querySelector<HTMLElement>('[data-pe-id="' + CSS.escape(String(e.id)) + '"]')
    if (el && !el.hasAttribute('data-pe-anchor')) {
      el.setAttribute('data-pe-anchor', String(t.id))
      el.setAttribute('data-pe-gap', String(gap))
    }
  }
}

/** 一轮重定位：返回是否有元素 top 发生变化（用于级联稳定判断） */
function repositionOnce(): boolean {
  const root = rootRef.value
  if (!root) return false
  let changed = false
  // 按 DOM 顺序处理：先定位「挂表格」的元素，再定位「挂表尾」的元素，保证级联正确
  const els = Array.from(root.querySelectorAll<HTMLElement>('[data-pe-anchor]'))
  for (const el of els) {
    const srcId = el.getAttribute('data-pe-anchor')
    const gapMm = Number(el.getAttribute('data-pe-gap')) || 4
    if (!srcId) continue
    const src = root.querySelector<HTMLElement>('[data-pe-id="' + CSS.escape(srcId) + '"]')
    if (!src) continue
    // src 是 root 的直接子元素（absolute 定位，offsetParent 即 root），
    // 用 offsetTop/offsetHeight 不受页面缩放 transform 影响
    const topMm = (src.offsetTop + src.offsetHeight) / MM_TO_PX + gapMm
    const next = topMm + 'mm'
    if (el.style.top !== next) {
      el.style.top = next
      changed = true
    }
  }
  return changed
}

function reposition(): void {
  ensureAnchors() // 零配置：表格下方未声明 anchor 的元素自动跟随最近表格
  // 最多 3 轮：处理「表尾跟随表格、落款又跟随表尾」的级联链，直至稳定
  for (let i = 0; i < 3 && repositionOnce(); i++) { /* 稳定即停 */ }
}

function repositionAsync(): void {
  nextTick(reposition)
}

onMounted(() => {
  repositionAsync()
  // 字体加载完成会改变文本实际高度，重算一次
  document.fonts?.ready.then(reposition).catch(() => undefined)
  // 图片加载/内容尺寸变化（如表格撑高）后重算
  if (rootRef.value && 'ResizeObserver' in window) {
    resizeOb.value = new ResizeObserver(reposition)
    resizeOb.value.observe(rootRef.value)
  }
})

const resizeOb = ref<ResizeObserver | null>(null)
onBeforeUnmount(() => {
  resizeOb.value?.disconnect()
  resizeOb.value = null
})

watch(
  () => [props.template, props.data, props.placeholder],
  repositionAsync,
  { deep: true }
)
</script>
