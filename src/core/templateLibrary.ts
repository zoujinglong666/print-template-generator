/**
 * 模板库：按名称保存/载入/删除模板（localStorage 持久化）。
 * 自研单据与流式设计器共用，kind 区分模板种类。
 */

export type TemplateKind = 'document' | 'flow'

export interface StoredTemplate<T = unknown> {
  id: string
  name: string
  kind: TemplateKind
  savedAt: number
  data: T
}

const LIB_KEY = 'print-template-library:v1'

function deepCopy<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T
}

function readAll(): StoredTemplate[] {
  try {
    const raw = localStorage.getItem(LIB_KEY)
    const list = raw ? (JSON.parse(raw) as StoredTemplate[]) : []
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

function writeAll(list: StoredTemplate[]): void {
  localStorage.setItem(LIB_KEY, JSON.stringify(list))
}

/** 模板列表（按保存时间倒序），可按种类过滤 */
export function listTemplates(kind?: TemplateKind): StoredTemplate[] {
  const list = readAll()
  list.sort((a, b) => b.savedAt - a.savedAt)
  return kind ? list.filter((t) => t.kind === kind) : list
}

/** 按名称保存（同种类同名视为更新），返回结果与是否为更新 */
export function saveTemplate(
  kind: TemplateKind,
  name: string,
  data: unknown
): { item: StoredTemplate; updated: boolean } {
  const list = readAll()
  const idx = list.findIndex((t) => t.kind === kind && t.name === name)
  const now = Date.now()
  if (idx >= 0) {
    list[idx] = { ...list[idx], savedAt: now, data: deepCopy(data) }
    writeAll(list)
    return { item: list[idx], updated: true }
  }
  const item: StoredTemplate = { id: uid(), name, kind, savedAt: now, data: deepCopy(data) }
  list.unshift(item)
  writeAll(list)
  return { item, updated: false }
}

export function removeTemplate(id: string): void {
  writeAll(readAll().filter((t) => t.id !== id))
}

let seed = 0
function uid(): string {
  seed += 1
  return `tpl_${Date.now().toString(36)}_${seed}`
}
