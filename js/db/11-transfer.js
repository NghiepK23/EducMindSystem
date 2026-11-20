/* EducMind · js/db/11-transfer.js
   Dùng chung cho nhập/xuất dữ liệu:
     - Xuất Excel (.xlsx) THẬT: tự tạo tệp OOXML (không cần SheetJS để xuất), có màu, viền, căn lề, định dạng số,
       cố định hàng tiêu đề, bộ lọc, in ngang vừa khổ A4, lặp hàng tiêu đề khi in.
     - Xuất Word (.docx) THẬT: tự tạo tệp OOXML, có Quốc hiệu – Tiêu ngữ, bảng có viền, in đậm/nghiêng, căn lề,
       số trang, giấy dọc + phụ lục giấy ngang. Mở được bằng Word, Google Docs, LibreOffice, Word Online, điện thoại.
     - Đọc tệp Excel (SheetJS, biến toàn cục XLSX) trả về ma trận dòng để các trang tự nhập.
   Ô dữ liệu (cell) có thể là giá trị thường hoặc đối tượng:
     { v: giá trị, fmt: 'int'|'score'|'score2'|'pct', tone: 'good'|'warn'|'bad', bold: true, align: 'left'|'center'|'right' }
   Dòng bảng có thể là mảng ô, hoặc { section: 'Tiêu đề nhóm' } để chèn dòng chia nhóm.
   Các trang cũ truyền giá trị thường vẫn chạy như trước (tên tệp .doc được đổi thành .docx). */

const DBTF_COLOR = { navy: '1F3864', line: 'AEBBCC', zebra: 'F4F7FB', band: 'DCE6F1', meta: 'EAF0F8', section: 'D9E2F0', muted: '5B6B7F' };
const DBTF_TONE = { good: ['E2F0D9', '2F5D1E'], warn: ['FFF2CC', '7F6000'], bad: ['F8D7DA', '842029'] };
/* Định dạng số: z = mã định dạng Excel; text = chữ hiển thị trong Word (dấu phẩy thập phân kiểu Việt Nam). */
const DBTF_FMT = {
  int: { z: '0', text: (v) => String(Math.round(v)) },
  score: { z: '0.0', text: (v) => v.toFixed(1).replace('.', ',') },
  score2: { z: '0.00', text: (v) => v.toFixed(2).replace('.', ',') },
  pct: { z: '0%', text: (v) => Math.round(v * 100) + '%' },
};

/* Thoát ký tự cho XML (bỏ ký tự điều khiển không hợp lệ). */
function dbtfXml(s) {
  return String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function dbtfIsSection(r) { return r && !Array.isArray(r) && typeof r === 'object' && r.section != null; }
/* Chuẩn hóa một ô về dạng thống nhất cho cả Excel và Word. */
function dbtfCell(c) {
  const o = (c !== null && typeof c === 'object' && !Array.isArray(c) && 'v' in c) ? c : { v: c };
  const v = o.v == null ? '' : o.v;
  const num = typeof v === 'number' && isFinite(v);
  const f = DBTF_FMT[o.fmt];
  let text;
  if (v === '') text = '';
  else if (num && f) text = f.text(v);
  else if (num) text = Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100).replace('.', ',');
  else text = String(v);
  return { v, num, z: num && f ? f.z : undefined, text, tone: o.tone, bold: !!o.bold, align: o.align };
}

/* ================= ZIP không nén (đủ cho OOXML) ================= */
const DBZIP = (() => {
  let T = null;
  const crc = (b) => {
    if (!T) { T = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; } }
    let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = T[(c ^ b[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  };
  /* files = [{ name, data: chuỗi | Uint8Array }] → Uint8Array */
  function build(files) {
    const enc = new TextEncoder(), parts = [], central = [];
    let off = 0;
    const d = new Date();
    const dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF;
    const dd = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
    for (const f of files) {
      const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, c = crc(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, dt, true); lh.setUint16(12, dd, true); lh.setUint32(14, c, true); lh.setUint32(18, data.length, true);
      lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, 0, true); ch.setUint16(12, dt, true); ch.setUint16(14, dd, true); ch.setUint32(16, c, true);
      ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
      ch.setUint32(42, off, true);
      central.push(new Uint8Array(ch.buffer), name);
      off += 30 + name.length + data.length;
    }
    let csize = 0; central.forEach((x) => { csize += x.length; });
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, csize, true); e.setUint32(16, off, true);
    const all = [...parts, ...central, new Uint8Array(e.buffer)];
    const out = new Uint8Array(all.reduce((s, x) => s + x.length, 0));
    let p = 0; all.forEach((x) => { out.set(x, p); p += x.length; });
    return out;
  }
  return { build };
})();

/* ================= WORD (.docx) ================= */
const DBDOCX = (() => {
  const X = dbtfXml, C = DBTF_COLOR;
  const FONT = 'Times New Roman';
  const NS = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

  /* ---- ký tự nội tuyến ---- */
  const rpr = (o) => {
    let x = '';
    if (o.b) x += '<w:b/><w:bCs/>';
    if (o.i) x += '<w:i/><w:iCs/>';
    if (o.caps) x += '<w:caps/>';
    if (o.color) x += `<w:color w:val="${o.color}"/>`;
    if (o.sz) x += `<w:sz w:val="${Math.round(o.sz * 2)}"/><w:szCs w:val="${Math.round(o.sz * 2)}"/>`;
    return x ? `<w:rPr>${x}</w:rPr>` : '';
  };
  const r = (text, o = {}) => String(text == null ? '' : text).split('\t').map((seg, i) => (i ? `<w:r>${rpr(o)}<w:tab/></w:r>` : '') + (seg === '' ? '' : `<w:r>${rpr(o)}<w:t xml:space="preserve">${X(seg)}</w:t></w:r>`)).join('');
  /* ---- đoạn văn ---- */
  const p = (runs, o = {}) => {
    let x = '';
    if (o.keepNext) x += '<w:keepNext/>';
    if (o.pageBreakBefore) x += '<w:pageBreakBefore/>';
    if (o.bdr) x += `<w:pBdr>${o.bdr}</w:pBdr>`;
    if (o.tabs) x += `<w:tabs>${o.tabs}</w:tabs>`;
    x += `<w:spacing w:before="${o.before || 0}" w:after="${o.after == null ? 0 : o.after}"${o.line ? ` w:line="${o.line}" w:lineRule="${o.lineRule || 'auto'}"` : ''}/>`;
    if (o.ind) x += `<w:ind ${o.ind}/>`;
    if (o.jc) x += `<w:jc w:val="${o.jc}"/>`;
    if (o.markSz) x += `<w:rPr><w:sz w:val="${o.markSz}"/><w:szCs w:val="${o.markSz}"/></w:rPr>`;
    if (o.sect) x += o.sect;
    return `<w:p><w:pPr>${x}</w:pPr>${runs || ''}</w:p>`;
  };
  const spacer = (after = 100) => p('', { after, markSz: 8 });
  /* ---- bảng ---- */
  const bdrAll = (val, sz, color) => ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((k) => `<w:${k} w:val="${val}" w:sz="${sz}" w:space="0" w:color="${color}"/>`).join('');
  const tc = (w, inner, o = {}) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${o.span ? `<w:gridSpan w:val="${o.span}"/>` : ''}${o.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>` : ''}<w:vAlign w:val="${o.v || 'center'}"/></w:tcPr>${inner}</w:tc>`;
  const tr = (cells, o = {}) => `<w:tr><w:trPr><w:cantSplit/>${o.header ? '<w:tblHeader/>' : ''}</w:trPr>${cells}</w:tr>`;
  const tbl = (widths, rows, o = {}) => {
    const total = widths.reduce((a, b) => a + b, 0);
    const borders = o.noBorder ? bdrAll('nil', 0, 'auto') : bdrAll('single', 4, '7F8FA6');
    return `<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/>${o.center ? '<w:jc w:val="center"/>' : ''}<w:tblBorders>${borders}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="20" w:type="dxa"/><w:left w:w="85" w:type="dxa"/><w:bottom w:w="20" w:type="dxa"/><w:right w:w="85" w:type="dxa"/></w:tblCellMar><w:tblLook w:val="0000"/></w:tblPr><w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows}</w:tbl>`;
  };
  const splitWidths = (W, pcts) => { const sum = pcts.reduce((a, b) => a + b, 0); const w = pcts.map((x) => Math.floor(W * x / sum)); w[w.length - 1] += W - w.reduce((a, b) => a + b, 0); return w; };

  /* ---- bảng dữ liệu ---- */
  const dataTable = (t, W) => {
    const n = t.headers.length, al = t.align || [];
    let pcts = t.widths;
    if (!pcts) {
      pcts = t.headers.map((hd, i) => {
        let m = 0; t.rows.forEach((row) => { if (Array.isArray(row)) m = Math.max(m, dbtfCell(row[i]).text.length); });
        return Math.min(40, Math.max(Math.min(String(hd).length, 14), m, 4));
      });
    }
    const ws = splitWidths(W, pcts);
    const hdr = tr(t.headers.map((x, i) => tc(ws[i], p(r(x, { b: true, sz: 10.5 }), { jc: 'center', before: 30, after: 30 }), { fill: C.band })).join(''), { header: true });
    const cellX = (c, i, bg, bold) => {
      const o = dbtfCell(c), tone = o.tone && DBTF_TONE[o.tone];
      const txt = o.text === '' && t.dash !== false && !bold ? '—' : o.text;
      return tc(ws[i], p(r(txt, { b: bold || o.bold, sz: 10.5, color: tone ? tone[1] : undefined }), { jc: o.align || al[i] || (o.num ? 'center' : 'left'), before: 30, after: 30 }), { fill: tone ? tone[0] : bg });
    };
    let zi = 0;
    const body = t.rows.map((row) => {
      if (dbtfIsSection(row)) { zi = 0; return tr(tc(W, p(r(row.section, { b: true, sz: 10.5, color: C.navy }), { before: 30, after: 30 }), { fill: C.section, span: n })); }
      const bg = zi++ % 2 ? C.zebra : null;
      return tr(row.map((c, i) => cellX(c, i, bg, false)).join(''));
    }).join('');
    const sum = (t.summaryRows || []).map((row) => tr(row.map((c, i) => cellX(c, i, C.band, true)).join(''))).join('');
    return tbl(ws, hdr + body + sum) + spacer(120);
  };
  const kvTable = (rows, W) => {
    const ws = splitWidths(W, [30, 70]);
    return tbl(ws, rows.map(([l, v]) => tr(tc(ws[0], p(r(l, { b: true, sz: 11 }), { before: 30, after: 30 }), { fill: C.meta }) + tc(ws[1], p(r(v == null || v === '' ? '—' : v, { sz: 11 }), { before: 30, after: 30 })))).join('')) + spacer(120);
  };
  const kpiTable = (items, cols, W) => {
    const per = cols || Math.min(4, items.length) || 1, ws = splitWidths(W, new Array(per).fill(1));
    let rows = '';
    for (let i = 0; i < items.length; i += per) {
      const chunk = items.slice(i, i + per); while (chunk.length < per) chunk.push(null);
      rows += tr(chunk.map((k, j) => k
        ? tc(ws[j], p(r(k.value == null || k.value === '' ? '—' : k.value, { b: true, sz: 18, color: C.navy }), { jc: 'center', before: 60 }) + p(r(k.label, { b: true, sz: 10.5 }), { jc: 'center' }) + p(r(k.note || '', { sz: 9, color: C.muted }), { jc: 'center', after: 60 }), { fill: C.meta })
        : tc(ws[j], p('', {}))).join(''));
    }
    return tbl(ws, rows) + spacer(120);
  };
  const sigTable = (sigs, recips, W) => {
    const ws = splitWidths(W, new Array(sigs.length).fill(1));
    const cells = sigs.map((x, i) => {
      const o = typeof x === 'string' ? { title: x } : x;
      return tc(ws[i], p(r(o.title, { b: true, sz: 12 }), { jc: 'center', keepNext: true }) + p(r(o.note || '(Ký, ghi rõ họ tên)', { i: true, sz: 11 }), { jc: 'center', keepNext: true }) + p('', { before: 700 }) + p(r(o.name || '', { b: true, sz: 12 }), { jc: 'center' }), { v: 'top' });
    }).join('');
    let out = p('', { after: 120, keepNext: true }) + tbl(ws, tr(cells), { noBorder: true });
    if (recips && recips.length) {
      out += p(r('Nơi nhận:', { b: true, i: true, sz: 11 }), { before: 160, keepNext: true }) + recips.map((x) => p(r('- ' + x, { sz: 11 }), {})).join('');
    }
    return out;
  };

  /* ---- một mục nội dung ---- */
  const sectionXml = (s, first, W) => {
    let out = '';
    if (s.heading) out += p(r(s.heading, { b: true, sz: 13 }), { keepNext: true, before: 200, after: 80, pageBreakBefore: !!(s.pageBreak && !first) });
    const body = (text) => p(r(text, { sz: 13 }), { jc: 'both', after: 100, line: 300, ind: 'w:firstLine="567"' });
    if (s.text) out += body(s.text);
    (s.paragraphs || []).forEach((x) => { out += body(x); });
    if (s.keyValue) out += kvTable(s.keyValue, W);
    if (s.kpis && s.kpis.length) out += kpiTable(s.kpis, s.kpiCols, W);
    if (s.table) out += dataTable(s.table, W);
    (s.tables || []).forEach((t) => { out += dataTable(t, W); });
    if (s.bullets && s.bullets.length) out += s.bullets.map((b) => p(r('–\t' + b, { sz: 13 }), { jc: 'both', after: 60, line: 300, tabs: '<w:tab w:val="left" w:pos="567"/>', ind: 'w:left="567" w:hanging="283"' })).join('');
    if (s.fillLabel) out += p(r(s.fillLabel, { i: true, sz: 13 }), { before: 80, keepNext: true });
    if (s.fillLines) out += Array.from({ length: s.fillLines }, () => p('', { before: 0, after: 0, line: 440, lineRule: 'exact', keepNext: true, bdr: '<w:bottom w:val="dotted" w:sz="6" w:space="1" w:color="000000"/>' })).join('');
    if (s.note) out += p(r(s.note, { i: true, sz: 10, color: C.muted }), { after: 100 });
    if (s.signatures) out += sigTable(s.signatures, s.recipients, W);
    return out;
  };

  /* ---- đầu văn bản ---- */
  const lineBelow = (ind) => p('', { markSz: 4, after: 40, ind: `w:left="${ind}" w:right="${ind}"`, bdr: '<w:bottom w:val="single" w:sz="6" w:space="1" w:color="000000"/>' });
  const mastheadXml = (title, o, W) => {
    const sub = o.subtitle || '';
    if (o.official) {
      const ws = splitWidths(W, [42, 58]);
      const left = (o.parentOrg ? p(r(o.parentOrg, { sz: 12 }), { jc: 'center' }) : '') + p(r(o.orgName || 'TRƯỜNG ......................................', { b: true, sz: 12 }), { jc: 'center' }) + lineBelow(1300);
      const right = p(r('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { b: true, sz: 12 }), { jc: 'center' }) + p(r('Độc lập – Tự do – Hạnh phúc', { b: true, sz: 13 }), { jc: 'center' }) + lineBelow(1700);
      const docNo = o.docNo ? (/^\s*Số/i.test(o.docNo) ? o.docNo : 'Số: ' + o.docNo) : 'Số: ……… /BC-………';
      const row2 = tc(ws[0], p(r(docNo, { sz: 12 }), { jc: 'center', before: 60 })) + tc(ws[1], p(r(o.placeDate || '..........., ngày ..... tháng ..... năm .....', { i: true, sz: 12 }), { jc: 'center', before: 60 }));
      return tbl(ws, tr(tc(ws[0], left, { v: 'top' }) + tc(ws[1], right, { v: 'top' })) + tr(row2), { noBorder: true })
        + p(r(title, { b: true, sz: 15 }), { jc: 'center', before: 280, after: 40 })
        + (sub ? p(r(sub, { b: true, sz: 12 }), { jc: 'center', after: 120 }) : '')
        + (o.recipient ? p(r('Kính gửi: ', { b: true, sz: 13 }) + r(o.recipient, { sz: 13 }), { jc: 'center', before: 120, after: 160 }) : '');
    }
    return p(r(o.orgName || 'TRƯỜNG: ............................................................', { b: true, sz: 12, color: C.muted }), { jc: 'center' })
      + p(r(o.docLabel || 'BÁO CÁO', { b: true, sz: 11, color: C.navy }), { jc: 'center', before: 200, after: 40 })
      + p(r(title, { b: true, sz: 20, color: C.navy }), { jc: 'center', after: 40, bdr: `<w:bottom w:val="single" w:sz="12" w:space="4" w:color="${C.navy}"/>` })
      + (sub ? p(r(sub, { sz: 12, color: C.muted }), { jc: 'center', before: 80, after: 160 }) : '')
      + (o.metadata && o.metadata.length ? kvTable(o.metadata, W) : '');
  };

  /* ---- ghép tài liệu ---- */
  const PAGE = { p: { w: 11906, h: 16838, t: 1134, b: 1134, l: 1701, r: 850 }, l: { w: 16838, h: 11906, t: 1021, b: 1021, l: 1134, r: 850 } };
  const sectPr = (land) => { const g = land ? PAGE.l : PAGE.p; return `<w:sectPr><w:footerReference w:type="default" r:id="rId3"/><w:pgSz w:w="${g.w}" w:h="${g.h}"${land ? ' w:orient="landscape"' : ''}/><w:pgMar w:top="${g.t}" w:right="${g.r}" w:bottom="${g.b}" w:left="${g.l}" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr>`; };
  const widthOf = (land) => { const g = land ? PAGE.l : PAGE.p; return g.w - g.l - g.r; };

  function build(title, sections, o) {
    const segs = [];
    sections.forEach((s) => { const l = !!s.landscape, last = segs[segs.length - 1]; if (!last || last.land !== l) segs.push({ land: l, items: [s] }); else last.items.push(s); });
    if (!segs.length) segs.push({ land: false, items: [] });
    let body = '';
    segs.forEach((g, gi) => {
      const W = widthOf(g.land);
      if (gi === 0) body += mastheadXml(title, o, W);
      g.items.forEach((s, i) => { body += sectionXml(s, i === 0, W); });
      if (gi === segs.length - 1) {
        if (o.signatures) body += sigTable(o.signatures, o.recipients, W);
        const fn = o.footnote != null ? o.footnote : 'Báo cáo được trích xuất từ hệ thống EducMind ngày ' + (o.generatedAt || '') + '. Vui lòng đối chiếu dữ liệu trước khi ký duyệt và lưu hành.';
        if (fn) body += p(r(fn, { i: true, sz: 9, color: C.muted }), { before: 240, bdr: '<w:top w:val="single" w:sz="4" w:space="4" w:color="AEBBCC"/>' });
        body += sectPr(g.land);
      } else body += p('', { sect: sectPr(g.land), markSz: 4 });
    });
    const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NS}><w:body>${body}</w:body></w:document>`;
    const footerText = o.footerText || title;
    const fld = (code) => `<w:fldSimple w:instr=" ${code} "><w:r>${rpr({ sz: 9, color: C.muted })}<w:t>1</w:t></w:r></w:fldSimple>`;
    const footer = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr ${NS}>${p(r(footerText + ' · Trang ', { sz: 9, color: C.muted }) + fld('PAGE') + r('/', { sz: 9, color: C.muted }) + fld('NUMPAGES'), { jc: 'center' })}</w:ftr>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${NS}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${FONT}" w:hAnsi="${FONT}" w:eastAsia="${FONT}" w:cs="${FONT}"/><w:sz w:val="26"/><w:szCs w:val="26"/><w:lang w:val="vi-VN" w:eastAsia="vi-VN" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style><w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:uiPriority w:val="99"/><w:semiHidden/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style></w:styles>`;
    const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    const files = [
      { name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>' },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>' },
      { name: 'word/_rels/document.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>' },
      { name: 'word/document.xml', data: doc },
      { name: 'word/styles.xml', data: styles },
      { name: 'word/footer1.xml', data: footer },
      { name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${X(title)}</dc:title><dc:creator>${X(o.author || 'EducMind')}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created></cp:coreProperties>` },
    ];
    return DBZIP.build(files);
  }
  return { build };
})();

/* ================= EXCEL (.xlsx) ================= */
const DBXLSX = (() => {
  const X = dbtfXml;
  const colName = (i) => { let s = '', n = i + 1; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
  const BUILTIN_Z = { '0': 1, '0.00': 2, '0%': 9 };

  /* Bảng kiểu: gom các kiểu ô trùng nhau. */
  function Styles() {
    const fonts = ['<font><sz val="11"/><name val="Times New Roman"/><family val="1"/></font>'];
    const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
    const borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
    const numFmts = [], xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
    const maps = { font: {}, fill: {}, border: {}, xf: {}, z: {} };
    const pushOnce = (map, arr, key, xml) => { if (map[key] == null) { arr.push(xml); map[key] = arr.length - 1; } return map[key]; };
    const edge = (tag, c) => `<${tag} style="thin"><color rgb="FF${c}"/></${tag}>`;
    function get(sp) {
      if (!sp || !Object.keys(sp).length) return 0;
      const fkey = [sp.b ? 1 : 0, sp.i ? 1 : 0, sp.sz || 11, sp.color || '', sp.name || ''].join('|');
      const fontId = pushOnce(maps.font, fonts, fkey, `<font>${sp.b ? '<b/>' : ''}${sp.i ? '<i/>' : ''}<sz val="${sp.sz || 11}"/>${sp.color ? `<color rgb="FF${sp.color}"/>` : ''}<name val="${sp.name || 'Times New Roman'}"/><family val="1"/></font>`);
      const fillId = sp.fill ? pushOnce(maps.fill, fills, sp.fill, `<fill><patternFill patternType="solid"><fgColor rgb="FF${sp.fill}"/><bgColor indexed="64"/></patternFill></fill>`) : 0;
      let borderId = 0;
      if (sp.border === 'all') borderId = pushOnce(maps.border, borders, 'all', `<border>${edge('left', DBTF_COLOR.line)}${edge('right', DBTF_COLOR.line)}${edge('top', DBTF_COLOR.line)}${edge('bottom', DBTF_COLOR.line)}<diagonal/></border>`);
      else if (sp.border === 'bottom') borderId = pushOnce(maps.border, borders, 'bottom', '<border><left/><right/><top/><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border>');
      let z = 0;
      if (sp.z) { z = BUILTIN_Z[sp.z] != null ? BUILTIN_Z[sp.z] : (maps.z[sp.z] != null ? maps.z[sp.z] : (maps.z[sp.z] = 164 + numFmts.length, numFmts.push(`<numFmt numFmtId="${maps.z[sp.z]}" formatCode="${X(sp.z)}"/>`), maps.z[sp.z])); }
      const align = (sp.h || sp.v || sp.wrap) ? `<alignment${sp.h ? ` horizontal="${sp.h}"` : ''}${sp.v ? ` vertical="${sp.v}"` : ''}${sp.wrap ? ' wrapText="1"' : ''}/>` : '';
      const xkey = [z, fontId, fillId, borderId, sp.h || '', sp.v || '', sp.wrap ? 1 : 0].join('|');
      return pushOnce(maps.xf, xfs, xkey, `<xf numFmtId="${z}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"${align ? ' applyAlignment="1">' + align + '</xf>' : '/>'}`);
    }
    function xml() {
      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${numFmts.length ? `<numFmts count="${numFmts.length}">${numFmts.join('')}</numFmts>` : ''}<fonts count="${fonts.length}">${fonts.join('')}</fonts><fills count="${fills.length}">${fills.join('')}</fills><borders count="${borders.length}">${borders.join('')}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
    }
    return { get, xml };
  }

  /* Dựng lưới ô của một trang tính (độc lập với định dạng tệp). */
  function grid(s, si, o) {
    const heads = s.headers, nHead = heads.length, ncol = Math.max(nHead, 2), labelSpan = nHead >= 4 ? 2 : 1;
    const rows = [], merges = [];
    const R = (ht) => { rows.push({ ht: ht || null, cells: {} }); return rows.length - 1; };
    const put = (r, c, v, st) => { rows[r].cells[c] = { v, st: st || {} }; };
    const span = (r, c0, c1, v, st) => { for (let c = c0; c <= c1; c++) put(r, c, c === c0 ? v : '', st); if (c1 > c0) merges.push([r, c0, c1]); };
    const body = s.rows.map((rw) => (dbtfIsSection(rw) ? rw : rw.map(dbtfCell)));
    const widths = [];
    for (let i = 0; i < ncol; i++) {
      if (s.widths && s.widths[i]) { widths.push(s.widths[i]); continue; }
      let longest = 0; body.forEach((rw) => { if (Array.isArray(rw) && rw[i]) longest = Math.max(longest, rw[i].text.length); });
      widths.push(Math.min(50, Math.max(9, Math.min(String(heads[i] == null ? '' : heads[i]).length, 18) + 3, longest + 3)));
    }
    const totalW = widths.reduce((a, b) => a + b, 0);
    const lines = (text, w) => Math.max(1, Math.ceil(String(text).length / Math.max(8, w)));
    const BLK = '000000';

    /* đầu trang: Quốc hiệu + đơn vị (văn bản chính thức) hoặc tên đơn vị */
    if (o.official) {
      let acc = 0, mid = 1; while (mid < ncol - 1 && acc + widths[mid - 1] < totalW * 0.4) { acc += widths[mid - 1]; mid++; }
      const r0 = R(32);
      span(r0, 0, mid - 1, o.parentOrg || '', { sz: 11, h: 'center', v: 'center', wrap: true });
      span(r0, mid, ncol - 1, 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { b: true, sz: 11, h: 'center', v: 'center', wrap: true });
      const r1 = R(20);
      span(r1, 0, mid - 1, o.orgName || 'TRƯỜNG ......................', { b: true, sz: 11, h: 'center', v: 'center', border: 'bottom' });
      span(r1, mid, ncol - 1, 'Độc lập – Tự do – Hạnh phúc', { b: true, sz: 12, h: 'center', v: 'center', border: 'bottom' });
      const r2 = R(20);
      const docNo = o.docNo ? (/^\s*Số/i.test(o.docNo) ? o.docNo : 'Số: ' + o.docNo) : 'Số: ……… /BC-………';
      span(r2, 0, mid - 1, docNo, { sz: 11, h: 'center', v: 'center' });
      span(r2, mid, ncol - 1, o.placeDate || '', { i: true, sz: 11, h: 'center', v: 'center' });
      R(8);
    } else if (o.orgName) { span(R(20), 0, ncol - 1, o.orgName, { b: true, sz: 11, color: DBTF_COLOR.muted, h: 'left', v: 'center' }); }
    span(R(30), 0, ncol - 1, s.title || o.title || 'BÁO CÁO', { b: true, sz: 16, color: BLK, h: 'center', v: 'center' });
    const subtitle = s.subtitle != null ? s.subtitle : (o.subtitle || '');
    if (subtitle) span(R(20), 0, ncol - 1, subtitle, { i: true, sz: 11, color: DBTF_COLOR.muted, h: 'center', v: 'center' });
    if (si === 0 && o.metadata && o.metadata.length) {
      R(8);
      o.metadata.forEach(([label, value]) => {
        const r = R(17 * lines(value == null ? '' : value, totalW - widths.slice(0, labelSpan).reduce((a, b) => a + b, 0)) + 2);
        span(r, 0, labelSpan - 1, label, { b: true, fill: DBTF_COLOR.meta, border: 'all', h: 'left', v: 'center' });
        span(r, labelSpan, ncol - 1, value == null ? '' : String(value), { border: 'all', h: 'left', v: 'center', wrap: true });
      });
    }
    R(10);

    /* bảng chính */
    const headIdx = R(34);
    heads.forEach((x, c) => put(headIdx, c, x, { b: true, color: 'FFFFFF', fill: DBTF_COLOR.navy, border: 'all', h: 'center', v: 'center', wrap: true }));
    const firstBody = rows.length; let lastBody = firstBody - 1, hasSection = false, zebra = 0;
    const bodyRow = (cells, sum, zb) => {
      let est = 1;
      cells.forEach((o2, c) => { if (!o2.num) est = Math.max(est, lines(o2.text, widths[c])); });
      const r = R(Math.max(18, est * 15 + 3));
      cells.forEach((o2, c) => {
        const tone = o2.tone && DBTF_TONE[o2.tone];
        put(r, c, o2.num ? o2.v : o2.text, {
          b: sum || o2.bold, color: tone ? tone[1] : undefined, border: 'all', v: 'center', wrap: !o2.num, z: o2.z,
          h: o2.align || (s.align && s.align[c]) || (o2.num ? 'center' : 'left'),
          fill: sum ? DBTF_COLOR.band : (tone ? tone[0] : (zb ? DBTF_COLOR.zebra : undefined)),
        });
      });
      return r;
    };
    body.forEach((rw) => {
      if (dbtfIsSection(rw)) { hasSection = true; zebra = 0; span(R(20), 0, ncol - 1, rw.section, { b: true, color: DBTF_COLOR.navy, fill: DBTF_COLOR.section, border: 'all', h: 'left', v: 'center' }); }
      else { bodyRow(rw, false, zebra++ % 2 === 1); lastBody = rows.length - 1; }
    });
    (s.summaryRows || []).forEach((rw) => bodyRow(rw.map(dbtfCell), true, false));
    if (s.notes && s.notes.length) {
      R(8);
      s.notes.forEach((n) => span(R(15 * lines(n, totalW) + 3), 0, ncol - 1, n, { i: true, sz: 9, color: DBTF_COLOR.muted, h: 'left', v: 'top', wrap: true }));
    }
    if (s.signBlock && o.signatures && o.signatures.length) {
      R(14);
      const n = o.signatures.length, sp = Math.max(1, Math.floor(ncol / n)), spans = o.signatures.map((_, i) => [i * sp, i === n - 1 ? ncol - 1 : i * sp + sp - 1]);
      const rt = R(20), rs = R(18); R(52); const rn = R(18);
      o.signatures.forEach((sg, i) => {
        const t = typeof sg === 'string' ? { title: sg } : sg;
        span(rt, spans[i][0], spans[i][1], t.title, { b: true, h: 'center', v: 'center' });
        span(rs, spans[i][0], spans[i][1], t.note || '(Ký, ghi rõ họ tên)', { i: true, sz: 10, h: 'center', v: 'center' });
        span(rn, spans[i][0], spans[i][1], t.name || '', { b: true, h: 'center', v: 'center' });
      });
    }
    const filter = nHead && lastBody >= firstBody && !hasSection && s.filter !== false ? [headIdx, lastBody, nHead - 1] : null;
    return { rows, merges, widths, headIdx, filter, ncol, freezeRows: headIdx <= 7 && lastBody >= firstBody ? headIdx + 1 : 0, freezeCols: s.freezeCols || 0, landscape: ncol >= 6 };
  }

  function build(sheets, o) {
    const st = Styles(), sst = [], sstMap = {};
    const si = (t) => { if (sstMap[t] == null) { sst.push(t); sstMap[t] = sst.length - 1; } return sstMap[t]; };
    const names = sheets.map((s) => s.name.replace(/[\[\]:*?\/\\]/g, ' ').slice(0, 31));
    const sheetXml = sheets.map((s, idx) => {
      const g = grid(s, idx, o);
      const rowsXml = g.rows.map((rw, ri) => {
        const cols = Object.keys(rw.cells).map(Number).sort((a, b) => a - b);
        const cx = cols.map((c) => {
          const cell = rw.cells[c], ref = colName(c) + (ri + 1), sid = st.get(cell.st), v = cell.v;
          if (typeof v === 'number' && isFinite(v)) return `<c r="${ref}" s="${sid}"><v>${v}</v></c>`;
          if (v === '' || v == null) return `<c r="${ref}" s="${sid}"/>`;
          return `<c r="${ref}" s="${sid}" t="s"><v>${si(String(v))}</v></c>`;
        }).join('');
        return `<row r="${ri + 1}"${rw.ht ? ` ht="${rw.ht}" customHeight="1"` : ''}>${cx}</row>`;
      }).join('');
      let pane = '';
      if (g.freezeRows || g.freezeCols) {
        const fr = g.freezeRows, fc = g.freezeCols, tl = colName(fc) + (fr + 1);
        const active = fr && fc ? 'bottomRight' : (fr ? 'bottomLeft' : 'topRight');
        pane = `<pane${fc ? ` xSplit="${fc}"` : ''}${fr ? ` ySplit="${fr}"` : ''} topLeftCell="${tl}" activePane="${active}" state="frozen"/>` + (fr && fc ? '<selection pane="topRight"/><selection pane="bottomLeft"/>' : '') + `<selection pane="${active}" activeCell="${tl}" sqref="${tl}"/>`;
      }
      const lastCol = colName(g.ncol - 1), lastRow = g.rows.length;
      const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><dimension ref="A1:${lastCol}${lastRow}"/><sheetViews><sheetView showGridLines="0"${idx === 0 ? ' tabSelected="1"' : ''} workbookViewId="0">${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${g.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w + 0.7}" customWidth="1"/>`).join('')}</cols><sheetData>${rowsXml}</sheetData>${g.filter ? `<autoFilter ref="A${g.filter[0] + 1}:${colName(g.filter[2])}${g.filter[1] + 1}"/>` : ''}${g.merges.length ? `<mergeCells count="${g.merges.length}">${g.merges.map(([r, c0, c1]) => `<mergeCell ref="${colName(c0)}${r + 1}:${colName(c1)}${r + 1}"/>`).join('')}</mergeCells>` : ''}<printOptions horizontalCentered="1"/><pageMargins left="0.5" right="0.5" top="0.7" bottom="0.7" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="${g.landscape ? 'landscape' : 'portrait'}" fitToWidth="1" fitToHeight="0"/><headerFooter><oddFooter>&amp;L${X(o.footerText || '')}&amp;RTrang &amp;P/&amp;N</oddFooter></headerFooter></worksheet>`;
      return { xml, g };
    });
    const quote = (n) => "'" + n.replace(/'/g, "''") + "'";
    const defined = [];
    sheetXml.forEach(({ g }, i) => {
      if (g.filter) defined.push(`<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">${X(quote(names[i]))}!$A$${g.filter[0] + 1}:$${colName(g.filter[2])}$${g.filter[1] + 1}</definedName>`);
      defined.push(`<definedName name="_xlnm.Print_Titles" localSheetId="${i}">${X(quote(names[i]))}!$${g.headIdx + 1}:$${g.headIdx + 1}</definedName>`);
    });
    const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${names.map((n, i) => `<sheet name="${X(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets><definedNames>${defined.join('')}</definedNames></workbook>`;
    const n = sheets.length, now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
    const files = [
      { name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>` },
      { name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>' },
      { name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId${n + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>` },
      { name: 'xl/workbook.xml', data: workbook },
      ...sheetXml.map(({ xml }, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: xml })),
      { name: 'xl/styles.xml', data: st.xml() },
      { name: 'xl/sharedStrings.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sst.length}" uniqueCount="${sst.length}">${sst.map((t) => `<si><t xml:space="preserve">${X(t)}</t></si>`).join('')}</sst>` },
      { name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${X(o.title || 'Báo cáo')}</dc:title><dc:creator>${X(o.author || 'EducMind')}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created></cp:coreProperties>` },
    ];
    return DBZIP.build(files);
  }
  return { build };
})();

const DBTF = {
  /* Tải xuống một Blob với tên tệp đã cho. */
  download(blob, fileName) {
    const a = document.createElement('a'), url = URL.createObjectURL(blob);
    a.href = url; a.download = fileName; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 400);
  },

  /* Xuất Excel (.xlsx).
     sheets = [{ name, headers, rows, title?, subtitle?, align?: [..], widths?: [..], summaryRows?: [[..]], notes?: [..],
                 filter?: false, signBlock?: true, freezeCols?: số cột cố định }].
     options = { title, subtitle, metadata: [[nhãn, giá trị]], official, parentOrg, orgName, docNo, placeDate, author, signatures, footerText }. */
  buildXlsx(sheets, options = {}) { return DBXLSX.build(sheets, options); },
  exportExcel(fileName, sheets, options = {}) {
    const bytes = DBTF.buildXlsx(sheets, options);
    DBTF.download(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName);
  },

  /* Xuất Word (.docx).
     sections = [{ heading?, text?, paragraphs?, bullets?, keyValue?: [[nhãn, giá trị]], kpis?: [{label,value,note}],
                   table?: { headers, rows, align?, widths?: [%], summaryRows?, dash? }, tables?, note?, fillLabel?, fillLines?,
                   signatures?, recipients?, landscape?: true, pageBreak?: true }]
     options = { subtitle, metadata, generatedAt, signatures, official, orgName, parentOrg, docNo, placeDate, recipient,
                 docLabel, footerText, footnote, author }. */
  buildDocx(title, sections, options = {}) { return DBDOCX.build(title, sections, options); },
  exportWord(fileName, title, sections, options = {}) {
    const bytes = DBTF.buildDocx(title, sections, options);
    DBTF.download(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), String(fileName).replace(/\.doc$/i, '.docx'));
  },

  /* ================= ĐỌC EXCEL ================= */
  /* Đọc tệp Excel (.xlsx/.xls/.csv) → [{ name, rows: [[..], ..] }]. */
  async readSheets(file) {
    if (typeof XLSX === 'undefined') throw new Error('Thư viện đọc/ghi Excel (SheetJS) chưa được nạp.');
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    return wb.SheetNames.map((name) => ({ name, rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', blankrows: false }) }));
  },
  /* Biến dòng đầu (tiêu đề) thành khóa; trả về danh sách đối tượng, khóa thường, đã bỏ dấu cách. */
  objects(rows) {
    if (!rows.length) return [];
    const heads = rows[0].map((x) => String(x).trim().toLowerCase());
    return rows.slice(1).map((r) => Object.fromEntries(heads.map((k, i) => [k, r[i]])));
  },
  /* Lấy giá trị của một trong các tên cột (hỗ trợ nhiều tên tiếng Việt). */
  pick(row, names) { for (const n of names) { const v = row[String(n).trim().toLowerCase()]; if (v != null && String(v).trim() !== '') return v; } return ''; },
};

/* Tên tệp xuất có ngày giờ để không ghi đè lẫn nhau. */
function dbExportName(base, ext) {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  return `${base}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.${ext}`;
}
/* Ngày dd/mm/yyyy từ ISO (bỏ phần giờ). */
function dbDate(v) {
  const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
}