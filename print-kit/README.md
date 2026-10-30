# print-kit 对接文档（自研单据渲染 / 打印）

`print-kit` 是「打印模板编辑器」产出的**自研单据模板**在 ERP 端的直接渲染与打印包。

## 为什么用这个方案

自研模板保存的是**绝对定位坐标**（mm 级），`DocumentDoc` 直接按坐标渲染，**版式零损失**——ERP 屏幕预览、打印输出与设计器画布三者 100% 一致。

> 不要走「转流式 JSON → 流式重排」的路线：绝对定位被重排成流式后，列宽/位置会错位，与设计器对不齐。

---

## 一、拷贝文件

把整个 `print-kit` 目录拷到 ERP 项目（建议放在 `src/print-kit`）。必拷 **6 个文件**：

| 文件 | 作用 | 是否必需 |
|---|---|---|
| `DocumentDoc.vue` | 自研模板渲染组件（props: `template` / `data` / `placeholder`） | 必需 |
| `document-runtime.js` | 纯 JS 渲染运行时（**零依赖、自包含**） | 必需 |
| `document-schema.ts` | 模板/数据类型 + 辅助函数 `docPageExtraCss` / `buildDocSampleData` | 必需 |
| `usePrint.ts` | 打印引擎（iframe + 共享样式 + 份数分页 + 等图片） | 打印时必需 |
| `print.css` | 打印样式源（被 `usePrint` 以 `?raw` 内联进打印 iframe） | 打印时必需 |
| `document-runtime.d.ts` | 运行时 TS 类型声明 | 仅 TS 项目 |

> `PrintDoc.vue` / `print-schema.ts` / `templateLoader.ts` / `templates/` 是「流式渲染」那套，本方案不需要，可忽略。

**环境要求**：Vue 3 + Vite（因为 `usePrint.ts` 用 `import printCss from './print.css?raw'`）。纯 Vue3 无 Vite 的替代方案见第六节。

---

## 二、模板数据从哪来

在「打印模板编辑器」的 **单据（自研）** 模式，点工具栏 **「导出模板数据」**，得到 JSON：

```jsonc
{
  "name": "采购入库单",
  "template": { /* 自研模板 Schema，绝对定位坐标，见第三节 */ },
  "sampleData": { /* 按字段生成的占位数据，仅用于预览结构 */ }
}
```

ERP 端拿到后：

- `template` → 直接传给 `<DocumentDoc :template="...">`
- 真实业务数据 → 传给 `<DocumentDoc :data="...">`（覆盖 `sampleData`）

> `sampleData` 只是设计器附带的示例，ERP 运行时用**接口真实数据**替换它即可，字段名保持一致。

---

## 三、模板 Schema 结构（速查）

```ts
interface DocSchemaLike {
  name?: string
  page: { widthMm: number; heightMm: number; marginMm?: number }
  elements: DocElementLike[]
}

interface DocElementLike {
  id: string
  type: 'title' | 'text' | 'labelValue' | 'table' | 'image' | 'line' | string
  x: number; y: number; w: number; h: number   // 单位 mm
  style?: Record<string, unknown>
  text?: string        // title/text 的静态文案，支持 {{field}}
  label?: string       // 标签名
  value?: string       // labelValue 的取值，支持 {{field}}
  field?: string       // 图片 URL 绑定字段
  srcField?: string    // 表格行数组字段（默认 'details'）
  columns?: { title?: string; field?: string; width?: string; align?: string; colSpan?: number }[]
  showSummary?: boolean
  summaryLabel?: string
  sumFields?: string[]
  previewRows?: number
}
```

所有坐标、尺寸单位均为 **mm**。

---

## 四、快速接入（Vue 3 + TS）

```vue
<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import DocumentDoc from '@/print-kit/DocumentDoc.vue'
import { usePrint } from '@/print-kit/usePrint'
import { docPageExtraCss } from '@/print-kit/document-schema'

// 1) 载入设计器导出的模板包  { name, template, sampleData }
const tpl = ref(await loadTemplateFromBackend())   // 你的接口

// 2) 真实业务数据（接口返回，字段名与模板一致）
const orderData = ref({
  orderNo: 'CG-2026-0001',
  supplier: '某某供应商',
  details: [ { name: 'A4 纸', qty: 10, price: 20 }, { /* ... */ } ]
})

// 3) 渲染
const docRef = ref<InstanceType<typeof DocumentDoc> | null>(null)

// 4) 打印
const { print, printing } = usePrint()
async function onPrint() {
  const el = docRef.value?.$el as HTMLElement | undefined
  if (!el) return
  // @page 尺寸由模板驱动，保证打印纸 = 设计尺寸，版式零损失
  await print(el, {
    copies: 1,
    extraCss: docPageExtraCss(tpl.value.template.page)
  })
}
</script>

<template>
  <DocumentDoc ref="docRef"
    :template="tpl.template"
    :data="orderData" />
  <button :disabled="printing" @click="onPrint">打印</button>
</template>
```

---

## 五、字段绑定规则

| 元素 | 绑定方式 |
|---|---|
| `title` / `text` | 在 `text` 里写 `{{orderNo}}`，运行时按 `data.orderNo` 填充 |
| `labelValue` | `value` 支持 `{{field}}` |
| `table` | `srcField`（默认 `details`）指向 `data` 中的**数组**；`columns[].field` 为行内字段 |
| `image` | `field` 指向 `data` 中的图片 URL 字段 |
| 任意字段 | 支持点路径，如 `{{customer.address.city}}` |

占位模式：`placeholder` 设为 `true` 时，缺失字段会显示 `{{field}}` 本身，便于检查模板结构。

```vue
<!-- 预览模板骨架（无需真实数据） -->
<DocumentDoc :template="tpl.template" :placeholder="true" />
```

---

## 六、非 Vite / 纯 JS 项目

`usePrint.ts` 用了 `import printCss from './print.css?raw'`（Vite 专属）。若 ERP 不是 Vite：

**方案 A（推荐）**——手写一个 `usePrint`（或直接用 DOM）：把 `print.css` 内容读成字符串，打印时塞进 iframe `<style>`。其余文件（`.vue` 组件、`document-runtime.js`、`.ts`）无需改动。

**方案 B**——直接用设计器的 **「导出 HTML」**：
导出的 HTML 已内联运行时，后端注入业务数据、调用其中的 `PrintTemplate.print(data)` 即可打印。ERP 甚至不需要引入 `print-kit`，适合**完全前后端分离、由后端拼装页面**的场景。

**纯 JS 调用运行时**（不想用 Vue 组件时）：

```js
import { __peRuntime } from './print-kit/document-runtime.js'
// 返回完整 HTML 字符串，自己挂到 DOM 即可
const html = __peRuntime(templateSchema, businessData, /* placeholder */ false)
document.getElementById('paper').innerHTML = html
```

---

## 七、打印参数（usePrint）

```ts
print(target /* HTMLElement | string(outerHTML) */, {
  copies?: number,        // 份数，默认 1（自动分页）
  onDone?: () => void,    // afterprint 回调，可回写打印状态
  imageTimeout?: number,  // 等待图片解码上限 ms，默认 3000（坏图不阻塞）
  extraCss?: string       // 附加样式，如 docPageExtraCss(template.page)
})
```

`@page` 尺寸由 `docPageExtraCss(template.page)` 生成，边距固定为 0（页边距已包含在元素坐标里）。

---

## 八、安全说明

- `document-runtime.js` 对数据值做 **HTML 转义**，防止 `data` 中的 `<script>` 等注入。
- 图片 URL 走**白名单**：拦截 `javascript:` / `vbscript:` / `data:` / `file:` 协议，仅放行 `http(s):` / 相对路径 / `blob:`。
- 模板 JSON 应由可信来源（你自己的设计器导出）提供，不要直接信任外部传入的模板。

---

## 九、不固定高度（锚点跟随）

表格行数不固定时，表尾元素（制单人 / 审核 / 验收 / 打印日期等）应贴紧表格底部，而不是固定在某个 Y 坐标——否则行数一多就被盖住、行数少又悬空。

### 零配置（默认即生效）

**只要模板里有一个表格，它下方（Y 坐标大于表格底边）的所有元素，渲染时会自动贴紧该表格底边**——不需要在设计器配置、也不需要在模板 JSON 里写任何 `anchor` 字段。导出的模板数据一粘到 ERP 页面即可自动跟随。

```vue
<DocumentDoc :template="tpl.template" :data="realData" />
```

`DocumentDoc` 在渲染后基于模板坐标自动推断「表格下方元素 → 跟随最近表格」，并按表格**真实渲染高度**重定位 `top`（多轮迭代，支持表尾 → 落款级联）。重定位结果写进内联样式，`usePrint` 打印时原样保留，屏幕预览与打印完全一致。

### 精确控制（可选）

若默认自动跟随不符合预期（例如表格下方某元素需要固定不动），可在设计器里手动覆盖：

1. 选中要控制的元素 → 右侧属性面板「锚点跟随」→ 跟随目标选表格、设间距（mm）
2. 手动 `anchor` 优先级高于自动推断，已声明的元素不会被自动逻辑改写

手动配置后导出，JSON 里会带 `anchor` 字段：

```jsonc
{
  "name": "调拨单模板",
  "template": {
    "page": { "widthMm": 210, "heightMm": 297 },
    "elements": [
      { "id": "tb_1", "type": "table", "x": 10, "y": 50, "w": 190, "h": 60, "srcField": "details", ... },
      { "id": "lv_1", "type": "labelValue", "label": "制单人：", "value": "{{creator}}",
        "anchor": "tb_1", "gapMm": 6, ... }
    ]
  },
  "sampleData": { ... }
}
```

### ERP 端要求

ERP 用的是 **最新 print-kit 文件**（已包含 `DocumentDoc.vue` 的锚点重定位逻辑 + `document-runtime.js` 输出的 `data-pe-*` 属性）即可。内置示例模板「调拨单模板」已默认配置好表尾跟随表格，可直接导出验证。

> ⚠️ 若 ERP 端用的是旧版 print-kit，请重新拷贝 `DocumentDoc.vue`、`document-runtime.js`、`document-schema.ts` 三个文件，否则跟随不会生效。

---

## 十、常见问题

**Q：屏幕预览和打印版式不一致？**
A：确认打印时传了 `extraCss: docPageExtraCss(template.page)`，且 `print.css` 已随 `usePrint.ts` 一起拷贝。

**Q：表格不显示 / 只有表头？**
A：`data` 中对应数组字段缺失或为空。`srcField`（默认 `details`）需是数组；可在设计器用「渲染器预览」先验证。

**Q：坐标单位是 px 还是 mm？**
A：**mm**。模板 `page.widthMm/heightMm` 与元素 `x/y/w/h` 全是 mm。

**Q：ERP 是 Vue2？**
A：本包基于 Vue3 `<script setup>`。Vue2 需自行改写 `DocumentDoc.vue`（运行时 `document-runtime.js` 是纯 JS，可直接复用）。

---

> 标签模板（标签纸打印）请用同级 `label-kit` 包，对接方式类似（`<LabelDoc>` + `useLabelPrint`）。
