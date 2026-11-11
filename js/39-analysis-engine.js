/* EducMind · js/39-analysis-engine.js
   Phân tích kết quả bài làm theo bảy mức: dữ liệu, bộ lọc, tóm tắt theo mục tiêu. */
/* ===== Đợt 12: hợp nhất “Phân tích bài kiểm tra” vào Bài tập và Chấm điểm =====
   Một máy phân tích dùng chung cho lượt làm bài kiểm tra và bài nộp bài tập (kể cả lượt cũ),
   chạy cho cả lớp hoặc từng học sinh; mỗi kết quả / lượt làm có sẵn cụm chức năng đi kèm. */
const LVS = [['Chấm trắc nghiệm tự động', 'R'], ['Thống kê điểm và phân tích câu trả lời sai', 'R'], ['Gắn lỗi với Learning Objective', 'R'], ['Tạo nhận xét tổng quan theo kết quả', 'AI'], ['AI hỗ trợ chấm tự luận theo rubric', 'AI'], ['AI phân tích lỗi lập luận chi tiết', 'AI'], ['Đề xuất bài tập cá nhân hóa từ lỗi', 'AI']];
const RUB = [['Đúng trọng tâm mục tiêu', .5], ['Có giải thích hoặc ví dụ', .3], ['Trình bày đủ ý, mạch lạc', .2]];
let anLvQ = 1, anLvA = 1, anWho = 'class';
const lastAtt = s => { const a = (s.atts || []).filter(t => !t.seed && t.ans && t.sc); return a[a.length - 1] };
const ansTxt = (q, a) => a == null || a === '' ? '(bỏ trống)' : Array.isArray(a) ? (a.map(m => q.opts[m]).join('; ') || '(bỏ trống)') : isObj(q) ? (q.opts[a] || '(bỏ trống)') : String(a);
const tr = a => '<tr>' + a.map(x => `<td>${x}</td>`).join('') + '</tr>';
const tbl = (h, r) => `<div class='tablewrap' style='margin-top:12px'><table><thead><tr>${h.map(x => `<th scope='col'>${x}</th>`).join('')}</tr></thead><tbody>${r.join('')}</tbody></table></div>`;
function anSetLv(k, l) { if (k === 'quiz') anLvQ = l; else anLvA = l; render() }
function anSetWho(v) { anWho = v; render() }
const anWrong = (row, x) => row.sc[x.qid] != null && row.sc[x.qid] < x.w;
const anName = (c, kind, ai) => kind === 'quiz' ? c.quiz.name : (c.assignments[ai] || { name: '' }).name;
const anK = (kind, ai, r, qid) => `"${kind}",${ai},${r.si},"${r.key}"` + (qid ? `,"${qid}"` : '');
function anItems(c, kind, ai) {
  if (kind === 'quiz') return c.quiz.deleted ? [] : c.quiz.qs.map(x => { const q = qOf(c, x.qid); return { qid: x.qid, w: x.w, objs: q ? q.objs : [] } });
  const a = c.assignments[ai]; if (!a) return [];
  return (a.qs || []).map(x => { const q = qOf(c, x.qid); return { qid: x.qid, w: x.w, objs: q ? q.objs : [] } });
}
function anRows(c, kind, ai) {
  const out = [];
  if (kind === 'quiz') {
    if (c.quiz.deleted) return out;
    c.students.forEach((s, si) => s.atts.forEach((t, k) => {
      if (!t.ans || !t.sc) return;
      out.push({ s, si, key: 'k' + k, tag: 'Lượt ' + t.n + (t.seed ? ' (mẫu)' : ''), status: t.status, total: t.total, max: qMax(c), sc: t.sc, ans: t.ans, fb: t.fb, store: t, cur: k === s.atts.length - 1, k });
    }));
    return out;
  }
  const a = c.assignments[ai]; if (!a) return out;
  const items = anItems(c, 'asg', ai); if (!items.length) return out;
  c.students.forEach((s, si) => {
    const b = a.subs[si]; if (!b || !b.has) return;
    const mk = (qa, tag, cur, key) => {
      if (!qa || !qa.length) return;
      const sc = {}, ans = {}, fb = {};
      qa.forEach((x, i) => { const it = items[i]; if (!it) return; sc[it.qid] = x.got; ans[it.qid] = x.a; fb[it.qid] = x.fb });
      out.push({ s, si, key, tag, status: b.score != null ? 'GRADED' : 'SUBMITTED', total: b.score, max: a.max, sc, ans, fb, store: cur ? b : null, cur, qa });
    };
    (b.hist || []).forEach((hh, idx) => mk(hh.qa, 'Lượt cũ ' + (idx + 1), false, 'h' + idx));
    mk(b.qa, 'Lượt hiện tại', true, 'cur');
  });
  return out;
}
const anPick = (c, kind, ai, si, key) => anRows(c, kind, ai).filter(r => r.si === si && r.key === key)[0] || null;
const anFilter = (c, rows) => anWho === 'class' ? rows.filter(r => r.cur) : rows.filter(r => r.si === +anWho);
function anObjR(items, row) {
  const o = {};
  items.forEach(x => { const g = row.sc[x.qid]; if (g == null) return; (x.objs || []).forEach(j => { const a = o[j] || (o[j] = [0, 0]); a[0] += g / (x.objs.length || 1); a[1] += x.w / (x.objs.length || 1) }) });
  return o;
}
function anSummary(c, items, row) {
  const R = anObjR(items, row), ks = Object.keys(R).map(Number);
  const tot = Object.values(row.sc).filter(v => v != null).reduce((a, b) => a + b, 0);
  const ok = ks.filter(j => R[j][1] && R[j][0] / R[j][1] >= .7).map(j => codeOf(c, j));
  const bad = ks.filter(j => R[j][1] && R[j][0] / R[j][1] < .5).map(j => codeOf(c, j));
  return 'Em đạt ' + tot.toFixed(1) + '/' + row.max + ' điểm' + (row.status === 'GRADED' ? '' : ' (tạm tính, còn câu chờ chấm)') + '. ' + (ok.length ? 'Em làm tốt ở ' + ok.join(', ') + '. ' : '') + (bad.length ? 'Em nên ôn lại ' + bad.join(', ') + ' trước bài tiếp theo.' : 'Chưa có mục tiêu nào ở mức cần ôn.');
}
function anPers(c, s, items, row) {
  const R = anObjR(items, row);
  return Object.keys(R).map(Number).filter(j => R[j][1] && R[j][0] / R[j][1] < .7).map(j => {
    const g = recTarget(c, s, j, 'Luyện tập có mục tiêu') || recTarget(c, s, j, 'Ôn lại nội dung');
    return { goal: codeOf(c, j) + ' · ' + c.goals[j] + ' (đúng ' + Math.round(R[j][0] / R[j][1] * 100) + '%)', label: g ? g.label : 'chưa có nội dung phù hợp, nên tạo bài tập mới cho mục tiêu này' };
  });
}
function errType(q, a) {
  if (a == null || a === '' || (Array.isArray(a) && !a.length)) return ['Bỏ trống', 'Hỏi học sinh vì sao chưa trả lời; xem lại mức độ tự tin.'];
  if (q.type === 'MULTIPLE_CHOICE') { const m = q.ans.filter(z => !a.includes(z)).length, e = a.filter(z => !q.ans.includes(z)).length;
    return m && e ? ['Nhầm lẫn: vừa thiếu vừa thừa phương án', 'Cho học sinh phân loại lại từng phát biểu đúng hoặc sai.'] : m ? ['Thiếu đáp án đúng', 'Nhắc học sinh đọc hết các phương án trước khi chọn.'] : ['Chọn thừa phương án sai', 'Yêu cầu học sinh giải thích vì sao phương án thừa là sai.'] }
  const t = q.opts[a];
  return t === QOPT[1] ? ['Hiểu đúng một phần', 'Học sinh nắm ý chính nhưng thiếu điều kiện; cho ví dụ đối chiếu.'] : t === QOPT[2] ? ['Nhầm lẫn khái niệm', 'Đối chiếu lại định nghĩa trong bài học.'] : ['Chọn sai phương án', 'Ôn lại mục tiêu liên quan.'];
}
function aiEssay(c, x, text) {
  const q = qOf(c, x.qid), g = (c.goals[q.objs[0]] || q.content).toLowerCase(), tx = String(text || '').toLowerCase(), w = g.split(/\s+/).filter(z => z.length > 2), h = w.length ? w.filter(z => tx.includes(z)).length / w.length : 0;
  const v = [h >= .6 ? 1 : h >= .3 ? .5 : 0, /ví dụ|chẳng hạn/.test(tx) ? 1 : tx.length > 80 ? .5 : 0, tx.length >= 60 ? 1 : tx.length >= 25 ? .5 : 0];
  const total = Math.round(x.w * RUB.reduce((a, r, i) => a + r[1] * v[i], 0) * 10) / 10, miss = RUB.filter((r, i) => v[i] < 1).map(r => r[0].toLowerCase());
  return { v, total, cm: miss.length ? 'Cần bổ sung: ' + miss.join('; ') + '.' : 'Bài làm đáp ứng đủ các tiêu chí.' };
}
