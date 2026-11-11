/* EducMind · js/40-analysis-actions.js
   Thao tác trên từng kết quả: chấm lại, nháp nhận xét, gửi nhận xét, bài tập cá nhân hóa. */
/* --- thao tác trên từng kết quả / lượt làm --- */
function anView(kind, ai, si, key) {
  const c = selected(), r = anPick(c, kind, ai, si, key); if (!r) return;
  const items = anItems(c, kind, ai);
  const rowsQ = items.map((x, i) => { const q = qOf(c, x.qid); if (!q) return '';
    return `<tr><td>Câu ${i + 1}. ${esc(q.content)}<div class='muted'>${QT[q.type]} · tối đa ${x.w} điểm${x.objs.length ? ' · mục tiêu ' + x.objs.map(j => esc(codeOf(c, j))).join(', ') : ''}</div></td><td>${esc(ansTxt(q, r.ans[x.qid]))}</td><td>${r.sc[x.qid] == null ? '<span class="muted">chờ chấm</span>' : r.sc[x.qid] + '/' + x.w}</td><td>${esc(r.fb && r.fb[x.qid] || '')}</td></tr>` }).join('');
  openDlg({ title: 'Bài làm · ' + esc(r.s.name) + ' · ' + esc(r.tag), okLabel: 'Đóng', text: `<b>${esc(anName(c, kind, ai))}</b> · trạng thái: ${r.status === 'GRADED' ? 'đã chấm' : 'chờ chấm'} · tổng ${r.total == null ? '–' : r.total}/${r.max}.<div class='tablewrap' style='margin-top:10px'><table><thead><tr><th scope='col'>Câu hỏi</th><th scope='col'>Trả lời</th><th scope='col'>Điểm</th><th scope='col'>Nhận xét</th></tr></thead><tbody>${rowsQ}</tbody></table></div>`, ok: () => null });
}
function anRegradeOne(c, kind, ai, r) {
  const items = anItems(c, kind, ai); let n = 0;
  if (kind === 'quiz') {
    const t = r.store; items.forEach(x => { const q = qOf(c, x.qid); if (q && isObj(q)) { const v = autoScore(q, x.w, t.ans[x.qid]); if (v !== t.sc[x.qid]) { t.sc[x.qid] = v; n++ } } });
    if (t.status !== 'GRADED' && items.every(x => t.sc[x.qid] != null)) completeAttempt(c, r.s, t);
  } else {
    const b = r.store, a = c.assignments[ai]; if (!b || !b.qa) return 0;
    b.qa.forEach((x, i) => { const it = items[i], q = qOf(c, it.qid); if (!q || !isObj(q)) return;
      let v = x.a;
      if (q.type === 'MULTIPLE_CHOICE') { v = String(x.a || '').split('; ').map(t2 => q.opts.indexOf(t2)); if (v.some(i2 => i2 < 0)) return }
      else { v = q.opts.indexOf(String(x.a || '')); if (v < 0) return }
      const g = autoScore(q, it.w, v); if (g !== x.got) { x.got = g; x.ok = autoScore(q, 1, v) === 1; n++ } });
    if (n && b.qa.every(x => x.got != null)) { asgFinal(c, ai, r.si); a.graded = a.subs.filter(x2 => x2.score != null).length }
  }
  return n;
}
function anRegradeRow(kind, ai, si, key) {
  const c = selected(); if (!owns(c)) return;
  const r = anPick(c, kind, ai, si, key); if (!r || !r.store) return;
  const n = anRegradeOne(c, kind, ai, r);
  render(); toast(n ? 'Đã chấm tự động lại ' + n + ' câu trắc nghiệm của lượt này.' : 'Không có câu trắc nghiệm nào cần chấm lại.');
}
function anRegradeAll(kind, ai) {
  const c = selected(); if (!owns(c)) return;
  const rows = anRows(c, kind, ai).filter(r => r.store);
  let n = 0; rows.forEach(r => { n += anRegradeOne(c, kind, ai, r) });
  if (kind !== 'quiz') { const a = c.assignments[ai]; if (a) a.graded = a.subs.filter(x => x.score != null).length }
  render(); toast(n ? 'Đã chấm tự động lại ' + n + ' câu trên ' + rows.length + ' lượt làm.' : 'Không có câu trắc nghiệm nào cần chấm lại.');
}
function anDraftFb(kind, ai, si, key) {
  const c = selected(); if (!owns(c)) return;
  const r = anPick(c, kind, ai, si, key); if (!r || !r.store) return;
  r.store.fbDraft = { text: anSummary(c, anItems(c, kind, ai), r), at: stamp() };
  render(); toast('Đã tạo nháp nhận xét cho ' + r.s.name + '. Hãy đọc lại trước khi gửi.');
}
function anDropFb(kind, ai, si, key) {
  const c = selected(); const r = anPick(c, kind, ai, si, key); if (!r || !r.store) return;
  r.store.fbDraft = null; render();
}
function anSendFb(kind, ai, si, key) {
  const c = selected(); if (!owns(c)) return;
  const r = anPick(c, kind, ai, si, key), st = r && r.store; if (!r || !st || !st.fbDraft) return;
  const text = st.fbDraft.text;
  if (kind === 'quiz') r.s.aiFb = { text, at: stamp() };
  else { const b = c.assignments[ai].subs[si]; b.fb = (b.fb ? b.fb + ' ' : '') + text; b.fbAiAt = stamp() }
  st.fbDraft = null;
  notify('AI_FB_SENT', 'Giáo viên đã gửi nhận xét tổng quan cho bài ' + anName(c, kind, ai), { page: kind === 'quiz' ? 'results' : 'assignments', c, ref: kind === 'quiz' ? c.quiz : c.assignments[ai] }, r.s.email);
  render(); toast('Đã gửi nhận xét cho ' + r.s.name + '.');
}
function anBulkDraft(kind, ai) {
  const c = selected(); if (!owns(c)) return;
  const items = anItems(c, kind, ai); let n = 0;
  anFilter(c, anRows(c, kind, ai)).filter(r => r.store && !r.store.fbDraft).forEach(r => { r.store.fbDraft = { text: anSummary(c, items, r), at: stamp() }; n++ });
  render(); toast(n ? 'Đã tạo ' + n + ' nháp nhận xét. Hãy đọc và gửi từng bản, hoặc gửi tất cả.' : 'Không có lượt làm nào cần tạo nháp.');
}
function anBulkSend(kind, ai) {
  const c = selected(); if (!owns(c)) return;
  const L = anFilter(c, anRows(c, kind, ai)).filter(r => r.store && r.store.fbDraft);
  if (!L.length) { toast('Chưa có nháp nhận xét nào để gửi.'); return }
  openDlg({ title: 'Gửi ' + L.length + ' nhận xét cho học sinh?', okLabel: 'Gửi tất cả', text: 'Mỗi nhận xét là bản nháp AI soạn mà bạn đã xem lại. Học sinh sẽ nhận được thông báo và thấy nội dung ở trang kết quả.', ok: () => { L.slice().forEach(r => anSendFb(kind, ai, r.si, r.key)); return null } });
}
function anAcceptOne(c, kind, ai, r, qid) {
  const items = anItems(c, kind, ai), x = items.find(y => y.qid === qid); if (!x || !r.store) return;
  const q = qOf(c, qid), e = aiEssay(c, x, r.ans[qid]);
  if (kind === 'quiz') { const t = r.store; t.sc[qid] = e.total; t.fb[qid] = '[AI gợi ý, giáo viên đã duyệt] ' + e.cm;
    if (items.every(y => t.sc[y.qid] != null)) { completeAttempt(c, r.s, t); toast('Lượt làm đã chấm xong; mức nắm vững đã được tính lại.'); return } }
  else { const b = c.assignments[ai].subs[r.si], a = c.assignments[ai];
    b.qa.forEach((z, i) => { if (items[i] && items[i].qid === qid) { z.got = e.total; z.fb = '[AI gợi ý, giáo viên đã duyệt] ' + e.cm } });
    if (b.qa.every(z => z.got != null)) { asgFinal(c, ai, r.si); a.graded = a.subs.filter(z => z.score != null).length; toast('Bài nộp đã chấm xong; mức nắm vững đã được tính lại.'); return } }
  toast('Đã ghi điểm AI duyệt cho câu tự luận.');
}
function anAccept(kind, ai, si, key, qid) { const c = selected(); if (!owns(c)) return; const r = anPick(c, kind, ai, si, key); if (r) { anAcceptOne(c, kind, ai, r, qid); render() } }
function anAcceptAll(kind, ai) {
  const c = selected(); if (!owns(c)) return;
  const items = anItems(c, kind, ai), pend = [];
  anFilter(c, anRows(c, kind, ai)).filter(r => r.store).forEach(r => items.forEach(x => { const q = qOf(c, x.qid); if (q && !isObj(q) && r.sc[x.qid] == null && r.ans[x.qid] != null) pend.push([r, x.qid]) }));
  if (!pend.length) { toast('Không còn câu tự luận nào chờ chấm.'); return }
  openDlg({ title: 'Chấp nhận ' + pend.length + ' điểm AI đề xuất?', danger: true, okLabel: 'Chấp nhận tất cả', text: 'Điểm và nhận xét do AI đề xuất theo rubric sẽ được ghi chính thức. Bạn vẫn có thể chấm lại từng câu sau đó.', ok: () => { pend.forEach(([r, qid]) => anAcceptOne(c, kind, ai, r, qid)); render(); toast('Đã ghi ' + pend.length + ' điểm AI đề xuất.'); return null } });
}
function anSendPers(kind, ai, si, key) {
  const c = selected(); if (!owns(c)) return;
  const r = anPick(c, kind, ai, si, key); if (!r) return;
  r.s.pers = anPers(c, r.s, anItems(c, kind, ai), r);
  render(); toast('Đã giao bài tập gợi ý cho ' + r.s.name + '.');
}
function anBulkPers(kind, ai) {
  const c = selected(); if (!owns(c)) return;
  const items = anItems(c, kind, ai); let n = 0;
  anFilter(c, anRows(c, kind, ai)).forEach(r => { r.s.pers = anPers(c, r.s, items, r); n++ });
  render(); toast('Đã tạo và giao gợi ý cá nhân hóa cho ' + n + ' học sinh.');
}
/* --- cụm nút chức năng của từng kết quả / lượt làm --- */
function anRowActs(c, kind, ai, r) {
  const K = anK(kind, ai, r);
  const out = [`<button class='btn light mini' data-noicon='1' onclick='anView(${K})'>Xem bài làm</button>`];
  if (kind === 'quiz' && r.status === 'SUBMITTED') out.push(`<button class='btn mini' data-noicon='1' onclick='gradeAtt(${r.si},${r.k})'>Chấm</button>`);
  if (kind === 'asg' && r.cur) out.push(`<button class='btn mini' data-noicon='1' onclick='gradeAsgQ(${ai},${r.si})'>${r.status === 'GRADED' ? 'Chấm lại' : 'Chấm'}</button>`);
  if (r.store) {
    out.push(`<button class='btn light mini' data-noicon='1' onclick='anRegradeRow(${K})'>Chấm TN lại</button>`);
    if (r.store.fbDraft) out.push(`<button class='btn mini' data-noicon='1' onclick='anSendFb(${K})'>Duyệt &amp; gửi nhận xét</button>`);
    out.push(`<button class='btn light mini' data-noicon='1' onclick='anSendPers(${K})'>Gợi ý cá nhân</button>`);
  }
  if (kind === 'asg' && r.cur) out.push(`<button class='btn light mini' data-noicon='1' onclick='grantTries(${ai},${r.si})'>Cấp thêm lượt</button>`);
  return `<span class='row' style='flex-wrap:wrap;justify-content:flex-end'>${out.join('')}</span>`;
}
