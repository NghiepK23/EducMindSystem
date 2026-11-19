/* EducMind · US-57: người dùng chọn loại thông báo muốn nhận.
 * Script cần nạp sau js/db/16-live.js và trước js/76-main.js.
 * Không lọc thông báo ở giao diện: trigger Supabase quyết định thông báo có được tạo hay không.
 * Không làm thay đổi thông báo đã nhận trước khi người dùng tắt loại thông báo.
 */
const DB_NOTIF_OPTIONS = [
  ['Học tập', [
    ['NEW_LESSON_PUBLISHED', 'Bài học mới', 'Khi giáo viên xuất bản bài học mới.'],
    ['NEW_ASSIGNMENT_PUBLISHED', 'Bài tập mới', 'Khi có bài tập được giao.'],
    ['NEW_ASSESSMENT_PUBLISHED', 'Bài kiểm tra mới', 'Khi có bài kiểm tra mới được công bố.'],
    ['ASSIGNMENT_GRADED', 'Kết quả bài tập', 'Khi bài tập đã được chấm hoặc cập nhật điểm.'],
    ['ASSESSMENT_GRADED', 'Kết quả bài kiểm tra', 'Khi bài kiểm tra đã được chấm.'],
    ['NEW_RECOMMENDATION', 'Gợi ý học tập', 'Khi có gợi ý học tập mới.'],
  ]],
  ['Lớp học và nộp bài', [
    ['ADDED_TO_CLASS', 'Được thêm vào lớp', 'Khi được giáo viên thêm vào lớp học.'],
    ['NEW_SUBMISSION', 'Học sinh nộp bài', 'Khi có bài nộp mới cần xem.'],
    ['SUBMISSION_RESUBMITTED', 'Học sinh cập nhật bài nộp', 'Khi học sinh sửa bài đã nộp.'],
    ['NEW_ASSESSMENT_ATTEMPT_SUBMITTED', 'Học sinh nộp bài kiểm tra', 'Khi có lượt kiểm tra mới được nộp.'],
    ['CLASS_MEMBER_JOINED', 'Thành viên mới vào lớp', 'Khi có học sinh tham gia lớp.'],
  ]],
  ['Trợ lý AI', [
    ['AI_GENERATION_COMPLETED', 'AI hoàn thành công việc', 'Khi AI tạo xong câu hỏi.'],
    ['AI_GENERATION_FAILED', 'AI gặp lỗi', 'Khi việc tạo câu hỏi bằng AI không thành công.'],
  ]],
];

/* Bổ sung một mục vào menu dành cho cả giáo viên và học sinh.
 * Dùng mảng có sẵn, không sửa trực tiếp file shell để giảm xung đột merge.
 */
for (const nav of [DB_NAV_T, DB_NAV_S]) {
  if (!nav.some(([, items]) => items.some(([key]) => key === 'notificationSettings'))) {
    nav.push(['Cài đặt', [['notificationSettings', 'Tùy chỉnh thông báo', 'bell']]]);
  }
}

DB_PAGES.notificationSettings = {
  title: 'Tùy chỉnh thông báo',
  sub: 'Chọn những loại thông báo bạn muốn nhận trong EducMind.',
  noClass: true,
  async load() {
    if (!DB.me) return [];
    /* dbCall hiển thị lỗi đúng quy ước nếu bảng/chính sách Supabase chưa được triển khai. */
    return await dbCall(supabaseClient.from('notification_preferences')
      .select('notification_type,enabled')
      .eq('user_id', DB.me.id));
  },
  view(rows) {
    const settings = new Map((rows || []).map((r) => [r.notification_type, r.enabled]));
    const blocks = DB_NOTIF_OPTIONS.map(([groupName, entries]) => `
      <section class="panel db-pref-group">
        <h2>${h(groupName)}</h2>
        ${entries.map(([type, label, desc]) => {
          const checked = settings.get(type) !== false;
          return `<label class="db-pref-item">
            <span class="db-pref-info"><strong>${h(label)}</strong><small>${h(desc)}</small></span>
            <input type="checkbox" id="pref-${h(type)}" data-change="saveNotificationPref" data-type="${h(type)}" ${checked ? 'checked' : ''} aria-label="Nhận thông báo: ${h(label)}">
          </label>`;
        }).join('')}
      </section>`).join('');
    return `<section class="db-pref-page" aria-label="Tùy chỉnh thông báo">
      <p class="muted db-pref-explain">Các lựa chọn được lưu theo tài khoản của bạn. Tắt một loại chỉ ngăn tạo <strong>thông báo mới</strong> thuộc loại đó; những thông báo đã nhận vẫn được giữ lại. Các cảnh báo tài khoản bắt buộc không nằm trong danh sách này.</p>
      ${blocks}
    </section>`;
  },
};

DB_ACT.saveNotificationPref = async (el) => {
  const type = el.dataset.type;
  if (!DB.me || !DB_NOTIF_OPTIONS.some(([, entries]) => entries.some(([t]) => t === type))) return;
  const enabled = el.checked;
  el.disabled = true;
  try {
    await dbCall(supabaseClient.from('notification_preferences').upsert({
      user_id: DB.me.id,
      notification_type: type,
      enabled,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,notification_type' }));
    if (Array.isArray(DB.data)) {
      const row = DB.data.find((r) => r.notification_type === type);
      if (row) row.enabled = enabled;
      else DB.data.push({ notification_type: type, enabled });
    }
    toast(enabled ? 'Đã bật loại thông báo.' : 'Đã tắt loại thông báo.');
  } catch (e) {
    el.checked = !enabled;
    console.warn('Không lưu được cài đặt thông báo:', e);
    toast('Không lưu được cài đặt. Hãy thử lại hoặc liên hệ nhóm quản trị.');
  } finally {
    el.disabled = false;
  }
};
