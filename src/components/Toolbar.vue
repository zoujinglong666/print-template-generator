<template>
  <div class="toolbar">
    <div class="left">
      <span class="logo">打印模板编辑器</span>
      <el-button
        size="small"
        :disabled="!canUndo"
        :title="canUndo ? '撤销最近一次操作（Ctrl/⌘+Z）' : '没有可撤销的操作'"
        @click="emit('undo')"
      >
        <span style="display:inline-flex;align-items:center;gap:4px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M3 13a9 9 0 1 0 3-7.7L3 8"/></svg>
          撤销
        </span>
      </el-button>
      <el-input v-model="name" class="name-input" placeholder="模板名称" size="small" />
    </div>
    <div class="right">
      <el-button-group class="zoom-group">
        <el-button size="small" @click="emit('zoom', -0.1)">-</el-button>
        <el-button size="small" class="zoom-val">{{ Math.round(zoom * 100) }}%</el-button>
        <el-button size="small" @click="emit('zoom', 0.1)">+</el-button>
      </el-button-group>
      <el-divider direction="vertical" />
      <el-button size="small" @click="emit('data')">打印数据…</el-button>
      <el-button size="small" type="primary" plain @click="emit('preview')">预览</el-button>
      <el-button size="small" type="primary" plain @click="emit('print')">打印</el-button>
      <el-divider direction="vertical" />
      <el-button size="small" @click="emit('save')">保存</el-button>
      <el-button size="small" @click="emit('loadTemplate')">载入</el-button>
      <el-button size="small" @click="emit('importJson')">导入JSON</el-button>
      <el-button size="small" @click="emit('copyJson')">复制JSON</el-button>
      <el-button size="small" @click="emit('exportJson')">导出模板</el-button>
      <el-button size="small" type="success" @click="emit('exportHtml')">导出HTML</el-button>
      <el-button size="small" type="success" plain @click="emit('exportKit')">导出模板数据</el-button>
      <el-button size="small" type="warning" plain @click="emit('renderPreview')">渲染器预览</el-button>
      <el-button size="small" type="warning" @click="emit('convertFlow')">转流式JSON</el-button>
      <el-divider direction="vertical" />
      <el-button size="small" type="danger" text @click="emit('reset')">重置示例</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ templateName: string; zoom: number; canUndo?: boolean }>()
const emit = defineEmits<{
  (e: 'update:templateName', v: string): void
  (e: 'zoom', delta: number): void
  (e: 'undo'): void
  (e: 'data' | 'preview' | 'print' | 'save' | 'loadTemplate' | 'importJson' | 'copyJson' | 'exportJson' | 'exportHtml' | 'exportKit' | 'renderPreview' | 'convertFlow' | 'reset'): void
}>()

const name = computed({
  get: () => props.templateName,
  set: (v: string) => emit('update:templateName', v)
})
</script>

<style scoped>
.toolbar {
  height: 50px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  flex-shrink: 0;
}
.left { display: flex; align-items: center; gap: 12px; }
.logo { font-weight: bold; font-size: 15px; }
.name-input { width: 180px; }
.right { display: flex; align-items: center; gap: 4px; flex-wrap: nowrap; }
.zoom-group .zoom-val { width: 64px; pointer-events: none; }
</style>
