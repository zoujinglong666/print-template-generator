<template>
  <div class="app">
    <header class="mode-bar">
      <div class="left">
        <span class="logo">打印模板编辑器</span>
        <el-radio-group v-model="mode" size="small">
          <el-radio-button value="flow">单据（流式 JSON）</el-radio-button>
          <el-radio-button value="svprint">单据（sv-print）</el-radio-button>
          <el-radio-button value="document">单据（自研）</el-radio-button>
          <el-radio-button value="label">标签模板</el-radio-button>
        </el-radio-group>
      </div>
      <div class="right">
        <el-tooltip
          :content="mode === 'flow'
            ? '流式单据设计器：拖拽编辑信息项/表格列，产物为模板 JSON，配套 print-kit 通用渲染器，ERP 端零改动接入，改模板不发版'
            : mode === 'svprint'
            ? 'A4 单据设计器：基于 @sv-print/vue3，开箱即用的设计/预览/打印/导出，排版与间距由设计器精确控制'
            : mode === 'document'
            ? '单据模式：自研渲染引擎，可导出独立 HTML（内嵌 {{字段}} 填充运行时），后端数据注入即可打印'
            : '标签模式：基于 print-canvas-designer，支持条码/二维码、A4 与各种小尺寸标签，模板 JSON 可直接嵌入业务系统'"
          placement="bottom-end"
        >
          <span class="mode-hint">{{ mode === 'flow' ? '流式 JSON 模板设计器' : mode === 'svprint' ? 'sv-print 设计器模式' : mode === 'document' ? 'HTML 模板导出模式' : '标签设计器模式' }}</span>
        </el-tooltip>
      </div>
    </header>

    <!-- 用 v-show 保持各编辑器各自的状态 -->
    <FlowDocEditor v-show="mode === 'flow'" class="editor-host" />
    <SvPrintEditor v-show="mode === 'svprint'" class="editor-host" />
    <DocumentEditor v-show="mode === 'document'" class="editor-host" />
    <LabelEditor v-show="mode === 'label'" class="editor-host" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import DocumentEditor from './components/DocumentEditor.vue'
import LabelEditor from './components/LabelEditor.vue'
import SvPrintEditor from './components/SvPrintEditor.vue'
import FlowDocEditor from './components/FlowDocEditor.vue'

type EditorMode = 'flow' | 'svprint' | 'document' | 'label'
const mode = ref<EditorMode>('flow')
</script>

<style scoped>
.app {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.mode-bar {
  height: 48px;
  flex-shrink: 0;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
}
.left { display: flex; align-items: center; gap: 16px; }
.logo { font-weight: bold; font-size: 15px; }
.mode-hint { font-size: 12px; color: #909399; cursor: help; }
.editor-host { min-height: 0; }
</style>
