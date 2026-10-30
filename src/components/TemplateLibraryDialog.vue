<template>
  <el-dialog v-model="visible" title="模板库" width="560px" destroy-on-close>
    <el-empty v-if="!list.length" description="暂无已保存模板" />
    <template v-else>
      <div v-for="item in list" :key="item.id" class="tpl-row">
        <div class="tpl-info">
          <span class="tpl-name">{{ item.name }}</span>
          <span class="tpl-meta">{{ formatTime(item.savedAt) }}</span>
        </div>
        <div class="tpl-actions">
          <el-button v-if="props.enablePreview" size="small" @click="emit('preview', item)">查看</el-button>
          <el-button size="small" type="primary" plain @click="emit('load', item)">载入</el-button>
          <el-button size="small" type="danger" plain @click="onDelete(item)">删除</el-button>
        </div>
      </div>
    </template>
    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { listTemplates, removeTemplate } from '../core/templateLibrary'
import type { StoredTemplate, TemplateKind } from '../core/templateLibrary'

const visible = defineModel<boolean>({ required: true })
const props = defineProps<{ kind: TemplateKind; enablePreview?: boolean }>()
const emit = defineEmits<{
  (e: 'load', item: StoredTemplate): void
  (e: 'preview', item: StoredTemplate): void
}>()

const list = ref<StoredTemplate[]>([])

watch(visible, (v) => {
  if (v) list.value = listTemplates(props.kind)
})

function formatTime(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function onDelete(item: StoredTemplate): void {
  ElMessageBox.confirm(`确定删除模板「${item.name}」？删除后不可恢复。`, '删除确认', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消'
  })
    .then(() => {
      removeTemplate(item.id)
      list.value = listTemplates(props.kind)
      ElMessage.success('已删除')
    })
    .catch(() => undefined)
}
</script>

<style scoped>
.tpl-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 4px;
  border-bottom: 1px solid #f0f0f0;
}
.tpl-row:last-child { border-bottom: none; }
.tpl-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.tpl-name { font-size: 14px; font-weight: 500; }
.tpl-meta { font-size: 12px; color: #909399; }
.tpl-actions { display: flex; gap: 8px; flex-shrink: 0; }
</style>
