<template>
  <div class="label-doc" :style="pageStyle">
    <template v-for="el in items" :key="el.id">
      <!-- 文本 -->
      <div v-if="el.type === 'text'" :style="boxStyle(el)">
        <div :style="textInnerStyle(el)">{{ elementValue(el, data) }}</div>
      </div>

      <!-- 图片 -->
      <img
        v-else-if="el.type === 'image' && imageSrcOf(el)"
        :src="imageSrcOf(el)"
        alt=""
        :style="boxStyle(el)"
      />

      <!-- 矩形框 -->
      <div v-else-if="el.type === 'rect'" :style="boxStyle(el)"></div>

      <!-- 分隔线 -->
      <div
        v-else-if="el.type === 'line'"
        :style="{ ...boxStyle(el), height: '0', borderTop: lineBorder(el) }"
      ></div>

      <!-- 二维码（SVG 拉伸填满，与设计器渲染一致） -->
      <div v-else-if="el.type === 'qrcode'" :style="{ ...boxStyle(el), overflow: 'hidden' }" :ref="setCodeRef(el.id)"></div>

      <!-- 条码 -->
      <div v-else-if="el.type === 'barcode'" :style="{ ...boxStyle(el), display: 'flex', alignItems: 'center', justifyContent: 'center' }">
        <svg :ref="setCodeRef(el.id)" class="code-svg"></svg>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, watch } from 'vue'
import QRCode from 'qrcode'
import JsBarcode from 'jsbarcode'
import { elementValue, codeValue, safeUrl, readPath } from './label-schema'
import type {
  LabelDocument,
  LabelData,
  LabelElement,
  LabelElementStyle,
  CSSLikeStyle
} from './label-schema'

const props = defineProps({
  /** 标签模板 JSON（设计器「导出模板数据」的 template 字段） */
  template: { type: Object as () => LabelDocument, required: true },
  /** 打印数据（接口返回） */
  data: { type: Object as () => LabelData, default: () => ({}) },
  /**
   * 业务勾选的可见元素 id 列表（打印环节临时决定展示哪些元素）。
   * - 不传 / undefined：展示模板全部非隐藏元素（兼容 ERP 端无需勾选的场景）
   * - 传数组：仅展示数组内的元素（未勾选的既不渲染也不打印，DOM 中不存在）
   */
  visibleIds: { type: Array as () => string[], required: false, default: undefined }
})

/* ---------------- 页面 ---------------- */
const page = computed(() => props.template.page)
const items = computed<LabelElement[]>(() =>
  (page.value?.items ?? []).filter(
    (el) => !el.hidden && el.style && (props.visibleIds == null || props.visibleIds.includes(el.id))
  )
)

const pageStyle = computed<CSSLikeStyle>(() => ({
  position: 'relative',
  width: `${page.value.width}px`,
  height: `${page.value.height}px`,
  backgroundColor: page.value.backgroundColor || '#fff',
  overflow: 'hidden',
  boxSizing: 'border-box',
  fontFamily: "'Microsoft YaHei', 'SimSun', 'Segoe UI', sans-serif",
  color: '#000'
}))

/* ---------------- 元素样式 ---------------- */
function boxStyle(el: LabelElement): CSSLikeStyle {
  const s: LabelElementStyle = el.style
  const css: CSSLikeStyle = {
    position: 'absolute',
    left: `${s.left}px`,
    top: `${s.top}px`,
    width: `${s.width}px`,
    height: `${s.height}px`,
    boxSizing: 'border-box'
  }
  if (s.rotate) css.transform = `rotate(${s.rotate}deg)`
  if (s.backgroundColor) css.backgroundColor = s.backgroundColor
  if (s.borderWidth && s.borderWidth > 0) {
    css.border = `${s.borderWidth}px ${s.borderStyle || 'solid'} ${s.borderColor || '#000'}`
  }
  if (s.borderRadius) css.borderRadius = `${s.borderRadius}px`
  return css
}

/** textWrapMode → CSS 映射（与设计器 print-canvas-designer 的 Rf 语义一致） */
function wrapStyle(mode: string | undefined): CSSLikeStyle {
  if (mode === 'nowrap') {
    return { whiteSpace: 'nowrap', textOverflow: 'clip', wordBreak: 'normal', overflowWrap: 'normal' }
  }
  if (mode === 'ellipsis') {
    return { whiteSpace: 'nowrap', textOverflow: 'ellipsis', wordBreak: 'normal', overflowWrap: 'normal' }
  }
  // wrap / clip
  return { whiteSpace: 'pre-wrap', textOverflow: 'clip', wordBreak: 'break-word', overflowWrap: 'anywhere' }
}

/**
 * 文本内层样式（与设计器 CanvasTextElement 的样式生成完全同构）：
 * flex 横向布局 + textAlign/justifyContent/alignItems 直接透传，保证画布与渲染逐像素一致。
 */
function textInnerStyle(el: LabelElement): CSSLikeStyle {
  const s = el.style
  const m = wrapStyle(s.textWrapMode || 'wrap')
  return {
    width: '100%',
    height: '100%',
    display: 'flex',
    justifyContent: s.justifyContent,
    alignItems: s.alignItems,
    color: s.color,
    fontSize: `${s.fontSize ?? 12}px`,
    fontWeight: s.fontWeight ?? 400,
    fontStyle: s.fontStyle,
    textDecoration: s.textDecoration,
    textAlign: s.textAlign,
    whiteSpace: m.whiteSpace,
    textOverflow: m.textOverflow,
    wordBreak: m.wordBreak,
    overflowWrap: m.overflowWrap,
    lineHeight: s.lineHeight != null ? String(s.lineHeight) : undefined,
    letterSpacing: s.letterSpacing ? `${s.letterSpacing}px` : undefined,
    overflow: 'hidden'
  }
}

function lineBorder(el: LabelElement): string {
  const s = el.style
  return `${s.borderWidth && s.borderWidth > 0 ? s.borderWidth : 1}px ${s.borderStyle || 'solid'} ${s.borderColor || '#000'}`
}

function imageSrcOf(el: LabelElement): string {
  const bound = el.field ? readPath(props.data, el.field) : ''
  return safeUrl(bound || el.src || '')
}

/* ---------------- 条码 / 二维码渲染 ---------------- */
const codeEls = new Map<string, Element>()
function setCodeRef(id: string): (el: unknown) => void {
  return (el: unknown) => {
    if (el) codeEls.set(id, el as Element)
    else codeEls.delete(id)
  }
}

async function renderCodes(): Promise<void> {
  await nextTick()
  for (const el of items.value) {
    const dom = codeEls.get(el.id)
    if (!dom) continue
    const value = codeValue(el, props.data).trim()
    if (el.type === 'qrcode') {
      await renderQrcode(el, dom as HTMLElement, value)
    } else if (el.type === 'barcode') {
      renderBarcode(el, dom as SVGSVGElement, value)
    }
  }
}

/** 二维码：SVG 拉伸填满元素框（与设计器 CanvasQrElement 一致，margin 默认 1） */
async function renderQrcode(el: LabelElement, host: HTMLElement, value: string): Promise<void> {
  // 占位符（{{xx}}）不是有效码内容，跳过渲染留白
  if (!value || value.includes('{{')) {
    host.innerHTML = ''
    return
  }
  try {
    const svg = await QRCode.toString(value, {
      type: 'svg',
      errorCorrectionLevel: el.qrcodeErrorCorrectionLevel ?? 'M',
      margin: el.qrcodeMargin ?? 1
    })
    host.innerHTML = svg
      .replace(/<svg\b/, '<svg preserveAspectRatio="none" style="display:block;width:100%;height:100%"')
      .replace(/\swidth="[^"]*"/, ' width="100%"')
      .replace(/\sheight="[^"]*"/, ' height="100%"')
  } catch {
    host.innerHTML = '' // 无效码值留白，不阻塞打印
  }
}

/** 条码：参数与缩放策略与设计器 CanvasBarcodeElement 完全一致（拉伸填满容器） */
function renderBarcode(el: LabelElement, svg: SVGSVGElement, value: string): void {
  svg.innerHTML = ''
  if (!value || value.includes('{{')) return
  const s = el.style
  try {
    JsBarcode(svg, value, {
      format: el.barcodeFormat || 'CODE128',
      displayValue: el.showBarcodeText !== false,
      width: el.barcodeLineWidth ?? 2,
      height: el.barcodeHeight ?? Math.max(24, s.height - 24),
      fontSize: el.barcodeTextFontSize ?? 14,
      font: el.barcodeFont || undefined,
      textPosition: el.barcodeTextPosition || 'bottom',
      textAlign: el.barcodeTextAlign || 'center',
      textMargin: el.barcodeTextMargin ?? 2,
      margin: el.barcodeMargin ?? 4,
      lineColor: s.color || '#000000',
      background: 'transparent'
    })
    // 与设计器一致：码图拉伸填满元素框
    svg.setAttribute('preserveAspectRatio', 'none')
    svg.setAttribute('style', 'display:block;width:100%;height:100%')
  } catch {
    svg.innerHTML = '' // 无效码值留白，不阻塞打印
  }
}

/* 数据/模板变化时重渲染码类元素 */
watch(
  () => [props.data, props.template] as const,
  () => {
    void renderCodes()
  },
  { deep: true }
)

onMounted(() => {
  void renderCodes()
})
</script>

<style scoped>
.label-doc .code-svg {
  display: block;
}
</style>
