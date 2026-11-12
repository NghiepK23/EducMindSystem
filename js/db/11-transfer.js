/* EducMind · js/db/11-transfer.js
   Dùng chung cho nhập/xuất dữ liệu:
     - Xuất Excel (.xlsx) bằng SheetJS (biến toàn cục XLSX).
     - Xuất Word (.doc) từ HTML (mở được bằng Microsoft Word / LibreOffice).
     - Đọc tệp Excel trả về ma trận dòng để các trang tự nhập.
   Tệp này chỉ có hàm thuần, không phụ thuộc trang nào. */

const DBTF = {
  /* Tải xuống một Blob với tên tệp đã cho. */
  download(blob, fileName) {
    const a = document.createElement('a'), url = URL.createObjectURL(blob);
    a.href = url; a.download = fileName; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 400);
  },
  /* Xuất Excel: sheets = [{ name, headers: [..], rows: [[..], ..] }]. */
  exportExcel(fileName, sheets) {
    if (typeof XLSX === 'undefined') throw new Error('Thư viện đọc/ghi Excel (SheetJS) chưa được nạp.');
    const wb = XLSX.utils.book_new();
    for (const s of sheets) {
      const ws = XLSX.utils.aoa_to_sheet([s.headers, ...s.rows]);
      ws['!cols'] = s.headers.map((_, i) => ({ wch: Math.min(50, Math.max(10, ...s.rows.map((r) => String(r[i] == null ? '' : r[i]).length + 2), s.headers[i].length + 2)) }));
      XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
    }
    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    DBTF.download(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), fileName);
  },
  /* Xuất Word (.doc): sections = [{ heading, text?, table?: { headers, rows } }]. */
  exportWord(fileName, title, sections) {
    const esc = (s) => h(String(s == null ? '' : s));
    const body = sections.map((s) => `<h2>${esc(s.heading)}</h2>${s.text ? `<p>${esc(s.text)}</p>` : ''}${s.table ? `<table border="1" cellspacing="0" cellpadding="4"><thead><tr>${s.table.headers.map((x) => `<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${s.table.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : ''}`).join('');
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:'Times New Roman',serif;font-size:13pt}h1{font-size:17pt}h2{font-size:14pt}table{border-collapse:collapse;width:100%}th{background:#eee}</style></head><body><h1>${esc(title)}</h1>${body}</body></html>`;
    DBTF.download(new Blob(['\ufeff', html], { type: 'application/msword' }), fileName);
  },
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
