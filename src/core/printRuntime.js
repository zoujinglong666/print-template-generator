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
    if (e.h) css += 'height:' + e.h + 'mm;'
    if (s.fontSize) css += 'font-size:' + s.fontSize + 'pt;'
    if (s.bold) css += 'font-weight:bold;'
    if (s.color) css += 'color:' + s.color + ';'
    if (s.align) css += 'text-align:' + s.align + ';'
    if (s.vAlign === 'middle') css += 'display:flex;align-items:center;'
    else if (s.vAlign === 'bottom') css += 'display:flex;align-items:flex-end;'
    return css
  }

  var html = ''
  var elements = (schema && schema.elements) || []
  /** 元素标识属性：id / 组 / 锚点跟随（布局后由 __peResolveAnchors 按 DOM 实测解析） */
  var ea = function (e) {
    var s = ' data-pe-id="' + esc(e.id) + '"'
    if (e.groupId) s += ' data-pe-group="' + esc(e.groupId) + '"'
    if (e.anchor) s += ' data-pe-anchor="' + esc(e.anchor) + '" data-pe-gap="' + (e.gapMm == null ? 4 : e.gapMm) + '"'
    return s
  }
  for (var n = 0; n < elements.length; n++) {
    var e = elements[n]
    if (!e) continue
    if (e.type === 'barcode') {
      var bcOut = __peBarcodeSvg(fill(e.value), e.format, {
        showText: e.showText !== false,
        fontSize: (e.style || {}).fontSize || 9
      })
      html += '<div' + ea(e) + ' style="' + st(e) + ';display:flex;align-items:center;justify-content:center;overflow:hidden">' +
        (bcOut.error ? '<span style="color:#c00;font-size:9pt;text-align:center">' + esc(bcOut.error) + '</span>' : bcOut.svg) + '</div>'
    } else if (e.type === 'qrcode') {
      var qrOut = __peQrSvg(fill(e.value), e.ecl || 'M')
      html += '<div' + ea(e) + ' style="' + st(e) + ';display:flex;align-items:center;justify-content:center;overflow:hidden">' +
        (qrOut.error ? '<span style="color:#c00;font-size:9pt;text-align:center">' + esc(qrOut.error) + '</span>' : qrOut.svg) + '</div>'
    } else if (e.type === 'title') {
      html += '<div' + ea(e) + ' style="' + st(e) + ';font-weight:bold;text-align:center;line-height:1.3">' + fill(e.text) + '</div>'
    } else if (e.type === 'text') {
      html += '<div' + ea(e) + ' style="' + st(e) + ';white-space:pre-wrap;word-break:break-all;line-height:1.4">' + fill(e.text).replace(/\n/g, '<br/>') + '</div>'
    } else if (e.type === 'labelValue') {
      html +=
        '<div' + ea(e) + ' style="' + st(e) + ';gap:1.5mm;white-space:nowrap">' +
        '<span style="font-weight:bold;color:#333;white-space:nowrap">' + fill(e.label) + '</span>' +
        '<span style="word-break:break-all;white-space:normal">' + fill(e.value) + '</span></div>'
    } else if (e.type === 'image') {
      var src = safeUrl(get(data, e.field))
      html += '<div' + ea(e) + ' style="' + st(e) + '">' + (src ? '<img src="' + esc(src) + '" style="width:100%;height:100%;object-fit:contain;display:block"/>' : '') + '</div>'
    } else if (e.type === 'line') {
      var ls = e.style || {}
      html += '<div' + ea(e) + ' style="' + st(e) + ';border-top:' + (ls.thickness || 1) + 'px solid ' + (ls.color || '#000') + '"></div>'
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
      html += '<div' + ea(e) + ' style="' + st(e) + '">' + t + '</div>'
    }
  }
  return html
}

/* ================= 条形码 / 二维码 编码器（自包含纯 JS，画布与导出共用） =================
 * 设计约束：无任何外部依赖 / 无 DOM 依赖，输出 SVG 字符串，
 * 保证应用内画布、打印预览、导出的独立 HTML 三端渲染结果完全一致。
 */

/* --- 条形码 --- */
/* Code128：全 107 个符号的位模式（1=黑 0=白，每符号 11 模块），标准 ISO/IEC 15417 */
var PE_CODE128_BARS = [
  '11011001100', '11001101100', '11001100110', '10010011000', '10010001100',
  '10001001100', '10011001000', '10011000100', '10001100100', '11001001000',
  '11001000100', '11000100100', '10110011100', '10011011100', '10011001110',
  '10111001100', '10011101100', '10011100110', '11001110010', '11001011100',
  '11001001110', '11011100100', '11001110100', '11101101110', '11101001100',
  '11100101100', '11100100110', '11101100100', '11100110100', '11100110010',
  '11011011000', '11011000110', '11000110110', '10100011000', '10001011000',
  '10001000110', '10110001000', '10001101000', '10001100010', '11010001000',
  '11000101000', '11000100010', '10110111000', '10110001110', '10001101110',
  '10111011000', '10111000110', '10001110110', '11101110110', '11010001110',
  '11000101110', '11011101000', '11011100010', '11011101110', '11101011000',
  '11101000110', '11100010110', '11101101000', '11101100010', '11100011010',
  '11101111010', '11001000010', '11110001010', '10100110000', '10100001100',
  '10010110000', '10010000110', '10000101100', '10000100110', '10110010000',
  '10110000100', '10011010000', '10011000010', '10000110100', '10000110010',
  '11000010010', '11001010000', '11110111010', '11000010100', '10001111010',
  '10100111100', '10010111100', '10010011110', '10111100100', '10011110100',
  '10011110010', '11110100100', '11110010100', '11110010010', '11011011110',
  '11011110110', '11110110110', '10101111000', '10100011110', '10001011110',
  '10111101000', '10111100010', '11110101000', '11110100010', '10111011110',
  '10111101110', '11101011110', '11110101110', '11010000100', '11010010000',
  '11010011100', '1100011101011'
]
/* Code39：字符集 + 9 元素位模式（十进制转二进制即模块序列，条空交替以条开头） */
var PE_CODE39_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%*'
var PE_CODE39_ENCS = [
  20957, 29783, 23639, 30485, 20951, 29813, 23669, 20855, 29789, 23645,
  29975, 23831, 30533, 22295, 30149, 24005, 21623, 29981, 23837, 22301,
  30023, 23879, 30545, 22343, 30161, 24017, 21959, 30065, 23921, 22385,
  29015, 18263, 29141, 17879, 29045, 18293, 17783, 29021, 18269, 17477,
  17489, 17681, 20753, 35770
]
/* EAN-13：L/G/R 数字编码、首位数字决定的 6+6 位奇偶结构 */
var PE_EAN13_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
var PE_EAN13_G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111']
var PE_EAN13_R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100']
var PE_EAN13_STRUCT = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']

function __peEscXml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** 生成条码模块位串（1=黑 0=白，不含静区）；失败返回 { error } */
function __peBarcodeBits(value, format) {
  var v = String(value == null ? '' : value)
  var f = String(format || 'CODE128').toUpperCase().replace('EAN-13', 'EAN13')
  var i, c
  if (f === 'CODE128' || f === 'CODE128B') {
    var codes = [104] // START B
    for (i = 0; i < v.length; i++) {
      c = v.charCodeAt(i)
      if (c < 32 || c > 126) return { error: 'CODE128 仅支持 ASCII 可打印字符（32-126）' }
      codes.push(c - 32)
    }
    var sum = codes[0]
    for (i = 1; i < codes.length; i++) sum += codes[i] * i
    codes.push(sum % 103)
    codes.push(106) // STOP
    var bits = ''
    for (i = 0; i < codes.length; i++) bits += PE_CODE128_BARS[codes[i]]
    return { bits: bits }
  }
  if (f === 'EAN13') {
    var d = v.replace(/\D/g, '')
    if (d.length === 12) {
      var s = 0
      for (i = 0; i < 12; i++) s += (i % 2 === 0 ? 1 : 3) * Number(d[i])
      d += String((10 - (s % 10)) % 10)
    }
    if (!/^\d{13}$/.test(d)) return { error: 'EAN13 需要 12 位（自动补校验位）或 13 位数字' }
    var struct = PE_EAN13_STRUCT[Number(d[0])]
    var eb = '101'
    for (i = 0; i < 6; i++) eb += (struct.charAt(i) === 'L' ? PE_EAN13_L : PE_EAN13_G)[Number(d.charAt(i + 1))]
    eb += '01010'
    for (i = 6; i < 12; i++) eb += PE_EAN13_R[Number(d.charAt(i + 1))]
    eb += '101'
    return { bits: eb }
  }
  if (f === 'CODE39') {
    var up = v.toUpperCase()
    for (i = 0; i < up.length; i++) {
      if (PE_CODE39_CHARS.indexOf(up.charAt(i)) < 0) {
        return { error: 'CODE39 仅支持 0-9、A-Z 与 - . 空格 $ / + %' }
      }
    }
    // 结构：START(*) + 每字符(位模式 + 窄空) + STOP(*)，与 jsbarcode 完全一致
    var cb2 = PE_CODE39_ENCS[PE_CODE39_CHARS.indexOf('*')].toString(2)
    for (i = 0; i < up.length; i++) {
      cb2 += PE_CODE39_ENCS[PE_CODE39_CHARS.indexOf(up.charAt(i))].toString(2) + '0'
    }
    cb2 += PE_CODE39_ENCS[PE_CODE39_CHARS.indexOf('*')].toString(2)
    return { bits: cb2 }
  }
  return { error: '不支持的条码格式：' + format }
}

/** 条形码 SVG（宽度自适应容器，保持纵横比） */
function __peBarcodeSvg(value, format, opts) {
  opts = opts || {}
  var r = __peBarcodeBits(value, format)
  if (r.error) return { error: r.error }
  var bits = r.bits
  var mw = 2 // 每模块基准像素宽
  var quiet = 10 // 静区（模块）
  var barH = 60
  var showText = opts.showText !== false
  var fs = opts.fontSize || 9
  var textH = showText ? Math.round(fs * 1.7) : 0
  var total = bits.length + quiet * 2
  var w = total * mw
  var h = barH + textH
  var rects = []
  for (var i = 0; i < bits.length; i++) {
    if (bits.charAt(i) === '1') {
      rects.push('<rect x="' + (quiet + i) * mw + '" y="0" width="' + mw + '" height="' + barH + '"/>')
    }
  }
  var txt = ''
  if (showText) {
    txt = '<text x="' + w / 2 + '" y="' + (barH + textH * 0.76) + '" font-family="monospace" font-size="' + fs +
      '" text-anchor="middle" fill="#000">' + __peEscXml(value) + '</text>'
  }
  return {
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h +
      '" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges">' +
      '<g fill="#000">' + rects.join('') + '</g>' + txt + '</svg>'
  }
}

/* --- 二维码（字节模式，版本 1-10，容错 L/M/Q/H） --- */
/* 每版本每容错级：[每块 EC 码字数, 块1 数, 块1 数据码字, (块2 数, 块2 数据码字)] */
var PE_QR_EC_TABLE = {
  L: [[7, 1, 19], [10, 1, 34], [15, 1, 55], [20, 1, 80], [26, 1, 108], [18, 2, 68], [20, 2, 78], [24, 2, 97], [30, 2, 116], [18, 2, 68, 2, 69]],
  M: [[10, 1, 16], [16, 1, 28], [26, 1, 44], [18, 2, 32], [24, 2, 43], [16, 4, 27], [18, 4, 31], [22, 2, 38, 2, 39], [22, 3, 36, 2, 37], [26, 4, 43, 1, 44]],
  Q: [[13, 1, 13], [22, 1, 22], [18, 2, 17], [26, 2, 24], [18, 2, 15, 2, 16], [24, 4, 19], [18, 2, 14, 4, 15], [22, 4, 18, 2, 19], [20, 4, 16, 4, 17], [24, 6, 19, 2, 20]],
  H: [[17, 1, 9], [28, 1, 16], [22, 2, 13], [16, 4, 9], [22, 2, 11, 2, 12], [28, 4, 15], [26, 4, 13, 1, 14], [26, 4, 14, 2, 15], [24, 4, 12, 4, 13], [28, 6, 15, 2, 16]]
}
/* 每版本总码字数（v1-v10） */
var PE_QR_TOTAL_CODEWORDS = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346]
/* 每版本校正图形中心坐标（v1 无） */
var PE_QR_ALIGN = [[], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]]
/* 容错级 → 格式信息中的 2 位标识（L=01 M=00 Q=11 H=10） */
var PE_QR_ECL_BITS = { L: 1, M: 0, Q: 3, H: 2 }

var PE_QR_EXP = []
var PE_QR_LOG = []
;(function () {
  var x = 1
  for (var i = 0; i < 255; i++) {
    PE_QR_EXP[i] = x
    PE_QR_LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (i = 255; i < 512; i++) PE_QR_EXP[i] = PE_QR_EXP[i - 255]
})()
function __peGfMul(a, b) {
  return a === 0 || b === 0 ? 0 : PE_QR_EXP[PE_QR_LOG[a] + PE_QR_LOG[b]]
}
/** RS 生成多项式（系数低次在前） */
function __peQrGenPoly(degree) {
  var poly = []
  for (var i = 0; i < degree - 1; i++) poly.push(0)
  poly.push(1)
  var root = 1
  for (i = 0; i < degree; i++) {
    for (var j = 0; j < poly.length; j++) {
      poly[j] = __peGfMul(poly[j], root)
      if (j + 1 < poly.length) poly[j] ^= poly[j + 1]
    }
    root = __peGfMul(root, 2)
  }
  return poly
}
/** 计算数据块的 RS 纠错码（长度 = degree） */
function __peQrEcc(data, degree) {
  var divisor = __peQrGenPoly(degree)
  var res = divisor.map(function () { return 0 })
  for (var i = 0; i < data.length; i++) {
    var factor = data[i] ^ res.shift()
    res.push(0)
    for (var j = 0; j < divisor.length; j++) res[j] ^= __peGfMul(divisor[j], factor)
  }
  return res
}
function __peUtf8Bytes(s) {
  var out = []
  for (var i = 0; i < s.length; i++) {
    var c = s.charCodeAt(i)
    if (c < 0x80) out.push(c)
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63))
    else if (c >= 0xd800 && c < 0xdc00 && i + 1 < s.length) {
      var c2 = s.charCodeAt(i + 1)
      var cp = ((c - 0xd800) << 10) + (c2 - 0xdc00) + 0x10000
      out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63))
      i++
    } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
  }
  return out
}
/** 版本 + 容错级下的数据码字容量 */
function __peQrCapacity(version, level) {
  var t = PE_QR_EC_TABLE[level][version - 1]
  var blocks = t[1]
  var data = t[2] * t[1]
  if (t.length > 3) {
    blocks += t[3]
    data += t[4] * t[3]
  }
  return { dataCodewords: data, ecPerBlock: t[0], blocks: blocks }
}
/** 二维码矩阵（nayuki 结构）：返回 { size, modules } 或 { error }；forceMask 仅供测试强制掩码 */
function __peQrEncode(text, ecl, forceMask) {
  var level = PE_QR_ECL_BITS.hasOwnProperty(ecl) ? ecl : 'M'
  var eclBits = PE_QR_ECL_BITS[level]
  var data = __peUtf8Bytes(String(text == null ? '' : text))
  if (!data.length) return { error: '二维码内容为空' }
  var version = 0
  var v
  for (v = 1; v <= 10; v++) {
    // 容量须含模式指示位(4) + 字符计数位(8/16)，否则临界长度会溢出版本容量
    var countBits = v < 10 ? 8 : 16
    if (4 + countBits + data.length * 8 <= __peQrCapacity(v, level).dataCodewords * 8) { version = v; break }
  }
  if (!version) return { error: '内容过长：该容错级最多 ' + __peQrCapacity(10, level).dataCodewords + ' 字节' }

  // 位流：模式(4) + 字节数(8/16) + 数据 + 终止 + 补齐
  var cap = __peQrCapacity(version, level)
  var bb = []
  function push(val, len) {
    for (var i = len - 1; i >= 0; i--) bb.push((val >>> i) & 1)
  }
  push(4, 4)
  push(data.length, version < 10 ? 8 : 16)
  for (var i = 0; i < data.length; i++) push(data[i], 8)
  var capBits = cap.dataCodewords * 8
  push(0, Math.min(4, capBits - bb.length))
  push(0, (8 - (bb.length % 8)) % 8)
  var pads = [0xec, 0x11]
  for (var p = 0; bb.length < capBits; p++) push(pads[p % 2], 8)
  var dataCw = []
  for (i = 0; i < bb.length; i += 8) {
    var b = 0
    for (var j = 0; j < 8; j++) b = (b << 1) | bb[i + j]
    dataCw.push(b)
  }

  // 分块 + RS + 交织
  var t = PE_QR_EC_TABLE[level][version - 1]
  var blocks = []
  var idx = 0
  var groups = t.length > 3 ? [[t[1], t[2]], [t[3], t[4]]] : [[t[1], t[2]]]
  for (var g = 0; g < groups.length; g++) {
    for (var bi = 0; bi < groups[g][0]; bi++) {
      blocks.push(dataCw.slice(idx, idx + groups[g][1]))
      idx += groups[g][1]
    }
  }
  var ecBlocks = blocks.map(function (blk) { return __peQrEcc(blk, cap.ecPerBlock) })
  var codewords = []
  var maxLen = 0
  for (i = 0; i < blocks.length; i++) maxLen = Math.max(maxLen, blocks[i].length)
  for (i = 0; i < maxLen; i++) {
    for (var k = 0; k < blocks.length; k++) if (i < blocks[k].length) codewords.push(blocks[k][i])
  }
  for (i = 0; i < cap.ecPerBlock; i++) {
    for (k = 0; k < ecBlocks.length; k++) codewords.push(ecBlocks[k][i])
  }

  // 矩阵
  var size = version * 4 + 17
  var modules = []
  var isFunc = []
  for (var y = 0; y < size; y++) {
    modules.push([])
    isFunc.push([])
    for (var x = 0; x < size; x++) { modules[y].push(false); isFunc[y].push(false) }
  }
  function setFunc(x, y, dark) {
    modules[y][x] = dark
    isFunc[y][x] = true
  }
  function drawFinder(cx, cy) {
    for (var dy = -4; dy <= 4; dy++) {
      for (var dx = -4; dx <= 4; dx++) {
        var dist = Math.max(Math.abs(dx), Math.abs(dy))
        var xx = cx + dx
        var yy = cy + dy
        if (xx >= 0 && xx < size && yy >= 0 && yy < size) setFunc(xx, yy, dist !== 2 && dist !== 4)
      }
    }
  }
  // 先画定时图案，再画定位图形（后者覆盖前者边缘，符合标准绘制顺序）
  for (i = 0; i < size; i++) {
    setFunc(6, i, i % 2 === 0)
    setFunc(i, 6, i % 2 === 0)
  }
  drawFinder(3, 3); drawFinder(size - 4, 3); drawFinder(3, size - 4)
  var centers = PE_QR_ALIGN[version - 1]
  for (var ai = 0; ai < centers.length; ai++) {
    for (var aj = 0; aj < centers.length; aj++) {
      var ax = centers[ai]
      var ay = centers[aj]
      // 仅跳过与三个定位图形重叠的位置；中心落在定时线上的图案（v7+ 的 (6,mid)/(mid,6)）必须绘制
      if ((ax === 6 && ay === 6) || (ax === 6 && ay === size - 7) || (ax === size - 7 && ay === 6)) continue
      for (var dy2 = -2; dy2 <= 2; dy2++) {
        for (var dx2 = -2; dx2 <= 2; dx2++) {
          setFunc(ax + dx2, ay + dy2, Math.max(Math.abs(dx2), Math.abs(dy2)) !== 1)
        }
      }
    }
  }
  function formatBits(ecl2, mask) {
    var d = (ecl2 << 3) | mask
    var rem = d
    for (var i2 = 0; i2 < 10; i2++) rem = (rem << 1) ^ ((rem >> 9) * 0x537)
    return ((d << 10) | rem) ^ 0x5412
  }
  function drawFormat(mask) {
    var bits = formatBits(eclBits, mask)
    function bit(i2) { return ((bits >>> i2) & 1) !== 0 }
    for (i = 0; i <= 5; i++) setFunc(8, i, bit(i))
    setFunc(8, 7, bit(6)); setFunc(8, 8, bit(7)); setFunc(7, 8, bit(8))
    for (i = 9; i < 15; i++) setFunc(14 - i, 8, bit(i))
    for (i = 0; i <= 7; i++) setFunc(size - 1 - i, 8, bit(i))
    for (i = 8; i < 15; i++) setFunc(8, size - 15 + i, bit(i))
    setFunc(8, size - 8, true) // 固定黑模块
  }
  function drawVersion() {
    if (version < 7) return
    var rem = version
    for (var i2 = 0; i2 < 12; i2++) rem = (rem << 1) ^ ((rem >> 11) * 0x1f25)
    var bits = (version << 12) | rem
    for (i = 0; i < 18; i++) {
      var dark = ((bits >>> i) & 1) !== 0
      var a = size - 11 + (i % 3)
      var b2 = Math.floor(i / 3)
      setFunc(a, b2, dark); setFunc(b2, a, dark)
    }
  }
  drawFormat(0) // 占位，选定掩码后重画
  drawVersion()

  function placeData(mask) {
    var i2 = 0
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5
      for (var vert = 0; vert < size; vert++) {
        for (var j2 = 0; j2 < 2; j2++) {
          var xx = right - j2
          var upward = ((right + 1) & 2) === 0
          var yy = upward ? size - 1 - vert : vert
          if (!isFunc[yy][xx] && i2 < codewords.length * 8) {
            modules[yy][xx] = ((codewords[i2 >>> 3] >>> (7 - (i2 & 7))) & 1) !== 0
            i2++
          }
        }
      }
    }
  }
  function applyMask(mask) {
    for (var y2 = 0; y2 < size; y2++) {
      for (var x2 = 0; x2 < size; x2++) {
        if (isFunc[y2][x2]) continue
        var invert
        switch (mask) {
          case 0: invert = (x2 + y2) % 2 === 0; break
          case 1: invert = y2 % 2 === 0; break
          case 2: invert = x2 % 3 === 0; break
          case 3: invert = (x2 + y2) % 3 === 0; break
          case 4: invert = (Math.floor(y2 / 2) + Math.floor(x2 / 3)) % 2 === 0; break
          case 5: invert = (x2 * y2) % 2 + (x2 * y2) % 3 === 0; break
          case 6: invert = ((x2 * y2) % 2 + (x2 * y2) % 3) % 2 === 0; break
          default: invert = ((x2 + y2) % 2 + (x2 * y2) % 3) % 2 === 0; break
        }
        if (invert) modules[y2][x2] = !modules[y2][x2]
      }
    }
  }
  function penalty() {
    var score = 0
    var r, c
    for (r = 0; r < size; r++) {
      var runColor = modules[r][0]
      var runLen = 1
      for (c = 1; c < size; c++) {
        if (modules[r][c] === runColor) runLen++
        else {
          if (runLen >= 5) score += 3 + (runLen - 5)
          runColor = modules[r][c]
          runLen = 1
        }
      }
      if (runLen >= 5) score += 3 + (runLen - 5)
    }
    for (c = 0; c < size; c++) {
      runColor = modules[0][c]
      runLen = 1
      for (r = 1; r < size; r++) {
        if (modules[r][c] === runColor) runLen++
        else {
          if (runLen >= 5) score += 3 + (runLen - 5)
          runColor = modules[r][c]
          runLen = 1
        }
      }
      if (runLen >= 5) score += 3 + (runLen - 5)
    }
    for (r = 0; r < size - 1; r++) {
      for (c = 0; c < size - 1; c++) {
        var m = modules[r][c]
        if (m === modules[r][c + 1] && m === modules[r + 1][c] && m === modules[r + 1][c + 1]) score += 2
      }
    }
    var pat1 = [true, false, true, true, true, false, true, false, false, false, false]
    var pat2 = [false, false, false, false, true, false, true, true, true, false, true]
    function match(rr, cc, pat) {
      for (var i2 = 0; i2 < 11; i2++) if (modules[rr][cc + i2] !== pat[i2]) return false
      return true
    }
    for (r = 0; r < size; r++) {
      for (c = 0; c <= size - 11; c++) {
        if (match(r, c, pat1)) score += 40
        if (match(r, c, pat2)) score += 40
      }
    }
    for (c = 0; c < size; c++) {
      for (r = 0; r <= size - 11; r++) {
        var ok = true
        for (var i3 = 0; i3 < 11; i3++) if (modules[r + i3][c] !== pat1[i3]) { ok = false; break }
        if (ok) score += 40
        ok = true
        for (i3 = 0; i3 < 11; i3++) if (modules[r + i3][c] !== pat2[i3]) { ok = false; break }
        if (ok) score += 40
      }
    }
    var dark = 0
    for (r = 0; r < size; r++) for (c = 0; c < size; c++) if (modules[r][c]) dark++
    var total = size * size
    var k2 = Math.floor(Math.abs(dark * 100 / total - 50) / 5)
    score += k2 * 10
    return score
  }

  var bestMask = 0
  var bestPenalty = Infinity
  var best = null
  var maskList = forceMask == null ? [0, 1, 2, 3, 4, 5, 6, 7] : [forceMask]
  for (var mi = 0; mi < maskList.length; mi++) {
    var mask = maskList[mi]
    // 重置数据区后重新放置 + 掩码 + 格式位
    for (var yy2 = 0; yy2 < size; yy2++) {
      for (var xx2 = 0; xx2 < size; xx2++) if (!isFunc[yy2][xx2]) modules[yy2][xx2] = false
    }
    placeData(mask)
    applyMask(mask)
    drawFormat(mask)
    var s2 = penalty()
    if (s2 < bestPenalty) {
      bestPenalty = s2
      bestMask = mask
      best = modules.map(function (row) { return row.slice() })
    }
  }
  return { size: size, modules: best, mask: bestMask }
}

/** 二维码 SVG（四周 4 模块静区，宽度自适应容器） */
function __peQrSvg(value, ecl) {
  var r = __peQrEncode(value, ecl)
  if (r.error) return { error: r.error }
  var quiet = 4
  var dim = r.size + quiet * 2
  var rects = []
  for (var y = 0; y < r.size; y++) {
    var run = -1
    for (var x = 0; x <= r.size; x++) {
      var dark = x < r.size && r.modules[y][x]
      if (dark) {
        if (run < 0) run = x
      } else if (run >= 0) {
        rects.push('<rect x="' + (run + quiet) + '" y="' + (y + quiet) + '" width="' + (x - run) + '" height="1"/>')
        run = -1
      }
    }
  }
  return {
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + dim + ' ' + dim +
      '" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges">' +
      '<rect width="' + dim + '" height="' + dim + '" fill="#fff"/><g fill="#000">' + rects.join('') + '</g></svg>'
  }
}

export { __peRuntime, __peBarcodeSvg, __peQrSvg, __peBarcodeBits }
