/* EducMind · js/41-analysis-view.js
   Giao diện phân tích theo bảy mức, lượt làm mẫu, và phần nhận xét hiển thị cho học sinh. */
/* --- thân phân tích theo bảy mức --- */
function anBody(c, kind, ai, rows, l) {
  const items = anItems(c, kind, ai);
  if (l === 1) {
    const O = items.filter(x => isObj(qOf(c, x.qid)));
    return anLv(1, `<p class='lead'>Câu một lựa chọn, đúng/sai và nhiều lựa chọn được chấm ngay khi nộp; câu trả lời ngắn và tự luận chờ giáo viên. Dùng “Chấm tự động lại” khi bạn chỉnh đáp án hoặc trọng số.</p>` +
      tbl(['Học sinh', 'Lượt', 'Trắc nghiệm đúng', 'Điểm trắc nghiệm', 'Chờ chấm tay', 'Chức năng cho lượt này'], rows.map(r => {
        const gz = O.filter(x => r.sc[x.qid] != null).length, ok = O.filter(x => r.sc[x.qid] === x.w).length;
        const wait = items.filter(x => !isObj(qOf(c, x.qid)) && r.sc[x.qid] == null).length;
        const objPts = O.reduce((a, x) => a + (r.sc[x.qid] || 0), 0);
        return tr(['<b>' + esc(r.s.name) + '</b>', esc(r.tag), ok + '/' + gz, objPts.toFixed(1), wait || '–', anRowActs(c, kind, ai, r)]);
      })), kind, ai);
  }
  if (l === 2) {
    const gr = rows.filter(r => r.status === 'GRADED' && r.total != null), av = gr.length ? (gr.reduce((a, r) => a + r.total, 0) / gr.length).toFixed(1) + '/' + rows[0].max : 'chưa có lượt chấm xong';
    return anLv(2, `<p class='lead'>Điểm trung bình các lượt đã chấm xong: <b>${av}</b>. Bảng cho thấy học sinh chọn gì ở từng câu để phát hiện phương án gây nhầm.</p>` +
      tbl(['Câu hỏi', 'Tỷ lệ đúng', 'Phân bố câu trả lời'], items.map((x, i) => {
        const q = qOf(c, x.qid), lb = `Câu ${i + 1}: ${esc(q ? q.content : '(câu đã xóa)')}`;
        if (!q) return tr([lb, '–', '–']);
        if (!isObj(q)) { const v = rows.map(r => r.sc[x.qid]).filter(z => z != null); return tr([lb, v.length ? 'Điểm TB ' + (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) + '/' + x.w : '–', 'Tự luận: ' + v.length + '/' + rows.length + ' lượt đã chấm']) }
        const ok = rows.filter(r => !anWrong(r, x)).length, p = rows.length ? Math.round(ok / rows.length * 100) : 0;
        let dist;
        if (q.type === 'MULTIPLE_CHOICE') dist = 'Đúng đủ ' + ok + ' · sai ' + (rows.length - ok);
        else dist = q.opts.map((o, oi) => (oi === q.ans ? '✓ ' : '') + esc(o) + ': ' + rows.filter(r => r.ans[x.qid] === oi || q.opts.indexOf(String(r.ans[x.qid] == null ? '' : r.ans[x.qid])) === oi).length).join('<br>');
        return tr([lb, `<b>${p}%</b> ${p < 50 ? `<span class='pill need'>Câu khó</span>` : ''}`, dist]);
      })), kind, ai);
  }
  if (l === 3) {
    const m = {};
    items.forEach(x => (x.objs || []).forEach(j => rows.forEach(r => {
      if (r.sc[x.qid] == null) return; const a = m[j] || (m[j] = { n: 0, w: 0, names: new Set() }); a.n++; if (anWrong(r, x)) { a.w++; a.names.add(r.s.name) }
    })));
    const free = items.filter(x => !(x.objs || []).length).length;
    return anLv(3, `<p class='lead'>Mỗi câu sai được gắn với mục tiêu học tập của câu hỏi. Câu không gắn mục tiêu (${free} câu) vẫn tính điểm nhưng không sinh lỗi theo mục tiêu.</p>` +
      (Object.keys(m).length ? tbl(['Mục tiêu', 'Lượt trả lời', 'Lượt sai', 'Học sinh sai'], Object.keys(m).map(Number).map(j => {
        const a = m[j], p = Math.round(a.w / a.n * 100);
        return tr([`<b>${esc(codeOf(c, j))}</b> · ${esc(c.goals[j])}`, a.n, `<b>${a.w}</b> (${p}%)`, [...a.names].slice(0, 6).map(esc).join(', ') + (a.names.size > 6 ? '…' : '')]);
      })) : `<div class='empty'>Chưa có lượt trả lời nào gắn mục tiêu.</div>`), kind, ai);
  }
  if (l === 4) return anLv(4, `<p class='lead'>AI soạn nháp nhận xét từ kết quả từng lượt làm; giáo viên đọc rồi mới gửi. Có thể tạo nháp và gửi cho cả lớp chỉ bằng một lượt bấm.</p>` +
    rows.map(r => `<div class='item'><div style='min-width:0'><b>${esc(r.s.name)}</b> <span class='muted'>· ${esc(r.tag)}</span>${r.store && r.store.fbDraft ? `<div class='draft' style='margin-top:6px'>${esc(r.store.fbDraft.text)}<div class='muted' style='font-size:.75rem;margin-top:4px'>Nháp tạo lúc ${esc(r.store.fbDraft.at)} · chưa gửi</div></div>` : `<div class='muted'>${esc(anSummary(c, items, r))}</div>`}${kind === 'quiz' && r.s.aiFb ? `<div class='muted' style='font-size:.75rem;margin-top:4px'>Đã gửi nhận xét tổng quan lúc ${esc(r.s.aiFb.at)}</div>` : ''}${kind === 'asg' && r.cur && c.assignments[ai].subs[r.si] && c.assignments[ai].subs[r.si].fbAiAt ? `<div class='muted' style='font-size:.75rem;margin-top:4px'>Đã gửi nhận xét vào phản hồi bài nộp lúc ${esc(c.assignments[ai].subs[r.si].fbAiAt)}</div>` : ''}</div>${anRowActs(c, kind, ai, r)}</div>`).join(''), kind, ai);
  if (l === 5) {
    const PD = rows.filter(r => r.store).map(r => ({ r, E: items.filter(x => { const q = qOf(c, x.qid); return q && !isObj(q) && r.sc[x.qid] == null && r.ans[x.qid] != null }) })).filter(x => x.E.length);
    return anLv(5, `<p class='lead'>Rubric: ${RUB.map(r2 => r2[0] + ' (' + Math.round(r2[1] * 100) + '%)').join(' · ')}. AI chỉ đề xuất điểm và nhận xét; điểm chỉ được ghi khi giáo viên chấp nhận.</p>` +
      (PD.length ? PD.map(({ r, E }) => E.map(x => { const q = qOf(c, x.qid), e = aiEssay(c, x, r.ans[x.qid]);
        return `<div class='item' style='display:block'><b>${esc(r.s.name)}</b> <span class='muted'>· ${esc(r.tag)} ·</span> Câu: ${esc(q.content)}<div class='muted'>Trả lời: ${esc(ansTxt(q, r.ans[x.qid]))}</div><div class='row between' style='margin-top:6px'><span class='muted'>AI đề xuất <b>${e.total}/${x.w}</b> · ${esc(e.cm)}</span><button class='btn mini' data-noicon='1' onclick='anAccept(${anK(kind, ai, r, x.qid)})'>Chấp nhận điểm AI</button></div></div>` }).join('')).join('') : `<div class='empty'>Không còn câu tự luận nào chờ chấm ở phạm vi đang xem.</div>`), kind, ai);
  }
  if (l === 6) {
    const R = [], T = {};
    rows.forEach(r => items.forEach((x, i) => {
      const q = qOf(c, x.qid); if (!q) return; const a = r.ans[x.qid]; let L = [];
      if (isObj(q)) { if (anWrong(r, x)) L = [errType(q, a)] }
      else if (a != null) { const e = aiEssay(c, x, a); if (e.v[0] < 1) L.push(['Lạc khỏi trọng tâm mục tiêu', 'Yêu cầu học sinh đọc lại mục tiêu rồi viết lại ý chính.']); if (e.v[1] < 1) L.push(['Thiếu giải thích hoặc ví dụ minh họa', 'Hướng dẫn học sinh nêu một ví dụ thực tế cho mỗi khái niệm.']) }
      L.forEach(z => { T[z[0]] = (T[z[0]] || 0) + 1; R.push(tr([esc(r.s.name) + ' · ' + esc(r.tag), 'Câu ' + (i + 1), `<b>${z[0]}</b>`, z[1]])) });
    }));
    return anLv(6, `<p class='lead'>AI phân loại lý do sai ở từng câu, kể cả cách chọn phương án và nội dung tự luận. Đây là bản nháp để tham khảo, không ảnh hưởng điểm hay mức nắm vững.</p><div class='row'>${Object.keys(T).map(k => `<span class='pill plain'>${esc(k)}: ${T[k]}</span>`).join('')}</div>` + (R.length ? tbl(['Học sinh · lượt', 'Câu', 'Loại lỗi', 'Gợi ý xử lý'], R) : `<div class='empty'>Không phát hiện lỗi nào ở phạm vi đang xem.</div>`), kind, ai);
  }
  return anLv(7, `<p class='lead'>Từ mục tiêu còn sai, hệ thống chọn nội dung có sẵn của lớp (bài tập, bài học, tài liệu). AI chỉ giải thích lý do gợi ý; giáo viên duyệt rồi mới giao.</p>` +
    rows.map(r => { const L = anPers(c, r.s, items, r);
      return `<div class='item'><div style='min-width:0'><b>${esc(r.s.name)}</b> <span class='muted'>· ${esc(r.tag)}</span>${L.length ? L.map(z => `<div class='muted'>${esc(z.goal)} → ${esc(z.label)}</div>`).join('') : `<div class='muted'>Không còn mục tiêu nào dưới 70% đúng.</div>`}</div><span class='row' style='flex-wrap:nowrap'><button class='btn light mini' onclick='anSendPers(${anK(kind, ai, r)})'>Giao gợi ý</button>${r.store ? `<button class='btn light mini' data-noicon='1' onclick='anView(${anK(kind, ai, r)})'>Xem bài làm</button>` : ''}</span></div>` }).join(''), kind, ai);
}
function anLv(l, body) {
  return `<section class='panel' aria-labelledby='h-lv'><div class='row between'><h2 id='h-lv'>Mức ${l}: ${LVS[l - 1][0]}</h2><span class='pill ${LVS[l - 1][1] === 'AI' ? 'prog' : 'plain'}'>${LVS[l - 1][1] === 'AI' ? 'AI soạn nháp · giáo viên duyệt' : 'Quy tắc, không dùng AI'}</span></div>${body}</section>`;
}
function anRunAi(kind, ai) {
  const c = selected();
  aiGradeAll(c, kind === 'quiz' ? 0 : ai);
  const lv = kind === 'quiz' ? anLvQ : anLvA;
  if (lv === 4) { anBulkSend(kind, ai); return }
  if (lv === 7) { anBulkPers(kind, ai); return }
  toast('AI đã soạn nội dung cho mức ' + lv + ' · ' + LVS[lv - 1][0] + '. Kết quả chỉ chính thức sau khi giáo viên xác nhận.');
  render();
}
function anSection(c, kind, ai) {
  const items = anItems(c, kind, ai);
  const lv = kind === 'quiz' ? anLvQ : anLvA;
  const all = anRows(c, kind, ai), rows = anFilter(c, all);
  const nStu = new Set(all.map(r => r.si)).size;
  const head = `<section class='panel' aria-labelledby='h-an'><div class='row between' style='flex-wrap:wrap;gap:10px'><div><h2 id='h-an'>Phân tích đánh giá · ${esc(anName(c, kind, ai))}</h2><div class='muted' style='margin-top:4px'>Bảy mức hỗ trợ: chấm tự động bằng quy tắc (1–3) và chức năng AI hỗ trợ (4–7). Chạy cho cả lớp hoặc từng học sinh; mỗi kết quả và lượt làm đều có sẵn chức năng đi kèm.</div></div><span class='row'>${kind === 'quiz' ? `<button class='btn light' onclick='seedAttempts()'>Nạp lượt làm mẫu</button>` : ''}</span></div>
<div class='row' style='margin:12px 0 0;flex-wrap:wrap;align-items:center;gap:10px'><div class='selectbox' style='max-width:420px'><label for='anlv'>Chức năng hỗ trợ (1–7)</label><select id='anlv' onchange='anSetLv("${kind}",this.value)'>${LVS.map((x, i) => `<option value='${i + 1}' ${lv === i + 1 ? 'selected' : ''}>${i + 1}. ${esc(x[0])}</option>`).join('')}</select></div></div>
<div class='ai-bar' style='margin-top:10px'>${ic('spark',16)}<span>AI làm hết phần soạn thảo của mức ${lv} · ${esc(LVS[lv - 1][0])}; giáo viên xem rồi xác nhận.</span><span class='row' style='margin-left:auto'><button class='btn mini' data-noicon='1' onclick='anRunAi("${kind}",${ai})'>Chạy AI cho cả lớp</button></span></div>
<div class='row' style='margin-top:10px;flex-wrap:wrap'><div class='selectbox' style='max-width:280px'><label for='anwho'>Phạm vi phân tích</label><select id='anwho' onchange='anSetWho(this.value)'><option value='class' ${anWho === 'class' ? 'selected' : ''}>Cả lớp (${nStu} học sinh có dữ liệu)</option>${c.students.map((s, si) => `<option value='${si}' ${anWho === String(si) ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
${lv === 1 ? `<button class='btn light' onclick='anRegradeAll("${kind}",${ai})'>Chấm tự động lại cả lớp</button>` : ''}
${lv === 4 ? `<button class='btn light' onclick='anBulkDraft("${kind}",${ai})'>Tạo nháp nhận xét cả lớp</button><button class='btn' onclick='anBulkSend("${kind}",${ai})'>Gửi tất cả nháp</button>` : ''}
${lv === 5 ? `<button class='btn light' onclick='anAcceptAll("${kind}",${ai})'>Chấp nhận toàn bộ điểm AI</button>` : ''}
</div></section>`;
  if (!items.length) return head + `<section class='panel'><div class='empty'>${kind === 'quiz' ? 'Lớp chưa có bài kiểm tra nào có câu hỏi.' : 'Bài tập này không có bộ câu hỏi nên không có dữ liệu phân tích theo từng câu.'}</div></section>`;
  if (!rows.length) return head + `<section class='panel'><div class='empty'>${all.length ? 'Học sinh đang chọn chưa có lượt làm nào.' : 'Chưa có lượt làm thật nào. Học sinh làm bài ở góc nhìn học sinh, hoặc nạp lượt làm mẫu để thử các mức phân tích.'}</div></section>`;
  return head + anBody(c, kind, ai, rows, lv);
}
function simAns(c, q, ok, i) {
  if (!isObj(q)) { const g = c.goals[q.objs[0]] || 'nội dung bài học'; return !ok ? 'Em chưa nhớ rõ nội dung này.' : i % 2 ? 'Theo em, ' + g.toLowerCase() + ' là nội dung quan trọng. Ví dụ, các máy tính trong phòng máy của trường được nối với nhau để chia sẻ dữ liệu.' : g + '.' }
  if (q.type === 'MULTIPLE_CHOICE') { if (ok) return q.ans.slice(); const w = q.opts.findIndex((_, k) => !q.ans.includes(k)); return i % 2 ? [q.ans[0]] : q.ans.concat([w]) }
  return ok ? q.ans : q.opts.length === 2 ? 1 - q.ans : (q.ans + 1 + i % 2) % q.opts.length;
}
function seedAttempts() {
  const c = selected(); if (!owns(c)) return;
  if (c.quiz.deleted || !c.quiz.qs.length) { toast('Lớp chưa có bài kiểm tra nào có câu hỏi.'); return }
  let n = 0;
  c.students.forEach((s, i) => {
    if (s.atts.some(t => !t.seed) || s.att.used >= c.maxAtt || s.att.cur) return;
    const m = sAvg(s) || .5, ans = {};
    c.quiz.qs.forEach((x, k) => { ans[x.qid] = simAns(c, qOf(c, x.qid), ((i * 37 + k * 53 + 7) % 100) / 100 < m + .1, i) });
    const t = { n: s.atts.length + 1, status: 'IN_PROGRESS', ans, start: simNow() };
    s.atts.push(t); s.att.used++; s.att.cur = t; submitAttempt(c, s); n++;
  });
  render(); toast(n ? 'Đã nạp lượt làm mẫu cho ' + n + ' học sinh (câu tự luận đang chờ chấm).' : 'Mọi học sinh đã có lượt làm thật hoặc hết lượt.');
}
function insStu(){
  const s=me();let h='';if(!s)return h;
  if(s.aiFb)h+=`<section class='panel'><h2>Nhận xét tổng quan</h2><p class='lead'>Giáo viên đã xem và gửi (nội dung có AI hỗ trợ soạn). ${esc(s.aiFb.at)}</p><p style='margin:0'>${esc(s.aiFb.text)}</p></section>`;
  if(s.pers&&s.pers.length)h+=`<section class='panel'><h2>Bài tập gợi ý cho em</h2><p class='lead'>Dựa trên các câu em chưa làm tốt.</p>${s.pers.map(z=>`<div class='item'><div><b>${esc(z.goal)}</b><div class='muted'>${esc(z.label)}</div></div></div>`).join('')}</section>`;
  return h;
}
