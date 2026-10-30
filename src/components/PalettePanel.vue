<template>
  <div class="palette">
    <div class="panel-title">组件</div>
    <div
      v-for="item in items"
      :key="item.type"
      class="palette-item"
      draggable="true"
      @dragstart="onDragStart($event, item.type)"
    >
      <span class="palette-icon">{{ item.icon }}</span>
      <span>{{ item.label }}</span>
    </div>
    <div class="tip">拖拽组件到右侧画布<br />选中后可编辑属性</div>
  </div>
</template>

<script setup lang="ts">
import type { ElementType } from '../types/template'

const items: Array<{ type: ElementType; label: string; icon: string }> = [
  { type: 'title', label: '标题', icon: '题' },
  { type: 'labelValue', label: '标签:值', icon: '签' },
  { type: 'text', label: '文本', icon: '文' },
  { type: 'table', label: '数据表格', icon: '表' },
  { type: 'image', label: '图片', icon: '图' },
  { type: 'barcode', label: '条形码', icon: '条' },
  { type: 'qrcode', label: '二维码', icon: '码' },
  { type: 'line', label: '分隔线', icon: '线' }
]

function onDragStart(evt: DragEvent, type: ElementType): void {
  evt.dataTransfer?.setData('application/x-pe-type', type)
}
</script>

<style scoped>
.palette {
  width: 150px;
  background: #fff;
  border-right: 1px solid #e4e7ed;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
}
.panel-title {
  font-weight: bold;
  font-size: 13px;
  color: #606266;
  margin-bottom: 4px;
}
.palette-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  border-radius: 4px;
  background: #ecf5ff;
  color: #409eff;
  font-size: 13px;
  font-weight: bold;
}
.palette-item:hover .palette-icon {
  background: #409eff;
  color: #fff;
}
.palette-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 10px;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  font-size: 13px;
  cursor: grab;
  background: #fafafa;
  transition: all 0.15s;
}
.palette-item:hover {
  border-color: #409eff;
  color: #409eff;
  background: #ecf5ff;
}
.palette-item:active { cursor: grabbing; }
.tip {
  margin-top: auto;
  font-size: 12px;
  color: #909399;
  line-height: 1.8;
}
</style>
