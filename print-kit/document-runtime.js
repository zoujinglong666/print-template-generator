/**
 * 自包含打印运行时（纯 JS，禁止引用任何外部变量 / import）。
 * 两种使用方式：
 *   1) ES module 导入（应用内预览/打印）：buildBodyHtml 调用
 *   2) `?raw` 原样内联进导出的独立 HTML（renderer.ts 会剥离末尾 export）
 *      原样内联可避免 Vite/esbuild 压缩改写函数体，保证导出 HTML 稳定可用。
 */

/* eslint-disable */
function __peRuntime(schema, data, ph = false) {
  var esc = function (v) {
    if (v === undefined || v === null) return ''
    var s
    if (Array.isArray(v)) s = v.map(function (i) { return i == null ? '' : String(i) }).join(', ')
    else if (typeof v === 'object') s = JSON.stringify(v)
    else s = String(v)
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
  // 仅放行安全协议，规避 javascript:/vbscript:/data: 等 XSS 向量
  var safeUrl = function (u) {
    var s = String(u == null ? '' : u).trim()
    if (/^(javascript|vbscript|data|file):/i.test(s)) return ''
    return s
  }
  var get = function (obj, path) {
    return String(path == null ? '' : path)
      .split('.')
      .reduce(function (o, k) { return o == null ? undefined : o[k] }, obj)
  }
  var fill = function (tpl) {
    return String(tpl == null ? '' : tpl).replace(/\{\{([^}]+)\}\}/g, function (m, p) {
      var val = get(data, p.trim())
      if ((val === undefined || val === null || val === '') && ph) return m
      return esc(val)
    })
  }
  var st = function (e) {
    var s = e.style || {}
    var css = 'position:absolute;left:' + e.x + 'mm;top:' + e.y + 'mm;'
    if (e.w) css += 'width:' + e.w + 'mm;'
    // 表格行数不定：渲染时用 min-height，内容多则容器撑高（锚点跟随按真实底边计算）
    if (e.h) css += (e.type === 'table' ? 'min-height:' : 'height:') + e.h + 'mm;'
    if (s.fontSize) css += 'font-size:' + s.fontSize + 'pt;'
    if (s.bold) css += 'font-weight:bold;'
    if (s.color) css += 'color:' + s.color + ';'
    if (s.align) css += 'text-align:' + s.align + ';'
    if (s.vAlign === 'middle') css += 'display:flex;align-items:center;'
    else if (s.vAlign === 'bottom') css += 'display:flex;align-items:flex-end;'
    return css
  }
  // 属性值转义（在 esc 基础上补引号）
  var escAttr = function (v) {
    return esc(v).replace(/"/g, '&quot;')
  }
  // 公共属性：data-pe-id 供「锚点跟随」定位源元素；
  // 元素声明 anchor（源元素 id）时输出 data-pe-anchor / data-pe-gap（默认 4mm），
  // 渲染组件在挂载后按源元素实际底边 + gap 重定位该元素 top（表格行数不定，表尾跟随）。
  var at = function (e) {
    var a = ' data-pe-id="' + escAttr(e && e.id) + '"'
    if (e && e.anchor) {
      a += ' data-pe-anchor="' + escAttr(e.anchor) + '"'
      a += ' data-pe-gap="' + (Number(e.gapMm) || 4) + '"'
    }
    return a
  }

  var html = ''
  var elements = (schema && schema.elements) || []
  for (var n = 0; n < elements.length; n++) {
    var e = elements[n]
    if (!e) continue
    if (e.type === 'title') {
      html += '<div' + at(e) + ' style="' + st(e) + ';font-weight:bold;text-align:center;line-height:1.3">' + fill(e.text) + '</div>'
    } else if (e.type === 'text') {
      html += '<div' + at(e) + ' style="' + st(e) + ';white-space:pre-wrap;word-break:break-all;line-height:1.4">' + fill(e.text).replace(/\n/g, '<br/>') + '</div>'
    } else if (e.type === 'labelValue') {
      html +=
        '<div' + at(e) + ' style="' + st(e) + ';gap:1.5mm;white-space:nowrap">' +
        '<span style="font-weight:bold;color:#333;white-space:nowrap">' + fill(e.label) + '</span>' +
        '<span style="word-break:break-all;white-space:normal">' + fill(e.value) + '</span></div>'
    } else if (e.type === 'image') {
      var src = safeUrl(get(data, e.field))
      html += '<div' + at(e) + ' style="' + st(e) + '">' + (src ? '<img src="' + esc(src) + '" style="width:100%;height:100%;object-fit:contain;display:block"/>' : '') + '</div>'
    } else if (e.type === 'line') {
      var ls = e.style || {}
      html += '<div' + at(e) + ' style="' + st(e) + ';border-top:' + (ls.thickness || 1) + 'px solid ' + (ls.color || '#000') + '"></div>'
    } else if (e.type === 'table') {
      var rows = get(data, e.srcField)
      if (!Array.isArray(rows)) rows = []
      var cols = e.columns || []
      var ts = e.style || {}
      var bc = ts.borderColor || '#000'
      if (ph && !rows.length && e.previewRows) {
        rows = new Array(e.previewRows).fill({})
      }
      var t =
        '<table style="width:100%;border-collapse:collapse;table-layout:fixed;' +
        (ts.fontSize ? 'font-size:' + ts.fontSize + 'pt;' : '') +
        'border-color:' + bc + '">'
      // 表头：支持 colSpan 合并相邻列
      t += '<thead><tr>'
      var slot = 0
      while (slot < cols.length) {
        var c = cols[slot]
        var span = Math.max(1, Math.min(c.colSpan || 1, cols.length - slot))
        t +=
          '<th colspan="' + span + '" style="width:' + (c.width || 'auto') + ';border:1px solid ' + bc +
          ';padding:1.2mm 1.5mm;text-align:' + (c.align || 'center') +
          ';background:' + (ts.headerBg || '#f2f2f2') + ';font-weight:bold">' + esc(c.title) + '</th>'
        slot += span
      }
      t += '</tr></thead><tbody>'
      for (var r = 0; r < rows.length; r++) {
        t += '<tr>'
        var i2 = 0
        while (i2 < cols.length) {
          var cc = cols[i2]
          var cspan = Math.max(1, Math.min(cc.colSpan || 1, cols.length - i2))
          var v = cc.field === '__serial' ? r + 1 : get(rows[r], cc.field)
          var cell = esc(v)
          if (ph && (v === undefined || v === null || v === '') && cc.field !== '__serial') {
            cell = '{{' + cc.field + '}}'
          }
          t +=
            '<td colspan="' + cspan + '" style="border:1px solid ' + bc + ';padding:1.2mm 1.5mm;vertical-align:middle;word-break:break-word;text-align:' +
            (cc.align || 'left') + '">' + cell + '</td>'
          i2 += cspan
        }
        t += '</tr>'
      }
      if (e.showSummary && cols.length) {
        var sspan = Math.max(0, Math.min(e.summarySpan || 0, cols.length))
        t += '<tr>'
        if (sspan > 0) {
          t += '<td colspan="' + sspan + '" style="border:1px solid ' + bc + ';padding:1.2mm 1.5mm;text-align:right;font-weight:bold">' + esc(e.summaryLabel || '合计：') + '</td>'
        }
        for (var i = sspan; i < cols.length; i++) {
          var sc = cols[i]
          var scell = ''
          if ((e.sumFields || []).indexOf(sc.field) >= 0) {
            var sum = 0
            for (var rr = 0; rr < rows.length; rr++) sum += Number(get(rows[rr], sc.field)) || 0
            scell = String(sum)
          }
          t += '<td style="border:1px solid ' + bc + ';padding:1.2mm 1.5mm;text-align:' + (sc.align || 'center') + ';font-weight:bold">' + scell + '</td>'
        }
        t += '</tr>'
      }
      t += '</tbody></table>'
      html += '<div' + at(e) + ' style="' + st(e) + '">' + t + '</div>'
    }
  }
  return html
}

export { __peRuntime }
