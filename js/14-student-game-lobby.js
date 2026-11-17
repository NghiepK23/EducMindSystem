/* EducMind · js/14-student-game-lobby.js
   Học sinh chọn trò chơi để làm bài tập và sảnh chờ “sinh tồn”. */
/* Bài sinh tồn: lựa chọn cá nhân hoặc nhiều người khi bắt đầu. Chế độ nhiều người dùng adapter realtime nếu được triển khai. */
let gameLaunch=null,gameLobby=null,survivalResult=null;
function openAssignmentMode(ai){
  const returnPage=page==='results'?'results':'assignments',c=selected(),s=me(),a=c.assignments[ai],b=a.subs[c.students.indexOf(s)];
  gameLobby=null;survivalResult=null;page='assignments';
  gameLaunch={type:'asg',ai,mode:'solo',game:rdPresentation(b,a),returnPage};render();window.scrollTo(0,0)
}
function chooseAssignmentGame(game){if(!gameLaunch||!['race','survival','blitz'].includes(game))return;gameLaunch.game=game;if(game!=='survival')gameLaunch.mode='solo';render()}
function chooseAssignmentMode(mode){if(!gameLaunch)return;gameLaunch.mode=mode;render()}
function cancelAssignmentMode(){const back=gameLaunch&&gameLaunch.returnPage||'assignments';gameLaunch=null;page=back;render();window.scrollTo(0,0)}
function startAssignmentGame(ai,mode,game){
  const c=selected(),s=me(),a=c.assignments[ai],b=a.subs[c.students.indexOf(s)];
  if(!a||!asgIsQ(a)||!['race','survival','blitz'].includes(game)){toast('Không mở được trò chơi này cho bài tập.');return}
  gameLaunch=null;survivalResult=null;
  if(game==='survival'&&mode==='multi'){gameLobby={type:'asg',ai,status:'idle',players:[],selected:[]};render();scanSurvivalPlayers();return}
  gameLobby=null;
  if(!b.redo)b.redo={qs:rdBuild(c,a),ans:{},miss:[],presentation:game,playMode:'solo',gameIndex:0,hp:3,feedback:{}};
  else{b.redo.presentation=game;b.redo.gameIndex=0;b.redo.miss=[];if(game==='survival'){b.redo.playMode='solo';b.redo.hp=Number.isFinite(b.redo.hp)?b.redo.hp:3;b.redo.feedback=b.redo.feedback||{}}}
  workOpen(ai,game);
}
function startSurvivalAssignment(ai,mode){return startAssignmentGame(ai,mode,'survival')}
function openSurvivalLobby(ai){gameLaunch=null;gameLobby={type:'asg',ai,status:'idle',players:[],selected:[]};render();scanSurvivalPlayers()}
async function scanSurvivalPlayers(){
  const L=gameLobby;if(!L||L.status==='loading')return;
  const api=window.EducMindRealtime;
  if(!api||typeof api.listOnlineStudents!=='function'){L.status='unavailable';render();return}
  L.status='loading';L.error='';render();
  try{const c=selected(),s=me(),rows=await api.listOnlineStudents({classId:c.id,excludeEmail:s.email});
    if(gameLobby!==L)return;L.players=(Array.isArray(rows)?rows:[]).filter(x=>x&&x.email!==s.email);L.selected=[];L.status='ready';
  }catch(e){if(gameLobby!==L)return;L.error=e&&e.message||'Không tải được danh sách người đang online.';L.status='error'}
  render();
}
function toggleSurvivalPlayer(email,on){if(!gameLobby)return;const a=gameLobby.selected||[];gameLobby.selected=on?(a.includes(email)?a:a.concat(email)):a.filter(x=>x!==email);render()}
async function inviteSurvivalPlayers(){
  if(!gameLobby||!gameLobby.selected.length){toast('Chọn ít nhất một bạn đang online.');return}
  const api=window.EducMindRealtime;
  if(!api||typeof api.createSurvivalRoom!=='function'){gameLobby.status='unavailable';render();return}
  const c=selected(),s=me(),a=c.assignments[gameLobby.ai];gameLobby.status='sending';render();
  try{gameLobby.room=await api.createSurvivalRoom({classId:c.id,assignmentId:a.aid,hostEmail:s.email,opponentEmails:gameLobby.selected});gameLobby.status='waiting'}
  catch(e){gameLobby.error=e&&e.message||'Không gửi được lời mời.';gameLobby.status='error'}render();
}
function survivalModePage(c,a,ai){
  const game=gameLaunch&&gameLaunch.game||'race',mode=gameLaunch&&gameLaunch.mode||'solo';
  const questions=Array.isArray(a.qs)?a.qs:[];
  const objectives=objLabels(c).filter(o=>(a.objs||[]).includes(o.j))
    .sort((x,y)=>String(x.code||'').localeCompare(String(y.code||''),undefined,{numeric:true,sensitivity:'base'}));
  const objectiveSummary=objectives.length
    ?objectives.map(o=>esc(o.label)).join('<br>')
    :'Bài tập chưa gắn mục tiêu học tập.';
  const cards=[
    {id:'race',icon:'🪢',title:'Kéo co tri thức',desc:'Trả lời lần lượt từng chặng, kéo đội mình tiến gần vạch đích. Mỗi câu đều tính vào kết quả bài.'},
    {id:'survival',icon:'🏝️',title:'Sinh tồn tri thức',desc:'Khám phá từng trạm, giữ khiên và nhận lời giải thích ngay sau mỗi câu sai.'},
    {id:'blitz',icon:'⚡',title:'Combo chớp nhoáng',desc:'Trả lời liên tiếp để xây chuỗi đúng. Nhận phản hồi từng câu và thử phá kỷ lục combo của mình.'},
  ];
  const cardsHtml=cards.map(x=>`
    <button type='button' class='survival-mode-card game-choice-card game-choice-card--${x.id} ${game===x.id?'chosen':''}' aria-pressed='${game===x.id}' onclick="chooseAssignmentGame('${x.id}')">
      <span class='survival-mode-icon game-choice-icon--${x.id}' aria-hidden='true'>${x.icon}</span>
      <span class='game-choice-copy'><b>${x.title}</b><small>${x.desc}</small></span>
      <span class='survival-radio' aria-hidden='true'>${game===x.id?'✓':''}</span>
    </button>`).join('');
  const multi=game==='survival';
  const modeNote=multi?'Chọn chơi một mình hoặc mời bạn cùng lớp nếu dịch vụ realtime sẵn sàng.':'Chế độ nhiều người chỉ khả dụng với Sinh tồn tri thức khi dịch vụ realtime sẵn sàng.';
  const action=multi&&mode==='multi'?`<button type='button' class='btn survival-primary' data-noicon='1' onclick='openSurvivalLobby(${ai})'>Tìm bạn đang online ${ic('arrow',18)}</button>`:`<button type='button' class='btn survival-primary' data-noicon='1' onclick="startAssignmentGame(${ai},'solo','${game}')">Bắt đầu ${game==='race'?'kéo co':game==='survival'?'sinh tồn':game==='blitz'?'combo':'ôn luyện'} ${ic('arrow',18)}</button>`;
  return `<div class='assignment-game-layout'>
    <section class='panel survival-mode game-mode-picker assignment-game-main' aria-labelledby='survival-mode-title'>
      <div class='survival-mode-hero'>
        <span class='survival-kicker'>✦ NHIỆM VỤ HỌC TẬP · ${esc(questions.length)} CÂU · ${esc(a.max)} ĐIỂM</span>
        <h2 id='survival-mode-title'>Chọn cách luyện tập</h2>
        <p><b>${esc(a.name)}</b> · Cùng một bộ câu hỏi, em có thể chọn thử thách phù hợp. Tiến độ, câu trả lời và kết quả vẫn được ghi nhận cho bài tập này.</p>
      </div>
      <div class='assignment-game-content'>
        <div class='assignment-game-heading'>
          <div><h3>Chọn trò chơi</h3><p>Chọn một cách học để bắt đầu nhiệm vụ</p></div>
          <span class='assignment-game-step'>BƯỚC 1 / 2</span>
        </div>
        <div class='survival-mode-options assignment-game-options' role='group' aria-label='Chọn trò chơi luyện tập'>${cardsHtml}</div>
        <div class='game-play-mode'>
          <div class='game-choice-label'>Cách tham gia</div>
          <button type='button' class='game-mode-chip ${mode==='solo'?'chosen':''}' aria-pressed='${mode==='solo'}' onclick="chooseAssignmentMode('solo')">🧭 Cá nhân</button>
          ${multi?`<button type='button' class='game-mode-chip ${mode==='multi'?'chosen':''}' aria-pressed='${mode==='multi'}' onclick="chooseAssignmentMode('multi')">👥 Nhiều người</button>`:''}
          <span class='muted game-mode-note'>${modeNote}</span>
        </div>
        <div class='assignment-game-actions'>
          <button type='button' class='btn light' data-noicon='1' onclick='cancelAssignmentMode()'>Quay lại</button>
          ${action}
        </div>
        <p class='assignment-game-privacy'>Lựa chọn trò chơi chỉ thay đổi cách luyện tập; câu trả lời và kết quả vẫn được lưu theo bài tập.</p>
      </div>
    </section>
    <aside class='panel assignment-game-aside' aria-labelledby='assignment-mission-title'>
      <h3 id='assignment-mission-title'>Mục tiêu học tập</h3>
      <div class='assignment-mission'>
        <span class='assignment-mission-icon' aria-hidden='true'>🎯</span>
        <div><span>${objectiveSummary}</span></div>
      </div>
    </aside>
  </div>`;
}

function survivalLobbyPage(c,a,ai){
  const L=gameLobby||{},status=L.status||'idle';
  const body=status==='unavailable'?`<div class='survival-live-note' role='status'><b>Chưa kết nối dịch vụ trực tuyến</b><p>Bản prototype hiện không có máy chủ hiện diện thời gian thực nên không thể xác minh bạn nào đang online hoặc đồng bộ một trận đấu giữa nhiều tài khoản. Không hiển thị danh sách giả.</p></div>`:
    status==='loading'?`<div class='survival-empty'><span class='survival-spinner'></span>Đang quét học sinh online…</div>`:
    status==='error'?`<div class='survival-live-note' role='alert'><b>Chưa quét được danh sách</b><p>${esc(L.error||'Hãy thử lại.')}</p></div>`:
    status==='waiting'?`<div class='survival-live-note'><b>Đã tạo lời mời</b><p>Đang chờ người chơi chấp nhận. Đồng bộ trận đấu cần dịch vụ realtime.</p></div>`:
    (L.players||[]).length?`<div class='survival-roster'>${L.players.map(x=>`<label class='survival-player'><input type='checkbox' value='${esc(x.email)}' ${(L.selected||[]).includes(x.email)?'checked':''} onchange='toggleSurvivalPlayer(this.value,this.checked)'><span class='online-dot'></span><span><b>${esc(x.name||x.email)}</b><small>Đang online · ${esc(x.className||c.id)}</small></span></label>`).join('')}</div>`:`<div class='survival-empty'>Chưa có bạn cùng lớp nào đang online. Hãy quét lại sau.</div>`;
  return `<section class='panel survival-lobby' aria-labelledby='survival-lobby-title'><div class='survival-mode-hero'><span class='survival-kicker'>PHÒNG CHỜ · ${esc(c.id)}</span><h2 id='survival-lobby-title'>Chọn bạn cùng sinh tồn</h2><p>Chỉ mời học sinh thật sự đang online trong cùng lớp. Tất cả cùng nhận một bộ câu hỏi và bảng xếp hạng theo kết quả.</p></div><div class='survival-lobby-body'><div class='row between'><b>Học sinh đang online</b><button type='button' class='btn light' data-noicon='1' onclick='scanSurvivalPlayers()'>↻ Quét lại</button></div>${body}<div class='survival-mode-actions'><button type='button' class='btn light' data-noicon='1' onclick='gameLobby=null;openAssignmentMode(${ai})'>Quay lại chọn chế độ</button><button type='button' class='btn' data-noicon='1' onclick='startSurvivalAssignment(${ai},"solo")'>Chơi cá nhân thay thế</button>${status==='ready'&&(L.players||[]).length?`<button type='button' class='btn survival-primary' data-noicon='1' onclick='inviteSurvivalPlayers()' ${L.selected.length?'':'disabled'}>Gửi lời thách đấu</button>`:''}</div></div></section>`;
}
function survivalResultPage(){
  const r=survivalResult;if(!r)return '';
  return `<section class='panel survival-result' aria-labelledby='survival-result-title'><div class='survival-result-mark' aria-hidden='true'>🏆</div><span class='survival-kicker'>HÀNH TRÌNH ĐÃ KHÉP LẠI</span><h2 id='survival-result-title'>Nhiệm vụ hoàn thành!</h2><p>${esc(r.name)}</p><div class='survival-result-stats'><div><b>${r.correct}/${r.count}</b><span>câu đúng</span></div><div><b>${r.score==null?'—':esc(r.score)+'/'+esc(r.max)}</b><span>${r.waiting?'đang chờ chấm':'điểm bài'}</span></div></div><p class='muted'>${r.waiting?'Bài đã được nộp; điểm cuối cùng sẽ cập nhật sau khi giáo viên chấm.':'Kết quả đã được lưu vào bài tập và phân tích học tập.'}</p><button type='button' class='btn survival-primary' data-noicon='1' onclick='survivalResult=null;render()'>Về danh sách bài tập</button></section>`;
}
