/**
 * 文档级渲染：完整 HTML 文档构建、打印、导出
 */
import type { TemplateSchema } from '../types/template'
import { __peRuntime } from './printRuntime.js'
import runtimeSource from './printRuntime.js?raw'

/**
 * 内联到导出 HTML 的运行时源码。
 * 采用 `?raw` 读取原始源码（非压缩产物），并剥离末尾的 export 语句，
 * 得到可被 `var __peBuildBody = <源码>;` 直接赋值的纯函数表达式，
 * 避免生产构建压缩改写函数体导致导出 HTML 运行时失效。
 */
const RUNTIME_FN_SOURCE = runtimeSource.replace(/\bexport\s*\{[^}]*\}\s*;?\s*$/, '').trim()

/** HTML 文本/属性转义 */
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** 净化下载文件名，剔除文件系统非法字符 */
function sanitizeFilename(name: string): string {
  const cleaned = String(name ?? '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .trim()
  return cleaned || 'download'
}

export interface RenderOptions {
  /** 打印份数（复制页面，用 __page/__total 占位） */
  copies?: number
  /** 是否注入运行时脚本（导出模板 HTML 时为 true） */
  withRuntime?: boolean
}

function nowString(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/**
 * 锚点跟随解析脚本（自包含 ES5，随 body HTML 注入）。
 * 布局后实测源元素底边（offsetTop+offsetHeight），把锚定元素（及其同组成员刚体）放到 源底边+间距。
 * 表格行数随数据变化时表尾元素自动跟随。独立 script：srcdoc / doc.write / 导出 HTML 均会执行。
 */
const ANCHOR_JS = `(function () {
  function resolve(root) {
    var scope = root && root.querySelectorAll ? root : document
    var els = [].slice.call(scope.querySelectorAll('[data-pe-id]'))
    var byId = {}
    els.forEach(function (n) { byId[n.getAttribute('data-pe-id')] = n })
    // 两轮：兼容锚点链（A 跟表格、B 跟 A）与 DOM 顺序倒置
    for (var pass = 0; pass < 2; pass++) {
      var seenGroups = {}
      els.forEach(function (n) {
        var aid = n.getAttribute('data-pe-anchor')
        if (!aid) return
        var src = byId[aid]
        if (!src || src === n) return
        var gid = n.getAttribute('data-pe-group')
        if (gid) {
          if (seenGroups[gid]) return
          seenGroups[gid] = true
        }
        var gap = (parseFloat(n.getAttribute('data-pe-gap')) || 4) * (96 / 25.4)
        var target = src.offsetTop + src.offsetHeight + gap
        var dy = target - n.offsetTop
        if (!dy) return
        var members = gid
          ? els.filter(function (m) { return m.getAttribute('data-pe-group') === gid })
          : [n]
        members.forEach(function (m) {
          m.style.top = (m === n ? target : m.offsetTop + dy) + 'px'
        })
      })
    }
  }
  window.__peResolveAnchors = resolve
  resolve(document)
  window.addEventListener('load', function () { resolve(document) })
})()`
// </script> 字面量需转义，避免出现在外层 <script> 字符串中提前闭合标签
const ANCHOR_JSON = JSON.stringify(`<script>${ANCHOR_JS}</script>`).replace(/<\//g, '<\\/')
const ANCHOR_SCRIPT = `<script>${ANCHOR_JS}</script>`

/** 单份/多份 body HTML */
export function buildBodyHtml(schema: TemplateSchema, data: Record<string, unknown>, copies = 1): string {
  const pages: string[] = []
  for (let i = 0; i < copies; i++) {
    const pageData = { ...data, __page: i + 1, __total: copies, __now: nowString() }
    const brk = i < copies - 1 ? ';page-break-after:always' : ''
    pages.push(`<div class="pe-page" style="page-break-inside:avoid${brk}">${__peRuntime(schema, pageData, false)}</div>`)
  }
  return pages.join('\n') + ANCHOR_SCRIPT
}

export function pageCss(schema: TemplateSchema): string {
  const { widthMm, heightMm } = schema.page
  return `
@page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: 'Microsoft YaHei', 'SimSun', 'Segoe UI', sans-serif; color: #000; }
.pe-page {
  position: relative;
  width: ${widthMm}mm;
  height: ${heightMm}mm;
  overflow: hidden;
  background: #fff;
  margin: 0 auto;
}
.pe-toolbar {
  position: sticky; top: 0; z-index: 999;
  background: #f5f7fa; border-bottom: 1px solid #dcdfe6;
  padding: 10px 16px; font-family: system-ui, sans-serif; color: #303133;
}
.pe-toolbar strong { margin-right: 12px; }
.pe-toolbar textarea {
  width: 100%; height: 90px; margin: 8px 0; font-family: Consolas, Monaco, monospace; font-size: 12px;
  border: 1px solid #dcdfe6; border-radius: 4px; padding: 6px 8px; resize: vertical;
}
.pe-actions button {
  border: 1px solid #409eff; background: #409eff; color: #fff; border-radius: 4px;
  padding: 5px 16px; margin-right: 8px; cursor: pointer; font-size: 13px;
}
.pe-actions button:hover { background: #66b1ff; }
.pe-hint { font-size: 12px; color: #909399; }
@media print {
  .pe-page { margin: 0; }
  .pe-toolbar { display: none; }
}
`
}

/** 构建完整 HTML 文档 */
export function buildDocumentHTML(
  schema: TemplateSchema,
  data: Record<string, unknown>,
  options: RenderOptions = {}
): string {
  const { copies = 1, withRuntime = false } = options
  const safeName = String(schema.name || '').replace(/</g, '&lt;')
  const body = withRuntime
    ? `<div id="pe-toolbar" class="pe-toolbar">
<strong>打印模板：${safeName}</strong>
<textarea id="pe-data" placeholder="在此粘贴后端返回的 JSON 数据…">{}</textarea>
<div class="pe-actions">
<button id="pe-render" type="button">渲染预览</button>
<button id="pe-print" type="button">打印</button>
</div>
<span class="pe-hint">粘贴数据后点「渲染预览」；「打印」直接输出。生产环境可在页面加载前注入 window.__PRINT_DATA__ 自动渲染。</span>
</div>
<div id="pe-root"></div>`
    : buildBodyHtml(schema, data, copies)
  const schemaJson = JSON.stringify(schema).replace(/</g, '\\u003c')

  const runtimeScript = withRuntime
    ? `
<script>
/* ===== 打印模板运行时 ===== */
window.__PE_SCHEMA__ = ${schemaJson};
var __peBuildBody = ${RUNTIME_FN_SOURCE};
var __peCss = ${JSON.stringify(pageCss(schema))};
var __peAnchorScript = ${ANCHOR_JSON};
/* 锚点解析器直接内联执行（定义 window.__peResolveAnchors，供下方渲染后调用） */
${ANCHOR_JS}
function __peResolve() { if (window.__peResolveAnchors) window.__peResolveAnchors(document); }

function __peNow() {
  var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}
function __pePageHtml(data, copies, ph) {
  var pages = [];
  for (var i = 0; i < copies; i++) {
    var pd = {};
    for (var k in data) pd[k] = data[k];
    pd.__page = i + 1; pd.__total = copies; pd.__now = __peNow();
    var brk = i < copies - 1 ? ';page-break-after:always' : '';
    pages.push('<div class="pe-page" style="page-break-inside:avoid' + brk + '">' + __peBuildBody(window.__PE_SCHEMA__, pd, ph) + '</div>');
  }
  return pages.join('\\n');
}
function __peFullDoc(data, copies, ph) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + ${JSON.stringify(schema.name)} + '</title><style>' + __peCss + '</style></head><body>' + __pePageHtml(data, copies, ph) + __peAnchorScript + '</body></html>';
}

/**
 * 对接后端数据：
 *   1) PrintTemplate.render(data[, ph])  填充页面（ph=true 显示占位结构）
 *   2) PrintTemplate.print(data[, copies])  直接拉起打印
 *   3) PrintTemplate.html(data[, copies])  获取最终 HTML 字符串
 * 字段占位符语法：{{field}} / {{a.b}}，缺失字段渲染为空白
 */
window.PrintTemplate = {
  render: function (data, ph) {
    document.body.insertAdjacentHTML('beforeend', __pePageHtml(data || {}, 1, !!ph));
    __peResolve();
  },
  html: function (data, copies, ph) { return __peFullDoc(data || {}, copies || 1, !!ph); },
  print: function (data, copies, ph) {
    var iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;width:0;height:0;border:none;left:0;top:0;';
    document.body.appendChild(iframe);
    var doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open(); doc.write(__peFullDoc(data || {}, copies || 1, !!ph)); doc.close();
    iframe.onload = function () {
      try { iframe.contentWindow.focus(); iframe.contentWindow.print(); } catch (e) {}
      setTimeout(function () { iframe.parentNode && iframe.parentNode.removeChild(iframe); }, 1000);
    };
  }
};

window.addEventListener('DOMContentLoaded', function () {
  var root = document.getElementById('pe-root');
  if (!root) return;
  root.innerHTML = __pePageHtml({}, 1, true); // 初始占位预览，展示模板结构
  __peResolve();
  var area = document.getElementById('pe-data');
  function parseData() {
    if (!area || !area.value) return {};
    try { return JSON.parse(area.value); } catch (e) { alert('数据 JSON 格式有误：' + e.message); return null; }
  }
  var btnR = document.getElementById('pe-render');
  var btnP = document.getElementById('pe-print');
  if (btnR) btnR.onclick = function () { var d = parseData(); if (d) { root.innerHTML = __pePageHtml(d, 1, false); __peResolve(); } };
  if (btnP) btnP.onclick = function () { var d = parseData(); if (d) window.PrintTemplate.print(d, 1, false); };
});

/* 若宿主系统在加载前注入 window.__PRINT_DATA__，则自动渲染 */
if (window.__PRINT_DATA__) { window.PrintTemplate.render(window.__PRINT_DATA__, false); }
</script>`
    : ''

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(schema.name)}</title>
<style>${pageCss(schema)}</style>
</head>
<body>
${body}
${runtimeScript}
</body>
</html>`
}

/** 通过隐藏 iframe 打印 HTML */
export function printHtml(html: string): void {
  const iframe = document.createElement('iframe')
  iframe.style.cssText = 'position:fixed;width:0;height:0;border:none;left:0;top:0;'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument || iframe.contentWindow?.document
  if (!doc) {
    iframe.remove()
    return
  }
  doc.open()
  doc.write(html)
  doc.close()
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } catch (e) {
      console.warn('打印失败:', e)
    } finally {
      setTimeout(() => iframe.parentNode?.removeChild(iframe), 1000)
    }
  }
}

export function downloadFile(filename: string, content: string, mime = 'text/html'): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = sanitizeFilename(filename)
  document.body.appendChild(a)
  a.click()
  a.remove()
  // 延迟释放：部分浏览器在 click 后尚未开始下载即被 revoke 会导致下载失败
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
