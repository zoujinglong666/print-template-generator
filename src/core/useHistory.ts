import { ref, watch, nextTick, type Ref } from 'vue'

export interface UseHistoryReturn<T> {
  /** 撤销最近一次操作；无可撤销内容时返回 false */
  undo: () => boolean
  /** 是否还有可撤销的历史（供按钮禁用态使用） */
  canUndo: Ref<boolean>
  /** 当前历史栈深度 */
  stackSize: Ref<number>
  /** 重新以当前状态为基准（不记录为一次撤销），用于模板载入/重置后刷新基线 */
  resetBaseline: () => void
}

/**
 * 通用快照式撤销历史。
 *
 * 设计：深度监听目标响应式对象，任意嵌套变更后经过一段去抖窗口（300ms）才把
 * 「变更前状态」压入历史栈。这样既能覆盖画布拖拽、列操作，也能覆盖属性面板的
 * 所有双向绑定修改，无需逐个包裹处理函数。一次连续交互（如一次拖拽、一次改名）
 * 在去抖窗口内只产生一条历史，撤销即为单步。
 *
 * 撤销通过整体替换 target.value 为历史快照实现，所有引用该对象的组件（画布、
 * 属性面板、预览）会同步刷新。
 */
export function useHistory<T extends Record<string, unknown>>(targetRaw: Ref<T>): UseHistoryReturn<T> {
  // 内部以 any 派生引用，规避 Vue ref 的 UnwrapRef 泛型推导限制（对外签名不变）
  const target = targetRaw as Ref<any>
  const MAX = 100
  const DEBOUNCE_MS = 300

  const undoStack = ref([]) as Ref<T[]>
  const canUndo = ref(false)
  const stackSize = ref(0)

  let baseline: T = clone(target.value)
  let timer: ReturnType<typeof setTimeout> | null = null
  let suppress = false

  function clone(v: T): T {
    return JSON.parse(JSON.stringify(v))
  }

  function flush(): void {
    timer = null
    if (suppress) return
    undoStack.value.push(baseline)
    if (undoStack.value.length > MAX) undoStack.value.shift()
    baseline = clone(target.value)
    canUndo.value = undoStack.value.length > 0
    stackSize.value = undoStack.value.length
  }

  function scheduleFlush(): void {
    if (suppress) return
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(flush, DEBOUNCE_MS)
  }

  // flush:'sync' 确保恢复赋值（target.value=快照）时 watcher 在 suppress 期间同步触发，
  // 避免"撤销"本身被当成一次新改动记入历史（消除 nextTick 竞态）
  watch(
    () => target.value,
    () => {
      scheduleFlush()
    },
    { deep: true, flush: 'sync' }
  )

  function undo(): boolean {
    if (undoStack.value.length === 0) return false
    const prev = undoStack.value.pop() as T
    // 替换过程不触发新的历史记录
    suppress = true
    target.value = clone(prev)
    // 等本次响应式刷新后再解除抑制
    nextTick(() => {
      suppress = false
    })
    baseline = clone(prev)
    canUndo.value = undoStack.value.length > 0
    stackSize.value = undoStack.value.length
    return true
  }

  function resetBaseline(): void {
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
    baseline = clone(target.value)
    canUndo.value = undoStack.value.length > 0
    stackSize.value = undoStack.value.length
  }

  if (typeof window !== 'undefined') {
    ;(window as unknown as Record<string, unknown>).__hist = { undoStack, canUndo, stackSize, forceUndo: undo }
  }
  return { undo, canUndo, stackSize, resetBaseline }
}
