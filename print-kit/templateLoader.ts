/**
 * 前端模板注册表（不依赖后端）。
 *
 * 使用方式：
 *   1. 设计器排版满意后 → 复制JSON / 导出JSON
 *   2. 把 JSON 文件放进 templates/ 目录，文件名即业务键（如 pickup-order.json → 'pickup-order'）
 *   3. 页面里：const tpl = await loadTemplate('pickup-order')
 *
 * 新增模板 = 放一个新 JSON 文件，零代码注册（import.meta.glob 自动收集）。
 * 未来切后端：只改 loadTemplate 内部为接口请求，页面代码零改动。
 */
import type { PrintTemplate } from './print-schema'

const modules = import.meta.glob('./templates/*.json', { eager: true })

const registry: Record<string, PrintTemplate> = {}
for (const path in modules) {
  const key = path.replace(/^.*\/(.+)\.json$/, '$1')
  registry[key] = modules[path] as PrintTemplate
}

/** 已注册的模板业务键列表 */
export function getTemplateKeys(): string[] {
  return Object.keys(registry)
}

export function hasTemplate(key: string): boolean {
  return key in registry
}

/** 取模板（异步签名，便于未来无缝切换为后端接口） */
export async function loadTemplate(key: string): Promise<PrintTemplate> {
  const tpl = registry[key]
  if (!tpl) throw new Error(`模板不存在：${key}（可用：${getTemplateKeys().join('、') || '无'}）`)
  return tpl
}
