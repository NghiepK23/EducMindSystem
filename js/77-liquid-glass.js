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
    if (el.closest('.login-wrap')) return;
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
      if (el.closest('.login-wrap')) return;
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

  var sideScrollTarget = null;
  var sideScrollbar = null;
  var sideScrollbarThumb = null;
  var sideScrollbarFrame = 0;
  var sideScrollbarSyncFrame = 0;
  var sideScrollDrag = null;

  function renderSideScrollbar() {
    if (!sideScrollTarget || !sideScrollbar) return;

    var maxScroll = sideScrollTarget.scrollHeight - sideScrollTarget.clientHeight;
    var rect = sideScrollTarget.getBoundingClientRect();
    var trackHeight = Math.max(0, rect.height - 80);
    if (maxScroll <= 0 || trackHeight < 18) {
      sideScrollTarget.classList.remove('lg-custom-scrollbar');
      sideScrollbar.hidden = true;
      return;
    }

    sideScrollTarget.classList.add('lg-custom-scrollbar');
    sideScrollbar.hidden = false;
    sideScrollbar.style.top = (rect.top + 40) + 'px';
    sideScrollbar.style.left = (rect.right - 4 - sideScrollbar.offsetWidth) + 'px';
    sideScrollbar.style.height = trackHeight + 'px';

    // Keep the full scroll range while rendering a 20% shorter handle.
    var thumbHeight = Math.max(18, trackHeight * sideScrollTarget.clientHeight / sideScrollTarget.scrollHeight * .8);
    thumbHeight = Math.min(trackHeight, thumbHeight);
    var thumbTravel = trackHeight - thumbHeight;
    var progress = maxScroll ? sideScrollTarget.scrollTop / maxScroll : 0;
    sideScrollbarThumb.style.height = thumbHeight + 'px';
    sideScrollbarThumb.style.top = (thumbTravel * progress) + 'px';
    sideScrollbar.setAttribute('aria-valuemax', String(Math.round(maxScroll)));
    sideScrollbar.setAttribute('aria-valuenow', String(Math.round(sideScrollTarget.scrollTop)));
  }

  function scheduleSideScrollbarRender() {
    if (sideScrollbarFrame) return;
    sideScrollbarFrame = requestAnimationFrame(function () {
      sideScrollbarFrame = 0;
      renderSideScrollbar();
    });
  }

  function setSideScrollFromPointer(clientY, offset) {
    if (!sideScrollTarget || !sideScrollbar || sideScrollbar.hidden) return;
    var rect = sideScrollbar.getBoundingClientRect();
    var travel = rect.height - sideScrollbarThumb.offsetHeight;
    if (travel <= 0) return;
    var position = Math.max(0, Math.min(travel, clientY - rect.top - offset));
    var maxScroll = sideScrollTarget.scrollHeight - sideScrollTarget.clientHeight;
    sideScrollTarget.scrollTop = position / travel * maxScroll;
    renderSideScrollbar();
  }

  function createSideScrollbar() {
    sideScrollbar = document.createElement('div');
    sideScrollbar.className = 'lg-side-scrollbar';
    sideScrollbar.setAttribute('role', 'scrollbar');
    sideScrollbar.setAttribute('aria-label', 'Cuộn thanh điều hướng');
    sideScrollbar.setAttribute('aria-orientation', 'vertical');
    sideScrollbar.setAttribute('aria-valuemin', '0');
    sideScrollbar.tabIndex = 0;
    sideScrollbar.hidden = true;

    sideScrollbarThumb = document.createElement('div');
    sideScrollbarThumb.className = 'lg-side-scrollbar-thumb';
    sideScrollbarThumb.setAttribute('aria-hidden', 'true');
    sideScrollbar.appendChild(sideScrollbarThumb);
    var layout = document.querySelector('#app .layout');
    (layout || document.body).appendChild(sideScrollbar);

    sideScrollbar.addEventListener('pointerdown', function (event) {
      if (event.button !== 0 || sideScrollDrag) return;
      event.preventDefault();
      var thumbRect = sideScrollbarThumb.getBoundingClientRect();
      var onThumb = event.target === sideScrollbarThumb;
      sideScrollDrag = {
        pointerId: event.pointerId,
        offset: onThumb ? event.clientY - thumbRect.top : thumbRect.height / 2
      };
      sideScrollbar.setPointerCapture(event.pointerId);
      if (!onThumb) setSideScrollFromPointer(event.clientY, sideScrollDrag.offset);
    });
    sideScrollbar.addEventListener('pointermove', function (event) {
      if (!sideScrollDrag || sideScrollDrag.pointerId !== event.pointerId) return;
      setSideScrollFromPointer(event.clientY, sideScrollDrag.offset);
    });
    function stopSideScrollDrag(event) {
      if (sideScrollDrag && sideScrollDrag.pointerId === event.pointerId) sideScrollDrag = null;
    }
    sideScrollbar.addEventListener('pointerup', stopSideScrollDrag);
    sideScrollbar.addEventListener('pointercancel', stopSideScrollDrag);
    sideScrollbar.addEventListener('lostpointercapture', function () {
      sideScrollDrag = null;
    });
    sideScrollbar.addEventListener('keydown', function (event) {
      if (!sideScrollTarget) return;
      var maxScroll = sideScrollTarget.scrollHeight - sideScrollTarget.clientHeight;
      var step = Math.max(40, sideScrollTarget.clientHeight * .15);
      var nextScroll = null;
      switch (event.key) {
        case 'ArrowDown': nextScroll = sideScrollTarget.scrollTop + step; break;
        case 'ArrowUp': nextScroll = sideScrollTarget.scrollTop - step; break;
        case 'PageDown': nextScroll = sideScrollTarget.scrollTop + sideScrollTarget.clientHeight * .9; break;
        case 'PageUp': nextScroll = sideScrollTarget.scrollTop - sideScrollTarget.clientHeight * .9; break;
        case 'Home': nextScroll = 0; break;
        case 'End': nextScroll = maxScroll; break;
        default: return;
      }
      event.preventDefault();
      sideScrollTarget.scrollTop = Math.max(0, Math.min(maxScroll, nextScroll));
      renderSideScrollbar();
    });
  }

  function syncSideScrollbar() {
    var nextTarget = window.innerWidth > 900 ? document.querySelector('#app .layout>.side') : null;
    if (nextTarget !== sideScrollTarget) {
      if (sideScrollTarget) {
        sideScrollTarget.removeEventListener('scroll', scheduleSideScrollbarRender);
        sideScrollTarget.classList.remove('lg-custom-scrollbar');
      }
      sideScrollTarget = nextTarget;
      if (sideScrollTarget) {
        if (!sideScrollTarget.id) sideScrollTarget.id = 'lg-sidebar-scroll-target';
        sideScrollTarget.addEventListener('scroll', scheduleSideScrollbarRender, { passive: true });
      } else if (sideScrollbar) {
        sideScrollbar.hidden = true;
      }
    }
    if (!sideScrollTarget) return;
    if (!sideScrollbar) createSideScrollbar();
    var layout = document.querySelector('#app .layout');
    if (layout && sideScrollbar.parentElement !== layout) layout.appendChild(sideScrollbar);
    sideScrollbar.setAttribute('aria-controls', sideScrollTarget.id);
    renderSideScrollbar();
  }

  var appForScrollbar = document.getElementById('app');
  if (appForScrollbar) {
    var sidebarObserver = new MutationObserver(scheduleSideScrollbarSync);
    function scheduleSideScrollbarSync() {
      if (sideScrollbarSyncFrame) return;
      sideScrollbarSyncFrame = requestAnimationFrame(function () {
        sideScrollbarSyncFrame = 0;
        syncSideScrollbar();
      });
    }
    sidebarObserver.observe(appForScrollbar, { childList: true, characterData: true, subtree: true });
    window.addEventListener('resize', scheduleSideScrollbarSync, { passive: true });
    scheduleSideScrollbarSync();
  }

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
