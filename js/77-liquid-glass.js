/* EducMind · js/77-liquid-glass.js
   Hiệu ứng “Liquid Glass”: ánh sáng phản chiếu theo con trỏ. Chỉ là trình bày, không đụng tới logic ứng dụng. */
/* =====================================================================
   EducMind · Liquid Glass runtime
   – Theo dõi con trỏ để dệt ánh sáng phản chiếu (specular) lên từng
     mặt kính, đúng như hiệu ứng quang học của iOS/iPadOS/macOS 26–27.
   – Không can thiệp vào logic ứng dụng: mọi thứ chỉ là trình bày.
   ===================================================================== */
(function () {
  var root = document.documentElement;
  root.classList.add('lg');

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches;

  /* Các bề mặt kính cần bắt sáng */
  var GLASS = [
    '.top', '.layout>.side', '.side-toggle', '.card', '.panel', '.tablewrap',
    '.selectbox', '.classcard', '.dlg', '.toast', '.login', '.btn', '.chip',
    '.pill', '.seg', '.folder-tabs', '.nav', '.folder-tile', '.folder-lesson-row',
    '.lesson-workspace', '.topic-block', '.student-task-card', '.student-rec-card',
    '.student-result-card', '.student-lesson', '.student-resource', '.gap-focus-card',
    '.race-game', '.blitz-game', '.survival-game', '.survival-lobby',
    '.survival-mode-card', '.race-question', '.race-arena', '.survival-mission',
    '.survival-zone', '.game-choice-card', '.ai-card', '.gr-work', '.gr-work-head',
    '.login-bg-panel'
  ].join(',');

  var raf = 0, pending = null;

  function paint(e) {
    raf = 0;
    var t = pending; pending = null;
    if (!t || !t.target || !t.target.closest) return;
    var el = t.target.closest(GLASS);
    if (!el) return;
    var r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var x = Math.max(0, Math.min(r.width, t.clientX - r.left));
    var y = Math.max(0, Math.min(r.height, t.clientY - r.top));
    el.style.setProperty('--lg-mx', x.toFixed(1) + 'px');
    el.style.setProperty('--lg-my', y.toFixed(1) + 'px');
  }

  function onMove(e) {
    if (e.pointerType === 'touch') return;
    pending = e;
    if (!raf) raf = requestAnimationFrame(paint);
  }

  if (fine && !reduce) {
    document.addEventListener('pointermove', onMove, { passive: true });
    /* Bàn phím: đưa điểm sáng về giữa viên kính đang được chọn */
    document.addEventListener('focusin', function (e) {
      var el = e.target && e.target.closest && e.target.closest(GLASS);
      if (!el) return;
      el.style.setProperty('--lg-mx', '50%');
      el.style.setProperty('--lg-my', '0%');
    }, true);
  }

  /* Vành sáng đậm hơn khi nội dung đã cuộn xuống dưới thanh trên */
  var scrolled = false;
  function onScroll() {
    var s = window.scrollY > 6;
    if (s === scrolled) return;
    scrolled = s;
    root.setAttribute('data-lg-scrolled', s ? '1' : '0');
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* Khi chuyển sáng/tối, trả các điểm sáng về mặc định để không bị lệch */
  var mo = new MutationObserver(function () {
    document.querySelectorAll('[style*="--lg-mx"]').forEach(function (el) {
      if (el !== document.documentElement) {
        el.style.removeProperty('--lg-mx');
        el.style.removeProperty('--lg-my');
      }
    });
  });
  mo.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
})();
