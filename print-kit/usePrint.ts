import { ref } from 'vue'
// 全项目唯一的打印样式源（与组件屏幕预览共用同一文件）
// 若 print.css 放在 src/assets/styles 下，请改为 '@/assets/styles/print.css?raw'
import printCss from './print.css?raw'

export interface UsePrintOptions {
  /** 打印份数，默认 1 */
  copies?: number
  /** 打印完成（afterprint）后回调，用于状态回写等 */
  onDone?: () => void
  /** 等待图片解码上限(ms)，避免坏图卡住打印，默认 3000 */
  imageTimeout?: number
  /** 附加样式（如按模板覆盖 @page 边距） */
  extraCss?: string
}

/** 等待 iframe 内图片解码完成（带超时兜底，坏图不阻塞打印） */
async function waitImages(doc: Document, timeout: number): Promise<void> {
  const imgs = Array.from(doc.images)
  if (!imgs.length) return
  const decodeAll = Promise.all(
    imgs.map((img) =>
      typeof img.decode === 'function' ? img.decode().catch(() => undefined) : Promise.resolve()
    )
  )
  await Promise.race([decodeAll, new Promise<void>((resolve) => setTimeout(resolve, timeout))])
}

/**
 * 全项目复用的打印引擎：iframe + 共享 print.css + 份数分页 + 等图片 + afterprint 清理。
 * 用法：
 *   const { print, printing } = usePrint()
 *   print(printRef.value, { copies, onDone })
 */
export function usePrint() {
  const printing = ref(false)

  async function print(target: HTMLElement | string, options: UsePrintOptions = {}): Promise<void> {
    const { copies = 1, onDone, imageTimeout = 3000, extraCss = '' } = options
    const content = typeof target === 'string' ? target : target.outerHTML
    const total = Math.max(1, Math.floor(copies) || 1)
    // 分页由 print.css 的 .print-page + .print-page 规则处理
    const pages = Array.from({ length: total }, () => `<div class="print-page">${content}</div>`).join('')

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
      onDone?.()
      return
    }

    printing.value = true
    let finished = false
    let fallbackTimer = 0
    const cleanup = () => {
      if (finished) return
      finished = true
      window.clearTimeout(fallbackTimer)
      printing.value = false
      iframe.remove()
      onDone?.()
    }

    try {
      doc.open()
      doc.write(
        `<!DOCTYPE html><html><head><meta charset="UTF-8" />` +
          `<style>${printCss}</style>` +
          (extraCss ? `<style>${extraCss}</style>` : '') +
          `</head><body>${pages}</body></html>`
      )
      doc.close()
      await waitImages(doc, imageTimeout)
      await new Promise<void>((resolve) => win.requestAnimationFrame(() => resolve()))
      win.focus()
      win.print()
      win.addEventListener('afterprint', cleanup, { once: true })
      fallbackTimer = window.setTimeout(cleanup, 2000) // 兜底：部分浏览器不触发 afterprint
    } catch (error) {
      console.warn('[usePrint] 打印失败:', error)
      cleanup()
    }
  }

  return { print, printing }
}
