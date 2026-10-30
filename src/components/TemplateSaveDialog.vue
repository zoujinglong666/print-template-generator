<template>
  <el-dialog v-model="visible" title="保存模板" width="420px" destroy-on-close>
    <el-form label-position="top" @submit.prevent="confirm">
      <el-form-item label="模板名称" required>
        <el-input
          v-model="name"
          placeholder="请输入模板名称"
          maxlength="50"
          @keyup.enter="confirm"
        />
      </el-form-item>
      <div class="tip">同名保存会覆盖旧版本；保存后可在「模板库」中载入或删除</div>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" @click="confirm">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

const visible = defineModel<boolean>({ required: true })
const props = defineProps<{ initialName?: string }>()
const emit = defineEmits<{ (e: 'save', name: string): void }>()

const name = ref('')

watch(visible, (v) => {
  if (v) name.value = props.initialName ?? ''
})

function confirm(): void {
  const n = name.value.trim()
  if (!n) {
    ElMessage.warning('请输入模板名称')
    return
  }
  emit('save', n)
  visible.value = false
}
</script>

<style scoped>
.tip {
  font-size: 12px;
  color: #909399;
  line-height: 1.6;
}
</style>
