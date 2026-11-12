/* EducMind · js/db/16-live.js
   Realtime cho chuông thông báo: đăng ký kênh Supabase Realtime theo dòng thông báo của người dùng;
   khi có thông báo mới thì chuông tự cập nhật mà không cần tải lại trang.
   Nếu không có dịch vụ realtime (chạy localhost, mất kết nối…) thì tự chuyển sang chế độ dự phòng:
   tự nạp lại danh sách thông báo định kỳ. */

const DB_LIVE_POLL_MS = 10000;
const DB_LIVE = { channel: null, poll: null, subscribed: false };

function dbLiveStart() {
  dbLiveStop();
  if (!dbActive() || !DB.me) return;
  /* Dự phòng bật ngay: nếu kênh realtime đăng ký thành công thì dừng polling. */
  DB_LIVE.poll = setInterval(dbLoadNotifications, DB_LIVE_POLL_MS);
  try {
    if (typeof supabaseClient === 'undefined' || !supabaseClient.channel) return;
    const ch = supabaseClient.channel('db-notifs-' + DB.me.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + DB.me.id }, (payload) => {
        const n = payload && payload.new;
        if (!n || !n.id || DB.notifs.some((x) => x.id === n.id)) return;
        DB.notifs.unshift(n);
        if (DB.notifs.length > 30) DB.notifs.length = 30;
        dbPaintBell();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          DB_LIVE.subscribed = true;
          if (DB_LIVE.poll) { clearInterval(DB_LIVE.poll); DB_LIVE.poll = null; }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          DB_LIVE.subscribed = false;
          if (!DB_LIVE.poll) DB_LIVE.poll = setInterval(dbLoadNotifications, DB_LIVE_POLL_MS);
        }
      });
    DB_LIVE.channel = ch;
  } catch (e) {
    console.warn('Realtime không khả dụng, dùng chế độ tự nạp lại:', e.message || e);
    DB_LIVE.subscribed = false;
  }
}
function dbLiveStop() {
  if (DB_LIVE.channel) {
    try { supabaseClient.removeChannel(DB_LIVE.channel); } catch (_) { /* kênh đã đóng */ }
    DB_LIVE.channel = null;
  }
  if (DB_LIVE.poll) { clearInterval(DB_LIVE.poll); DB_LIVE.poll = null; }
  DB_LIVE.subscribed = false;
}
