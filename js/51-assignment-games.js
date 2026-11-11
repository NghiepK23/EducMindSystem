/* EducMind · js/51-assignment-games.js
   Giao diện trò chơi khi làm bài tập: đường đua, tốc độ (blitz), sinh tồn. */
function rdRaceSet(qi,v){rdSet(qi,v);const R=rdR();if(R)R.presentation='race'}
function rdRaceChoose(qi,oi){rdRaceSet(qi,oi);render()}
function rdRaceToggle(qi,oi){const R=rdR();if(!R)return;const id=R.qs[qi].id,r=R.ans[id]||[];R.ans[id]=r.includes(oi)?r.filter(x=>x!==oi):r.concat([oi]);rdTouch(qi);render()}
function rdRaceMove(dir){const R=rdR();if(!R)return;const i=Number.isInteger(R.gameIndex)?R.gameIndex:0;
  if(dir<0){R.gameIndex=Math.max(0,i-1);render();return}
  const q=R.qs[i];if(!rdAnswered(q,R.ans[q.id])){toast('Hãy trả lời câu này trước khi tiếp tục.');return}
  if(i>=R.qs.length-1){rdSubmit();return}R.gameIndex=i+1;render();
}
function examRaceHtml(c,a,b,R,first,pv,prev,tw,tot,done){
  if(!tot)return `<section class='${pv?'':'panel'}'><h2>${first?'Làm bài':'Luyện tập lại'}: ${esc(a.name)}</h2><div class='empty'>Bài chưa có câu hỏi.</div></section>`;
  if(!Number.isInteger(R.gameIndex))R.gameIndex=0;R.gameIndex=Math.max(0,Math.min(tot-1,R.gameIndex));
  const qi=R.gameIndex,q=R.qs[qi],v=R.ans[q.id];let answer='';
  if(q.type==='MULTIPLE_CHOICE')answer=raceOptions(q.opts,v,true,qi,'rdRaceToggle',pv);
  else if(q.type==='SHORT_ANSWER')answer=`<input class='race-text' ${pv?'disabled':''} value='${esc(v||'')}' oninput='rdRaceSet(${qi},this.value)' aria-label='Câu trả lời câu ${qi+1}'>`;
  else if(q.type==='ESSAY')answer=`<textarea class='race-textarea' rows='5' ${pv?'disabled':''} oninput='rdRaceSet(${qi},this.value)' aria-label='Câu trả lời câu ${qi+1}'>${esc(v||'')}</textarea>`;
  else answer=raceOptions(q.opts,v,false,qi,'rdRaceChoose',pv);
  return `<section class='${pv?'':'panel'} race-game' ${pv?'':`id='rd-top' tabindex='-1'`} aria-labelledby='h-rd'><div class='race-banner'><div class='row between'><span class='race-tag'><span aria-hidden='true'>⚡</span> ${pv?'MẪU GIAO DIỆN':'THỬ THÁCH · '+esc(a.name)}</span>${pv?'':`<span class='race-tag'>Lượt ${pTriesOf(b)+1}/${pMax(a,b)}</span>`}</div><h2 id='h-rd'><span aria-hidden='true'>🪢</span> Kéo co tri thức</h2><p>${first?'Mỗi câu đã trả lời kéo nút dây một nhịp về phía đội em.':'Luyện tập lại toàn bộ bài để chinh phục mục tiêu.'} Hoàn thành đủ ${tot} chặng để nộp thử thách.</p>${raceTrackHtml(done,tot,qi)}</div><div class='race-content'>${a.desc?`<p class='race-instructions'>${esc(a.desc)}</p>`:''}${prev?`<p class='muted' style='margin:0 0 10px'>${prev}</p>`:''}<div class='race-round-banner'><span class='race-round-number'>${String(qi+1).padStart(2,'0')}</span><span><b>CHẶNG ${qi+1} / ${tot}</b><small>${q.w} điểm · ${raceHint(q.type)}</small></span><span class='race-round-chip'>${done}/${tot} xong</span></div><h3 class='race-question'>${esc(q.content)}</h3>${answer}<div class='race-answer-status' id='race-answer-status' aria-live='polite'>${raceAnswerState(q,v)}</div>${R.miss.includes(qi)?`<div role='alert' class='race-missing'>Câu này chưa được trả lời.</div>`:''}<div class='race-nav'><button class='btn light race-prev' type='button' data-noicon='1' aria-label='Câu trước' onclick='rdRaceMove(-1)' ${qi===0?'disabled':''}>${ic('arrowLeft',18)}<span>Câu trước</span></button><button class='btn light' type='button' onclick='rdPause()'>Tạm dừng</button><button class='btn race-next' type='button' data-noicon='1' aria-label='${qi===tot-1?'Nộp bài':'Câu tiếp theo'}' onclick='rdRaceMove(1)'>${qi===tot-1?'Chốt lượt · Nộp bài':'Kéo dây · Câu tiếp theo'}${ic('arrow',18)}</button></div></div></section>`;
}
function blitzSet(qi,v){const R=rdR();if(!R)return;delete (R.feedback||{})[qi];rdSet(qi,v);const el=document.getElementById('blitz-answer-status');if(el)el.textContent=raceAnswerState(R.qs[qi],v)}
function blitzChoose(qi,oi){blitzSet(qi,oi);render()}
function blitzToggle(qi,oi){const R=rdR();if(!R)return;const id=R.qs[qi].id,r=R.ans[id]||[];R.ans[id]=r.includes(oi)?r.filter(x=>x!==oi):r.concat([oi]);delete (R.feedback||{})[qi];rdTouch(qi);render()}
function blitzCheck(){
  const c=redo&&redo.c,R=rdR();if(!R)return;const qi=R.gameIndex||0,q=R.qs[qi],v=R.ans[q.id];
  if(!rdAnswered(q,v)){toast('Chọn hoặc nhập câu trả lời trước khi kiểm tra.');return}
  R.feedback=R.feedback||{};if(R.feedback[qi])return;const source=qOf(c,q.id);
  if(!source||!isObj(source))R.feedback[qi]={kind:'manual',ok:null,text:'Câu trả lời đã lưu; giáo viên sẽ chấm câu này.'};
  else{const ok=autoScore(source,1,v)===1;R.feedback[qi]={kind:'auto',ok,text:source.explain||'Hãy xem lại mục tiêu liên quan rồi thử tiếp.',answer:survivalAnswerLabel(source,source.ans)}}
  render();
}
function blitzMove(dir){const R=rdR();if(!R)return;const i=Number.isInteger(R.gameIndex)?R.gameIndex:0;if(dir<0){R.gameIndex=Math.max(0,i-1);render();return}if(!R.feedback||!R.feedback[i]){toast('Kiểm tra câu này để chốt chuỗi trước khi tiếp tục.');return}if(i>=R.qs.length-1){rdSubmit();return}R.gameIndex=i+1;render()}
function examBlitzHtml(c,a,b,R,first,pv,prev,tw,tot,done){
  if(!tot)return `<section class='${pv?'':'panel'}'><h2>Combo chớp nhoáng</h2><div class='empty'>Bài chưa có câu hỏi.</div></section>`;
  if(!Number.isInteger(R.gameIndex))R.gameIndex=0;R.gameIndex=Math.max(0,Math.min(tot-1,R.gameIndex));R.feedback=R.feedback||{};
  const qi=R.gameIndex,q=R.qs[qi],v=R.ans[q.id],fb=R.feedback[qi];let streak=0;
  for(let j=0;j<=qi;j++){const z=R.feedback[j];if(z&&z.ok)streak++;else if(z&&z.ok===false)streak=0}
  const locked=!!fb;let answer='';
  if(q.type==='MULTIPLE_CHOICE')answer=raceOptions(q.opts,v,true,qi,'blitzToggle',pv||locked);
  else if(q.type==='SHORT_ANSWER')answer=`<input class='race-text blitz-text' ${pv||locked?'disabled':''} value='${esc(v||'')}' oninput='blitzSet(${qi},this.value)' aria-label='Câu trả lời câu ${qi+1}'>`;
  else if(q.type==='ESSAY')answer=`<textarea class='race-textarea blitz-textarea' rows='4' ${pv||locked?'disabled':''} oninput='blitzSet(${qi},this.value)' aria-label='Câu trả lời câu ${qi+1}'>${esc(v||'')}</textarea>`;
  else answer=raceOptions(q.opts,v,false,qi,'blitzChoose',pv||locked);
  const feedback=!fb?'':fb.kind==='manual'?`<div class='blitz-feedback neutral'><b>📮 Đã lưu câu trả lời</b><p>${esc(fb.text)}</p></div>`:fb.ok?`<div class='blitz-feedback success'><b>⚡ Chính xác! Chuỗi hiện tại: ${streak}</b><p>${esc(fb.text)}</p></div>`:`<div class='blitz-feedback miss'><b>Chuỗi đã dừng — câu sau là cơ hội mới!</b><p><strong>Đáp án:</strong> ${esc(fb.answer||'')}</p><p>${esc(fb.text)}</p></div>`;
  const buttons=pv?'':`<div class='blitz-nav'><button type='button' class='btn light' data-noicon='1' onclick='blitzMove(-1)' ${qi===0?'disabled':''}>${ic('arrowLeft',18)}<span>Câu trước</span></button><button type='button' class='btn light' onclick='rdPause()'>Tạm dừng</button>${fb?`<button type='button' class='btn blitz-next' data-noicon='1' onclick='blitzMove(1)'>${qi===tot-1?'Nộp bài':'Câu tiếp theo'} ${ic('arrow',18)}</button>`:`<button type='button' class='btn blitz-next' data-noicon='1' onclick='blitzCheck()'>Chốt đáp án ⚡</button>`}</div>`;
  return `<section class='panel blitz-game' ${pv?'':`id='rd-top' tabindex='-1'`} aria-labelledby='blitz-title'><div class='blitz-banner'><div class='blitz-kicker'>${pv?'MẪU GIAO DIỆN':'COMBO CHỚP NHOÁNG · LƯỢT '+(pTriesOf(b)+1)+'/'+pMax(a,b)}</div><div class='blitz-top'><div><h2 id='blitz-title'>⚡ Xây chuỗi đúng!</h2><p>${esc(a.name)} · Mỗi câu đúng nối dài combo của em. Kết quả chính thức vẫn tính theo điểm câu hỏi.</p></div><div class='blitz-streak'><b>${streak}</b><span>COMBO</span></div></div><div class='blitz-progress'><span style='width:${tot?Math.round(done/tot*100):0}%'></span></div><div class='blitz-progress-label'>Câu ${qi+1} / ${tot} · đã chốt ${done}/${tot}</div></div><div class='blitz-content'>${prev?`<p class='muted'>${prev}</p>`:''}<div class='blitz-q-label'>CÂU ${String(qi+1).padStart(2,'0')} <span>${q.w} điểm</span></div><h3>${esc(q.content)}</h3>${answer}<div class='race-answer-status' id='blitz-answer-status' aria-live='polite'>${raceAnswerState(q,v)}</div>${feedback}${buttons}<p class='blitz-note'>Câu trả lời và kết quả theo từng mục tiêu được lưu trong Kết quả học tập.</p></div></section>`;
}
function survivalSetAnswer(qi,v){const R=rdR();if(!R)return;R.feedback=R.feedback||{};delete R.feedback[qi];rdSet(qi,v);survivalSync(R)}
function survivalChoose(qi,oi){survivalSetAnswer(qi,oi);render()}
function survivalToggle(qi,oi){const R=rdR();if(!R)return;const id=R.qs[qi].id,r=R.ans[id]||[];R.ans[id]=r.includes(oi)?r.filter(x=>x!==oi):r.concat([oi]);R.feedback=R.feedback||{};delete R.feedback[qi];rdTouch(qi);render()}
function survivalAnswerLabel(q,v){if(v==null)return '';if(q.type==='MULTIPLE_CHOICE')return (v||[]).map(i=>q.opts[i]).join(' · ');return q.opts&&q.opts[v]!=null?q.opts[v]:String(v)}
function survivalSync(R){
  if(!R)return;const done=R.qs.filter(q=>rdAnswered(q,R.ans[q.id])).length,total=R.qs.length,p=total?Math.round(done/total*100):0,correct=Object.values(R.feedback||{}).filter(x=>x&&x.ok).length;
  const bar=document.getElementById('survival-progress'),count=document.getElementById('survival-progress-label'),hp=document.getElementById('survival-hp'),energy=document.getElementById('survival-energy'),status=document.getElementById('survival-answer-status');
  if(bar)bar.style.width=p+'%';if(count)count.textContent='Đã khám phá '+done+'/'+total+' trạm';if(hp)hp.textContent='♥'.repeat(Math.max(0,R.hp||0))+'♡'.repeat(Math.max(0,3-(R.hp||0)));if(energy)energy.textContent=String(correct);if(status)status.textContent=survivalAnswerState(R.qs[R.gameIndex||0],R.ans[R.qs[R.gameIndex||0]&&R.qs[R.gameIndex||0].id]);
}
function survivalAnswerState(q,v){if(!q)return 'Chọn đáp án để tiếp tục.';if(q.type==='MULTIPLE_CHOICE')return Array.isArray(v)&&v.length?v.length+' lựa chọn đã đánh dấu':'Chọn một hoặc nhiều lựa chọn';if(q.type==='SHORT_ANSWER'||q.type==='ESSAY')return String(v||'').trim()?'Câu trả lời đã được lưu':'Nhập câu trả lời để nhận phản hồi';return v==null?'Chưa chọn đáp án':'Đáp án đã được lưu'}
function survivalCheck(){
  const c=redo&&redo.c,s=redo&&redo.s,R=rdR();if(!R)return;
  const qi=R.gameIndex||0,q=R.qs[qi],v=R.ans[q.id];if(!rdAnswered(q,v)){toast('Hãy trả lời câu hỏi trước khi kiểm tra.');return}
  R.feedback=R.feedback||{};if(R.feedback[qi])return;
  const source=qOf(c,q.id);
  if(!source||!isObj(source)){R.feedback[qi]={kind:'manual',ok:null,text:'Câu này sẽ được giáo viên chấm. Câu trả lời đã được lưu.'};render();return}
  const ok=autoScore(source,1,v)===1;
  if(!ok)R.hp=Math.max(0,(Number.isFinite(R.hp)?R.hp:3)-1);
  R.feedback[qi]={kind:'auto',ok,text:source.explain||'Hãy xem lại phần học liệu liên quan rồi thử ghi nhớ ý chính.',answer:survivalAnswerLabel(source,source.ans)};
  render();
}
function survivalFinish(){
  const R=rdR();if(!R){toast('Không tìm thấy lượt chơi đang mở.');return}
  const missing=[];R.qs.forEach((q,i)=>{if(!rdAnswered(q,R.ans[q.id]))missing.push(i)});
  if(missing.length){R.miss=missing;R.gameIndex=missing[0];render();toast('Còn câu chưa trả lời. Đã đưa em tới câu '+(missing[0]+1)+'.');return}
  try{rdSubmit()}catch(e){console.error('survivalFinish failed',e);toast('Chưa thể kết thúc lượt chơi. Hãy thử lại; câu trả lời vẫn được giữ.');}
}
function survivalMove(dir){
  const R=rdR();if(!R)return;const i=Number.isInteger(R.gameIndex)?R.gameIndex:0;
  if(dir<0){R.gameIndex=Math.max(0,i-1);render();return}
  const q=R.qs[i];if(!rdAnswered(q,R.ans[q.id])){toast('Trả lời câu này trước khi đi tiếp.');return}
  if(!(R.feedback||{})[i]){toast('Bấm “Kiểm tra & nhận gợi ý” để nhận phản hồi cho chặng này.');return}
  if(i>=R.qs.length-1){survivalFinish();return}R.gameIndex=i+1;render();
}
function survivalRevise(){const R=rdR();if(!R)return;delete (R.feedback||{})[R.gameIndex||0];render()}
function examSurvivalHtml(c,a,b,R,first,pv,prev,tw,tot,done){
  if(!tot)return `<section class='${pv?'':'panel'}'><h2>Sinh tồn tri thức</h2><div class='empty'>Chưa có trạm câu hỏi.</div></section>`;
  if(!Number.isInteger(R.gameIndex))R.gameIndex=0;R.gameIndex=Math.max(0,Math.min(tot-1,R.gameIndex));R.hp=Number.isFinite(R.hp)?R.hp:3;R.feedback=R.feedback||{};
  const qi=R.gameIndex,q=R.qs[qi],v=R.ans[q.id],src=qOf(c,q.id),fb=R.feedback[qi],correct=Object.values(R.feedback).filter(x=>x&&x.ok).length;
  let answer='';
  if(q.type==='MULTIPLE_CHOICE')answer=raceOptions(q.opts,v,true,qi,'survivalToggle',pv);
  else if(q.type==='SHORT_ANSWER')answer=`<input class='race-text survival-text' ${pv?'disabled':''} value='${esc(v||'')}' oninput='survivalSetAnswer(${qi},this.value)' aria-label='Câu trả lời câu ${qi+1}'>`;
  else if(q.type==='ESSAY')answer=`<textarea class='race-textarea survival-textarea' rows='5' ${pv?'disabled':''} oninput='survivalSetAnswer(${qi},this.value)' aria-label='Câu trả lời câu ${qi+1}'>${esc(v||'')}</textarea>`;
  else answer=raceOptions(q.opts,v,false,qi,'survivalChoose',pv);
  const feedback=fb?fb.kind==='manual'?`<div class='survival-feedback neutral' role='status'><b>📮 Đã gửi tín hiệu về căn cứ</b><p>${esc(fb.text)}</p></div>`:fb.ok?`<div class='survival-feedback success' role='status'><b>✨ Chính xác! Nạp thêm năng lượng.</b><p>${esc(fb.text)}</p></div>`:`<div class='survival-feedback warning' role='status'><b>🛡️ Mất một khiên — nhưng em có thêm gợi ý.</b><p><strong>Đáp án phù hợp:</strong> ${esc(fb.answer||'')}</p><p>${esc(fb.text)}</p><span>${R.hp?'Còn '+R.hp+' khiên.':'Đã hết khiên; em vẫn có thể hoàn thành nhiệm vụ và học tiếp.'}</span></div>`:'';
  const actions=pv?'':fb?`<div class='survival-actions'><button class='btn light survival-back' type='button' data-noicon='1' onclick='survivalMove(-1)' ${qi===0?'disabled':''}>${ic('arrowLeft',18)}<span>Trạm trước</span></button>${fb.kind==='auto'&&!fb.ok?`<button class='btn light' type='button' data-noicon='1' onclick='survivalRevise()'>Sửa câu trả lời</button>`:''}<button class='btn survival-primary survival-forward' type='button' data-noicon='1' onclick='${qi===tot-1?'survivalFinish()':'survivalMove(1)'}'>${qi===tot-1?'Hoàn thành nhiệm vụ':'Tiếp trạm'}${ic('arrow',18)}</button></div>`:`<div class='survival-actions'><button class='btn light survival-back' type='button' data-noicon='1' onclick='survivalMove(-1)' ${qi===0?'disabled':''}>${ic('arrowLeft',18)}<span>Trạm trước</span></button><button class='btn survival-primary' type='button' data-noicon='1' onclick='survivalCheck()'>Kiểm tra & nhận gợi ý ${ic('spark',17)}</button></div>`;
  return `<section class='panel survival-game' ${pv?'':`id='rd-top' tabindex='-1'`} aria-labelledby='survival-title'><div class='survival-sky'><div class='survival-topline'><span class='survival-kicker'>${pv?'MẪU GIAO DIỆN':R.playMode==='multi'?'ĐỘI SINH TỒN':'HÀNH TRÌNH CÁ NHÂN'}</span><span class='survival-mission'>${esc(a.name)}</span></div><h2 id='survival-title'>🏝️ Sinh tồn tri thức</h2><p>Khám phá từng trạm. Trả lời đúng để nạp năng lượng; nếu sai, em mất một khiên nhưng sẽ nhận lời giải để học tiếp.</p><div class='survival-hud'><div class='survival-stat'><span>🛡️ KHIÊN</span><b id='survival-hp'>${'♥'.repeat(R.hp)}${'♡'.repeat(Math.max(0,3-R.hp))}</b></div><div class='survival-stat'><span>⚡ NĂNG LƯỢNG</span><b><i id='survival-energy'>${correct}</i> / ${tot}</b></div><div class='survival-stat'><span>📍 TRẠM</span><b>${qi+1} / ${tot}</b></div></div><div class='survival-path'><div class='survival-progress'><span id='survival-progress' style='width:${tot?Math.round(done/tot*100):0}%'></span></div><span class='survival-progress-label' id='survival-progress-label'>Đã khám phá ${done}/${tot} trạm</span><div class='survival-stage-dots'>${R.qs.map((x,i)=>`<span class='${i<qi?'passed':i===qi?'current':''}' aria-label='Trạm ${i+1}'></span>`).join('')}</div></div></div><div class='survival-content'>${a.desc?`<p class='survival-instructions'>${esc(a.desc)}</p>`:''}${prev?`<p class='muted'>${prev}</p>`:''}<div class='survival-question-head'><span class='survival-zone'>KHU VỰC ${String(qi+1).padStart(2,'0')}</span><span class='survival-points'>${q.w} điểm · ${raceHint(q.type)}</span></div><h3 class='race-question'>${esc(q.content)}</h3>${answer}<div class='race-answer-status' id='survival-answer-status' aria-live='polite'>${survivalAnswerState(q,v)}</div>${R.miss.includes(qi)?`<div class='race-missing' role='alert'>Câu này cần câu trả lời trước khi nộp.</div>`:''}${feedback}${actions}${pv?'':`<div class='survival-footnote'>Câu trả lời và điểm cuối cùng vẫn được lưu vào kết quả học tập để giáo viên phân tích.</div>`}</div></section>`;
}
