/* EducMind · js/db/03-classes.js
   Trang Lớp học: giáo viên tạo / sửa / xóa lớp, xem mã lớp, thêm và gỡ học sinh; học sinh vào lớp bằng mã. */

DB_PAGES.classes = {
  noClass: true,
  title: () => (dbIsTeacher() ? 'Lớp học phụ trách' : 'Lớp của em'),
  sub: () => (dbIsTeacher() ? 'Mỗi lớp có một mã lớp. Học sinh dùng mã này để tự vào lớp.' : 'Vào lớp bằng mã do giáo viên cung cấp.'),
  async load() {
    await dbLoadClasses();
    if (DB.classId && (!DB.course || DB.course.class_id !== DB.classId)) await dbLoadCourse();
    const ids = DB.classes.map((c) => c.id);
    const members = await dbCallIn(EducMindDB.listMembers, ids);
    if (dbIsTeacher()) {
      const [invites, profiles] = await Promise.all([dbCallIn(EducMindDB.listInvites, ids), dbCallIn(EducMindDB.listProfiles, members.map((m) => m.student_id))]);
      return { members, invites, profiles: dbById(profiles) };
    }
    const teachers = await dbCallIn(EducMindDB.listProfiles, DB.classes.map((c) => c.owner_teacher_id));
    return { members, profiles: dbById(teachers) };
  },
  view(d) { return dbIsTeacher() ? dbClassesTeacher(d) : dbClassesStudent(d); },
};

const dbClassMeta = (c) => [c.grade ? 'Khối ' + h(c.grade) : '', h(c.school_year || '')].filter(Boolean).join(' · ');
/* Mã lớp đang dùng: mã mới nhất chưa bị thu hồi và chưa hết hạn. */
function dbActiveCode(invites, classId) {
  const now = dbNow();
  const inv = (invites || []).find((i) => i.class_id === classId && !i.revoked_at && (!i.expires_at || new Date(i.expires_at).getTime() > now));
  return inv ? inv.code : '';
}

function dbClassesTeacher(d) {
  const byClass = dbGroup(d.members, 'class_id');
  const cards = DB.classes.map((c) => {
    const n = (byClass[c.id] || []).length, code = dbActiveCode(d.invites, c.id);
    return `<div class="classcard${c.id === DB.classId ? ' selected' : ''}">
      <div class="classcard-top">
        <button type="button" class="classcard-name" data-act="selectClass" data-id="${h(c.id)}" ${c.id === DB.classId ? 'aria-current="true"' : ''}><b>${h(c.name)}</b></button>
        <div class="classcard-actions">${dbBtn('Sửa', 'editClass', { id: c.id }, 'light mini')}${dbBtn('Xóa', 'archiveClass', { id: c.id }, 'light mini danger-soft')}</div>
      </div>
      <div class="meta">${dbClassMeta(c) || 'Chưa ghi khối / năm học'}</div>
      <div class="meta"><b>${n}</b> học sinh · Mã lớp <b class="db-code">${h(code || '—')}</b></div>
    </div>`;
  }).join('');
  const cur = dbClass();
  return `
  <section class="panel" aria-labelledby="db-h-classes">
    <h2 id="db-h-classes">Danh sách lớp</h2>
    <p class="lead">${DB.classes.length ? DB.classes.length + ' lớp · bấm vào tên lớp để chọn lớp làm việc.' : 'Chưa có lớp nào. Hãy tạo lớp đầu tiên ở khung bên dưới.'}</p>
    ${cards ? `<div class="grid db-class-grid">${cards}</div>` : ''}
  </section>
  <section class="panel" aria-labelledby="db-h-newclass">
    <h2 id="db-h-newclass">Tạo lớp mới</h2>
    <form data-act="createClass" class="db-form-row" novalidate>
      ${dbField('Tên lớp', 'db-class-name', `<input id="db-class-name" name="name" maxlength="100" placeholder="Ví dụ: 10A1" required>`)}
      ${dbField('Khối', 'db-class-grade', `<input id="db-class-grade" name="grade" type="number" min="1" max="12" inputmode="numeric" placeholder="1–12">`)}
      ${dbField('Năm học', 'db-class-year', `<input id="db-class-year" name="year" maxlength="20" placeholder="2026-2027">`)}
      <button type="submit" class="btn">Tạo lớp</button>
      ${dbFormError()}
    </form>
  </section>
  ${cur ? dbClassMembersPanel(cur, d) : ''}`;
}

function dbClassMembersPanel(c, d) {
  const code = dbActiveCode(d.invites, c.id);
  const list = (d.members || []).filter((m) => m.class_id === c.id);
  const rows = list.map((m) => {
    const p = d.profiles[m.student_id];
    return `<tr><th scope="row">${h(dbName(p))}</th><td>${h(p ? p.email : '')}</td><td>${dbDateTime(m.joined_at)}</td><td class="db-cell-actions">${dbBtn('Gỡ khỏi lớp', 'removeMember', { id: m.student_id }, 'light mini danger-soft')}</td></tr>`;
  });
  return `
  <section class="panel" aria-labelledby="db-h-members">
    <div class="row between">
      <div><h2 id="db-h-members">Học sinh lớp ${h(c.name)}</h2><p class="lead">${list.length} học sinh</p></div>
      <div class="db-codebox"><span class="muted">Mã lớp</span><b class="db-code" id="db-join-code">${h(code || '—')}</b>${code ? dbBtn('Sao chép', 'copyCode', { code }, 'light mini') : ''}</div>
    </div>
    <form data-act="addStudent" class="db-form-row" novalidate>
      ${dbField('Thêm học sinh bằng email', 'db-add-email', `<input id="db-add-email" name="email" type="email" placeholder="email học sinh đã đăng ký" autocomplete="off" required>`)}
      <button type="submit" class="btn light">Thêm vào lớp</button>
      ${dbFormError()}
    </form>
    ${rows.length ? dbTable(['Họ và tên', 'Email', 'Vào lớp lúc', '<span class="sr">Thao tác</span>'], rows, 'Học sinh của lớp') : dbEmpty('Lớp chưa có học sinh. Gửi mã lớp cho học sinh hoặc thêm bằng email.')}
  </section>`;
}

function dbClassesStudent(d) {
  const joined = Object.fromEntries((d.members || []).map((m) => [m.class_id, m.joined_at]));
  const cards = DB.classes.map((c) => `<div class="classcard${c.id === DB.classId ? ' selected' : ''}">
      <div class="classcard-top"><button type="button" class="classcard-name" data-act="selectClass" data-id="${h(c.id)}" ${c.id === DB.classId ? 'aria-current="true"' : ''}><b>${h(c.name)}</b></button></div>
      <div class="meta">${dbClassMeta(c)}</div>
      <div class="meta">Giáo viên: <b>${h(dbName(d.profiles[c.owner_teacher_id]))}</b></div>
      ${joined[c.id] ? `<div class="meta">Vào lớp lúc ${dbDateTime(joined[c.id])}</div>` : ''}
    </div>`).join('');
  return `
  <section class="panel" aria-labelledby="db-h-join">
    <h2 id="db-h-join">Vào lớp bằng mã</h2>
    <form data-act="joinClass" class="db-form-row" novalidate>
      ${dbField('Mã lớp', 'db-join-code-input', `<input id="db-join-code-input" name="code" maxlength="12" placeholder="Ví dụ: 3FA9C2D1" autocomplete="off" autocapitalize="characters" required>`)}
      <button type="submit" class="btn">Vào lớp</button>
      ${dbFormError()}
    </form>
  </section>
  <section class="panel" aria-labelledby="db-h-classes">
    <h2 id="db-h-classes">Lớp đang học</h2>
    ${cards ? `<p class="lead">Bấm vào tên lớp để chọn lớp đang xem.</p><div class="grid db-class-grid">${cards}</div>` : dbEmpty('Em chưa vào lớp nào.')}
  </section>`;
}

/* ===== Thao tác ===== */
DB_ACT.selectClass = (el) => dbSetClass(el.dataset.id, 'classes');
DB_ACT.copyCode = async (el) => {
  try { await navigator.clipboard.writeText(el.dataset.code); toast('Đã sao chép mã lớp ' + el.dataset.code + '.'); }
  catch (_) { toast('Không sao chép tự động được. Mã lớp: ' + el.dataset.code); }
};
function dbReadClassForm(v) {
  const name = (v.name || '').trim();
  if (!name) throw new Error('Nhập tên lớp.');
  if (name.length > 100) throw new Error('Tên lớp tối đa 100 ký tự.');
  let grade = null;
  if (v.grade !== '' && v.grade != null) {
    grade = Number(v.grade);
    if (!Number.isInteger(grade) || grade < 1 || grade > 12) throw new Error('Khối là số nguyên từ 1 đến 12 (có thể để trống).');
  }
  return { name, grade, year: (v.year || '').trim() || null };
}
DB_ACT.createClass = (form) => dbRun(form, async (v) => {
  const c = dbReadClassForm(v);
  const made = await dbCall(EducMindDB.createClass(c.name, c.grade, c.year));
  const row = Array.isArray(made) ? made[0] : made;
  DB.classId = row.class_id;
  try { localStorage.setItem('educmind.db.class', DB.classId); } catch (_) {}
  DB.course = null;
  /* Mỗi lớp có sẵn một khóa học để chứa bài học, bài tập, câu hỏi. Nếu bước này lỗi, dbEnsureCourse() sẽ tạo lại khi cần. */
  try { DB.course = await dbCall(EducMindDB.createCourse({ class_id: row.class_id, title: c.name })); } catch (e) { console.warn('Chưa tạo được khóa học mặc định:', e.message); }
  toast('Đã tạo lớp ' + c.name + '. Mã lớp: ' + row.join_code);
});
DB_ACT.editClass = (el) => {
  const c = DB.classes.find((x) => x.id === el.dataset.id);
  if (!c) return;
  dbOpenDialog({
    title: 'Sửa lớp ' + h(c.name), okLabel: 'Lưu thay đổi',
    body: dbField('Tên lớp', 'db-ec-name', `<input id="db-ec-name" name="name" maxlength="100" value="${h(c.name)}" required>`)
      + dbField('Khối', 'db-ec-grade', `<input id="db-ec-grade" name="grade" type="number" min="1" max="12" value="${h(c.grade == null ? '' : c.grade)}">`)
      + dbField('Năm học', 'db-ec-year', `<input id="db-ec-year" name="year" maxlength="20" value="${h(c.school_year || '')}">`),
    onOk: async (v) => {
      const x = dbReadClassForm(v);
      await dbCall(EducMindDB.updateClass(c.id, { name: x.name, grade: x.grade, school_year: x.year }));
      toast('Đã lưu thông tin lớp.');
    },
  });
};
DB_ACT.archiveClass = (el) => {
  const c = DB.classes.find((x) => x.id === el.dataset.id);
  if (!c) return;
  dbConfirm('Xóa lớp ' + h(c.name) + '?', 'Lớp sẽ biến mất khỏi danh sách của giáo viên và học sinh. Dữ liệu (bài học, bài nộp, điểm) vẫn được giữ trong cơ sở dữ liệu nhưng không mở lại được từ giao diện.', 'Xóa lớp', async () => {
    const r = await dbCall(EducMindDB.archiveClass(c.id));
    if (!r.length) throw new Error('Không xóa được lớp này.');
    if (DB.classId === c.id) { DB.classId = ''; DB.course = null; }
    toast('Đã xóa lớp ' + c.name + '.');
  }, true);
};
DB_ACT.addStudent = (form) => dbRun(form, async (v) => {
  const email = (v.email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Nhập đúng địa chỉ email của học sinh.');
  const r = await dbCall(EducMindDB.addStudentByEmail(DB.classId, email));
  if (r === 'ADDED') return void toast('Đã thêm ' + email + ' vào lớp.');
  throw new Error({
    ALREADY_MEMBER: 'Học sinh này đã ở trong lớp.',
    NOT_FOUND: 'Chưa có tài khoản nào dùng email này. Học sinh cần đăng ký tài khoản trước, hoặc tự vào lớp bằng mã lớp.',
    NOT_A_STUDENT: 'Email này thuộc tài khoản giáo viên nên không thêm vào lớp như học sinh được.',
  }[r] || 'Không thêm được học sinh (' + r + ').');
});
DB_ACT.removeMember = (el) => {
  const p = (DB.data.profiles || {})[el.dataset.id], c = dbClass();
  dbConfirm('Gỡ học sinh khỏi lớp?', `${h(dbName(p))} sẽ không còn thấy nội dung của lớp ${h(c ? c.name : '')}. Bài đã nộp và điểm vẫn được giữ.`, 'Gỡ khỏi lớp', async () => {
    const r = await dbCall(EducMindDB.removeMember(DB.classId, el.dataset.id));
    if (!r.length) throw new Error('Không gỡ được học sinh này.');
    toast('Đã gỡ học sinh khỏi lớp.');
  }, true);
};
DB_ACT.joinClass = (form) => dbRun(form, async (v) => {
  const code = (v.code || '').trim().toUpperCase();
  if (!code) throw new Error('Nhập mã lớp.');
  const classId = await dbCall(EducMindDB.joinClass(code));
  DB.classId = classId; DB.course = null;
  try { localStorage.setItem('educmind.db.class', DB.classId); } catch (_) {}
  toast('Đã vào lớp.');
});
