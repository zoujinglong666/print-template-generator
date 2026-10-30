/**
 * 标签打印引擎（iframe + @page 尺寸由模板驱动，独立于 print-kit，可单独拷贝）。
 *
 * 用法：
 *   const { print, printing } = useLabelPrint()
 *   <LabelDoc ref="host" :template :data />
 *   print(host.value, { template, copies: 1 })
 */
import { ref } from 'vue'
import { pxToMm } from './label-schema'
import type { LabelDocument } from './label-schema'

export interface LabelPrintOptions {
  /** 打印份数，默认 1 */
  copies?: number
  /** 标签模板：@page 尺寸由其页面 px 尺寸换算 */
  template: LabelDocument
  /** 码类元素（qrcode 异步）渲染固定等待(ms)，默认 150 */
  codeDelay?: number
}

export function useLabelPrint() {
  const printing = ref(false)

  /** 等待码类元素渲染完成：固定延时 + 双 rAF 提交绘制 */
  function waitCodes(delay: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      }, delay)
    })
  }

  async function print(target: HTMLElement | string, options: LabelPrintOptions): Promise<void> {
    const { copies = 1, template, codeDelay = 150 } = options
    // 规避偶发遮挡：先等字体就绪，再复制 DOM。否则中文字形未加载完就打印，
    // 会回退到 fallback 字体（字形更宽/行高不同），定宽框 + overflow:hidden 把文字裁掉。
    if (typeof document !== 'undefined' && (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts?.ready) {
      try {
        await (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts.ready
      } catch {
        /* 字体 API 异常不影响打印 */
      }
    }
    const content = typeof target === 'string' ? target : target.outerHTML
    const total = Math.max(1, Math.floor(copies) || 1)
    const pages = Array.from({ length: total }, () => `<div class="label-page">${content}</div>`).join('')

    const page = template.page
    const mmW = pxToMm(page.width)
    const mmH = pxToMm(page.height)
    // 打印样式完全自包含：不依赖任何主应用的 scoped 样式（scoped 属性不会进入 outerHTML）。
    // 重点：二维码/条码 svg 强制 display:block（否则打印文档里变 inline 产生基线空隙被裁切），
    // .label-page 显式高度 + overflow:hidden 锁定分页缩放，避免偶发裁切。
    const extraCss =
      `@page { size: ${mmW}mm ${mmH}mm; margin: 0; }` +
      `.label-page { width: ${page.width}px; height: ${page.height}px; overflow: hidden; position: relative; }` +
      `.label-doc, .label-doc * { box-sizing: border-box; }` +
      `.label-doc svg { display: block; }` +
      `.label-page + .label-page { page-break-before: always; }`

    const iframe = document.createElement('iframe')
    iframe.setAttribute('aria-hidden', 'true')
    Object.assign(iframe.style, {
      position: 'fixed',
      width: '0px',
      height: '0px',
      border: 'none',
      left: '0px',
      top: '0px'
    })
    document.body.appendChild(iframe)

    const win = iframe.contentWindow
    const doc = iframe.contentDocument ?? win?.document
    if (!win || !doc) {
      iframe.remove()
      return
    }

    printing.value = true
    let finished = false
    let fallbackTimer = 0
    const cleanup = (): void => {
      if (finished) return
      finished = true
      window.clearTimeout(fallbackTimer)
      printing.value = false
      iframe.remove()
    }

    try {
      await waitCodes(codeDelay)
      doc.open()
      doc.write(
        `<!DOCTYPE html><html><head><meta charset="UTF-8" />` +
          `<style>* { box-sizing: border-box; } html, body { margin: 0; padding: 0; }</style>` +
          `<style>${extraCss}</style>` +
          `</head><body>${pages}</body></html>`
      )
      doc.close()
      await new Promise<void>((resolve) => win.requestAnimationFrame(() => resolve()))
      win.focus()
      win.print()
      win.addEventListener('afterprint', cleanup, { once: true })
      fallbackTimer = window.setTimeout(cleanup, 2000) // 兜底：部分浏览器不触发 afterprint
    } catch (error) {
      console.warn('[useLabelPrint] 打印失败:', error)
      cleanup()
    }
  }

  return { print, printing }
}
