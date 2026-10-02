(() => {
  'use strict';

  const root = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const isDesktop = () => window.innerWidth > 900;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const nav = $('#nav');
  let kickDots = () => {}; // настоящая функция появится, когда запустится фон

  /* ---------- плавная прокрутка (Lenis) ---------- */
  let lenis = null;
  if (window.Lenis && !reduceMotion) {
    lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true, autoRaf: true });
  }

  // блокировка прокрутки страницы под окнами (кейс, диплом, просмотр картинок)
  let locks = 0;
  const lock = () => {
    if (locks++ === 0) { lenis?.stop(); document.body.classList.add('is-locked'); }
  };
  const unlock = () => {
    if (locks > 0 && --locks === 0) {
      lenis?.start();
      document.body.classList.remove('is-locked');
      kickDots();
    }
  };

  // горизонтальные ленты: свайп вбок не должен перехватываться вертикальной прокруткой
  const guardHorizontal = (el) => {
    el?.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) e.stopPropagation();
    }, { passive: true });
  };

  /* ---------- согласие на cookie ----------
     Пока посетитель не нажал «Принять», настройки (тема) в браузере не сохраняются.
     Сам ответ запоминаем, иначе окно показывалось бы при каждом заходе */
  const CONSENT_KEY = 'cookie-consent';
  const readStore = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const writeStore = (k, v) => {
    try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {}
  };
  const cookieBox = $('#cookie');
  if (cookieBox && !readStore(CONSENT_KEY)) {
    setTimeout(() => {
      cookieBox.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => cookieBox.classList.add('is-in')));
    }, 1600);
    cookieBox.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cookie]');
      if (!btn) return;
      const answer = btn.dataset.cookie;
      writeStore(CONSENT_KEY, answer);
      writeStore('theme', answer === 'accepted' ? root.dataset.theme : null);
      cookieBox.classList.remove('is-in');
      setTimeout(() => { cookieBox.hidden = true; }, 600);
    });
  }

  /* ---------- тема ---------- */
  const themeListeners = [];
  const applyTheme = (t) => {
    root.dataset.theme = t;
    if (readStore(CONSENT_KEY) === 'accepted') writeStore('theme', t);
    themeListeners.forEach((fn) => fn(t));
  };
  const themeToggle = $('#themeToggle');
  themeToggle?.addEventListener('click', () => {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    if (!document.startViewTransition || reduceMotion) { applyTheme(next); return; }
    // новая тема расходится кругом от кнопки
    const r = themeToggle.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const vt = document.startViewTransition(() => applyTheme(next));
    vt.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 800, easing: 'cubic-bezier(.22,1,.36,1)', pseudoElement: '::view-transition-new(root)' }
      );
    }).catch(() => {});
  });

  /* ---------- мобильное меню ---------- */
  const burger = $('#navBurger');
  const closeMenu = () => {
    nav.classList.remove('is-open');
    burger?.setAttribute('aria-expanded', 'false');
  };
  burger?.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    burger.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', (e) => {
    if (nav.classList.contains('is-open') && !nav.contains(e.target)) closeMenu();
  });

  /* ---------- якорные ссылки — плавно, с учётом плашки ---------- */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    closeMenu();
    if (lenis) lenis.scrollTo(target, { offset: -92, duration: 1.4 });
    else target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  });

  /* ---------- состояние плашки при прокрутке ---------- */
  const onWindowScroll = () => {
    nav.classList.toggle('is-scrolled', window.scrollY > 30);
    requestParallax();
  };
  window.addEventListener('scroll', onWindowScroll, { passive: true });

  /* ---------- заголовки по словам ---------- */
  const splitText = (el) => {
    if (el.dataset.splitDone) return;
    el.dataset.splitDone = '1';
    let i = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          // делим только по обычным пробелам: слова с &nbsp; остаются вместе
          const parts = child.textContent.split(/([ \t\n\r]+)/);
          const frag = document.createDocumentFragment();
          parts.forEach((p) => {
            if (!p) return;
            if (/^[ \t\n\r]+$/.test(p)) { frag.appendChild(document.createTextNode(' ')); return; }
            const w = document.createElement('span');
            w.className = 'w';
            const inner = document.createElement('i');
            inner.textContent = p;
            inner.style.setProperty('--i', i++);
            w.appendChild(inner);
            frag.appendChild(w);
          });
          child.replaceWith(frag);
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    };
    walk(el);
  };

  /* ---------- появление при прокрутке + счётчики ---------- */
  const countUp = (el) => {
    const to = parseFloat(el.dataset.count);
    if (Number.isNaN(to)) return;
    // дробные — с запятой («111,2»), большие — с пробелами («388 054»), data-prefix — например «+»
    const dec = (el.dataset.count.split('.')[1] || '').length;
    const fmt = (v) => (el.dataset.prefix || '') + v.toLocaleString('ru-RU', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    if (reduceMotion) { el.textContent = fmt(to); return; }
    const from = to === 0 ? 9 : 0; // ноль красиво «отсчитывается» вниз
    const dur = 1500;
    const t0 = performance.now();
    el.textContent = fmt(from);
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 4);
      const k = Math.pow(10, dec);
      el.textContent = fmt(Math.round((from + (to - from) * e) * k) / k);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const countIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      countIO.unobserve(en.target);
      countUp(en.target);
    });
  }, { threshold: 0.6 });

  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.classList.add('in');
      revealIO.unobserve(en.target);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

  const observeReveals = (scope) => {
    $$('[data-split]', scope).forEach(splitText);
    const targets = $$('[data-reveal], [data-split], [data-timeline]', scope).filter((el) => !el.closest('#hero'));
    const groups = new Map();
    targets.forEach((el) => {
      const p = el.parentElement;
      if (!groups.has(p)) groups.set(p, []);
      groups.get(p).push(el);
    });
    groups.forEach((els) => els.forEach((el, i) => el.style.setProperty('--d', `${Math.min(i * 0.08, 0.4)}s`)));
    $$('[data-timeline]', scope).forEach((list) => {
      $$(':scope > li', list).forEach((li, i) => li.style.setProperty('--i', i));
    });
    targets.forEach((el) => revealIO.observe(el));
    $$('[data-count]', scope).forEach((el) => countIO.observe(el));
  };
  observeReveals(document);

  /* ---------- короткие ролики на странице (без звука): грузятся и играют, только когда видны ---------- */
  const autoVids = $$('video[data-autoplay]');
  if (autoVids.length && !reduceMotion) {
    const vio = new IntersectionObserver((entries) => entries.forEach((en) => {
      const v = en.target;
      if (en.isIntersecting) {
        if (!v.getAttribute('src')) v.src = v.dataset.src;
        v.play().catch(() => {});
      } else v.pause();
    }), { threshold: 0.25 });
    autoVids.forEach((v) => vio.observe(v));
  }

  /* ---------- главный экран: появление при загрузке ---------- */
  const heroIntro = () => {
    $$('#hero [data-reveal-line]').forEach((el, i) => {
      el.style.setProperty('--d', `${0.25 + i * 0.1}s`);
      el.classList.add('in');
    });
    $$('#hero [data-reveal]').forEach((el, i) => {
      el.style.setProperty('--d', i === 0 ? '0.1s' : `${0.75 + i * 0.12}s`);
      el.classList.add('in');
    });
  };
  requestAnimationFrame(() => requestAnimationFrame(heroIntro));

  /* ---------- подсветка пункта меню ---------- */
  const navLinks = $$('[data-nav-link]');
  if (navLinks.length) {
    const setActive = (id) => {
      navLinks.forEach((l) => l.classList.toggle('is-active', l.getAttribute('href') === `#${id}`));
    };
    const spyIO = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) setActive(en.target.id); });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    navLinks.map((a) => $(a.getAttribute('href'))).filter(Boolean).forEach((s) => spyIO.observe(s));
  }

  /* ---------- параллакс ---------- */
  const heroInner = $('[data-hero-parallax]');
  let parallaxEls = [];
  const collectParallax = () => { parallaxEls = $$('[data-parallax]'); };
  let parallaxQueued = false;
  function requestParallax() {
    if (parallaxQueued || reduceMotion) return;
    parallaxQueued = true;
    requestAnimationFrame(updateParallax);
  }
  function updateParallax() {
    parallaxQueued = false;
    const vh = window.innerHeight;
    // сначала все замеры, потом все сдвиги: иначе браузер пересчитывает раскладку на каждом элементе
    const shifts = parallaxEls.map((el) => {
      // берём размеры родителя: у самого элемента уже есть сдвиг
      const pr = el.parentElement.getBoundingClientRect();
      if (pr.bottom < -300 || pr.top > vh + 300) return null;
      const center = pr.top + pr.height / 2 - vh / 2;
      return `0 ${(center * (parseFloat(el.dataset.parallax) || 0)).toFixed(1)}px`;
    });
    parallaxEls.forEach((el, i) => { if (shifts[i] !== null) el.style.translate = shifts[i]; });
    if (heroInner) {
      const y = window.scrollY;
      if (y < vh * 1.3) {
        heroInner.style.translate = `0 ${(y * 0.22).toFixed(1)}px`;
        heroInner.style.opacity = String(Math.max(0, 1 - y / (vh * 0.85)).toFixed(3));
      }
    }
  }
  collectParallax();
  requestParallax();
  window.addEventListener('resize', requestParallax, { passive: true });

  /* ---------- «живые» карточки: свечение, магнит, наклон ---------- */
  const spotlight = (card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  };
  const magnet = (el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate(${(dx * 0.18).toFixed(1)}px, ${(dy * 0.3).toFixed(1)}px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  };
  const tilt = (el) => {
    const host = el.closest('.case-card__stage') || el.parentElement;
    host.addEventListener('pointermove', (e) => {
      const r = host.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(1000px) rotateY(${(px * 14).toFixed(2)}deg) rotateX(${(-py * 10).toFixed(2)}deg)`;
    });
    host.addEventListener('pointerleave', () => { el.style.transform = ''; });
  };
  const enhance = (scope) => {
    if (!finePointer || reduceMotion) return;
    $$('[data-spotlight]', scope).forEach(spotlight);
    $$('[data-magnetic]', scope).forEach(magnet);
    $$('[data-tilt]', scope).forEach(tilt);
  };
  enhance(document);

  /* ---------- просмотр картинок и роликов ---------- */
  const lightbox = $('#lightbox');
  const lightboxImg = $('#lightboxImg');
  const lightboxVideo = $('#lightboxVideo');
  let lightboxOnClose = null;
  const showLightbox = () => {
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    lock();
  };
  const openLightbox = (src, alt) => {
    lightboxVideo.hidden = true;
    lightboxImg.hidden = false;
    lightboxImg.src = src;
    lightboxImg.alt = alt || '';
    showLightbox();
  };
  // ролик открывается крупно, с начала и со звуком; onClose — что сделать после закрытия
  const openVideo = (src, { poster = '', label = '', onClose = null } = {}) => {
    lightboxImg.hidden = true;
    lightboxImg.removeAttribute('src');
    lightboxVideo.hidden = false;
    lightboxVideo.poster = poster;
    lightboxVideo.setAttribute('aria-label', label);
    lightboxVideo.src = src;
    lightboxVideo.muted = false;
    lightboxOnClose = onClose;
    showLightbox();
    lightboxVideo.play().catch(() => {});
  };
  const closeLightbox = () => {
    if (!lightbox.classList.contains('is-open')) return false;
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    if (!lightboxVideo.hidden) {
      lightboxVideo.pause();
      // ролик выгружаем, когда окно уже скрылось
      setTimeout(() => {
        if (lightbox.classList.contains('is-open')) return;
        lightboxVideo.removeAttribute('src');
        lightboxVideo.load();
      }, 400);
    }
    unlock();
    const fn = lightboxOnClose;
    lightboxOnClose = null;
    fn?.();
    return true;
  };
  $$('[data-close]', lightbox).forEach((el) => el.addEventListener('click', closeLightbox));

  /* ---------- галерея экранов (iPhone / браузер) ---------- */
  const initGallery = (g) => {
    const track = $('[data-track]', g);
    if (!track || track.dataset.ready) return null;
    track.dataset.ready = '1';
    const slides = $$(':scope > .slide', track);
    const n = slides.length;
    const listeners = [];

    const navEl = document.createElement('div');
    navEl.className = 'gallery__nav';
    navEl.innerHTML =
      '<button class="gallery__btn gallery__btn--prev" type="button" aria-label="Предыдущий экран"><svg width="18" height="18"><use href="#icon-chevron"/></svg></button>' +
      '<div class="gallery__dots"></div>' +
      '<span class="gallery__count"></span>' +
      '<button class="gallery__btn gallery__btn--next" type="button" aria-label="Следующий экран"><svg width="18" height="18"><use href="#icon-chevron"/></svg></button>';
    g.appendChild(navEl);
    const prev = $('.gallery__btn--prev', navEl);
    const next = $('.gallery__btn--next', navEl);
    const count = $('.gallery__count', navEl);
    const dotsWrap = $('.gallery__dots', navEl);

    let index = -1;
    const setIndex = (i) => {
      if (i === index) return;
      index = i;
      dots.forEach((d, k) => d.classList.toggle('is-active', k === i));
      count.textContent = `${i + 1} / ${n}`;
      prev.disabled = i === 0;
      next.disabled = i === n - 1;
      listeners.forEach((fn) => fn(i));
    };
    // пока лента сама доезжает до нужного экрана, промежуточные экраны не считаем выбранными
    let autoTarget = -1;
    let autoTimer = 0;
    const goTo = (i) => {
      i = Math.max(0, Math.min(n - 1, i));
      autoTarget = i;
      clearTimeout(autoTimer);
      autoTimer = setTimeout(() => { autoTarget = -1; }, 1000);
      track.scrollTo({ left: i * track.clientWidth, behavior: reduceMotion ? 'auto' : 'smooth' });
      setIndex(i);
    };
    const dots = slides.map((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', `Экран ${i + 1}`);
      b.addEventListener('click', () => goTo(i));
      dotsWrap.appendChild(b);
      return b;
    });
    prev.addEventListener('click', () => goTo(index - 1));
    next.addEventListener('click', () => goTo(index + 1));

    let dragging = false;
    let wasDragged = false;
    let startX = 0;
    let startLeft = 0;
    let pointerId = null;
    track.addEventListener('scroll', () => {
      if (dragging) return;
      const width = Math.max(1, track.clientWidth);
      if (autoTarget >= 0) {
        if (Math.abs(track.scrollLeft - autoTarget * width) > 2) return;
        autoTarget = -1;
      }
      setIndex(Math.round(track.scrollLeft / width));
    }, { passive: true });
    guardHorizontal(track);

    // перетаскивание мышью (на телефоне работает обычный свайп).
    // Указатель захватываем только после сдвига — простой клик должен дойти до скрина под курсором
    track.addEventListener('pointerdown', (e) => {
      autoTarget = -1; // человек сам взялся за ленту
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      dragging = true;
      wasDragged = false;
      pointerId = e.pointerId;
      startX = e.clientX;
      startLeft = track.scrollLeft;
    });
    track.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      if (!e.buttons) { dragging = false; return; } // кнопку отпустили за пределами ленты
      const dx = e.clientX - startX;
      if (!wasDragged && Math.abs(dx) > 4) {
        wasDragged = true;
        track.classList.add('is-dragging');
        track.setPointerCapture(pointerId);
      }
      if (wasDragged) track.scrollLeft = startLeft - dx;
    });
    const endDrag = (e) => {
      if (!dragging) return;
      dragging = false;
      track.classList.remove('is-dragging');
      const dx = e.clientX - startX;
      let i = index;
      if (Math.abs(dx) > track.clientWidth * 0.12) i = index + (dx < 0 ? 1 : -1);
      goTo(i);
    };
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);
    track.addEventListener('click', (e) => {
      if (wasDragged) { e.preventDefault(); e.stopPropagation(); wasDragged = false; return; }
      const img = e.target.closest('img[data-zoom]');
      if (img) openLightbox(img.currentSrc || img.src, img.alt);
    }, true);

    setIndex(0);
    return { goTo, onChange: (fn) => listeners.push(fn), get index() { return index; } };
  };

  /* ---------- светлые / тёмные экраны приложения в кейсе ----------
     Посетитель сам выбирает, в какой теме смотреть экраны. Пока не выбрал — как тема сайта.
     Выбор общий для всех кейсов до перезагрузки страницы. */
  let shotChoice = null;
  const applyShots = (g, t) => {
    g.dataset.shots = t;
    $$('.shot-theme button', g).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.shot === t)));
  };
  const initShotTheme = (g) => {
    const box = document.createElement('div');
    box.className = 'shot-theme';
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Тема экранов приложения');
    box.innerHTML =
      '<i class="shot-theme__knob" aria-hidden="true"></i>' +
      '<button type="button" data-shot="light"><svg width="15" height="15"><use href="#icon-sun"/></svg>Светлая</button>' +
      '<button type="button" data-shot="dark"><svg width="15" height="15"><use href="#icon-moon"/></svg>Тёмная</button>';
    box.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-shot]');
      if (!b) return;
      shotChoice = b.dataset.shot;
      $$('[data-shots]', sheetContent).forEach((x) => applyShots(x, shotChoice));
    });
    g.prepend(box);
    applyShots(g, shotChoice || root.dataset.theme || 'dark');
  };
  themeListeners.push((t) => {
    if (!shotChoice) $$('[data-shots]', sheetContent).forEach((g) => applyShots(g, t));
  });

  /* ---------- видео в кейсах ----------
     В телефоне ролик грузится и играет без звука, только когда он на экране и открыт в галерее.
     Нажатие на видео открывает его крупно — с начала и со звуком. */
  let caseCleanups = []; // что остановить при закрытии или смене кейса
  const runCaseCleanups = () => { caseCleanups.forEach((fn) => fn()); caseCleanups = []; };
  const loadVideo = (v) => { if (!v.getAttribute('src') && v.dataset.src) v.src = v.dataset.src; };
  let videoHintUsed = false; // после первого просмотра подсказка сворачивается в значок
  // ролик 9:16 на экране iPhone: сверху и снизу остаются поля — на них интерфейс iOS,
  // как у Reels на айфоне: статус-бар сверху, панель вкладок и полоска «домой» снизу
  const IOS_UI =
    '<div class="ios-ui" aria-hidden="true">' +
      '<div class="ios-ui__top"><div class="ios-sb"><span class="ios-sb__time">9:41</span><span class="ios-sb__icons">' +
        '<svg viewBox="0 0 18 12"><rect x="0" y="7.5" width="3" height="4.5" rx=".9"/><rect x="5" y="5" width="3" height="7" rx=".9"/><rect x="10" y="2.5" width="3" height="9.5" rx=".9"/><rect x="15" y="0" width="3" height="12" rx=".9"/></svg>' +
        '<svg viewBox="0 0 16 12"><path d="M8 2.3c2.3 0 4.5.9 6.1 2.4l1.3-1.4A11 11 0 0 0 8 .4 11 11 0 0 0 .6 3.3l1.3 1.4A9 9 0 0 1 8 2.3z"/><path d="M8 5.7c1.4 0 2.8.5 3.8 1.4l1.3-1.4A7.6 7.6 0 0 0 8 3.8a7.6 7.6 0 0 0-5.1 1.9l1.3 1.4c1-.9 2.4-1.4 3.8-1.4z"/><path d="M8 9.1c.7 0 1.3.2 1.7.6L8 11.6 6.3 9.7c.4-.4 1-.6 1.7-.6z"/></svg>' +
        '<svg viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.8" fill="none" stroke="currentColor" opacity=".4"/><rect x="2" y="2" width="20" height="9" rx="2.4"/><path d="M25 4.3v4.4c.9-.3 1.5-1.2 1.5-2.2s-.6-1.9-1.5-2.2z" opacity=".45"/></svg>' +
      '</span></div></div>' +
      '<div class="ios-ui__bottom"><div class="ios-tabs">' +
        '<svg viewBox="0 0 24 24"><path d="M4 10.5 12 4l8 6.5V20h-5.2v-5.5H9.2V20H4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>' +
        '<svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M15.5 15.5 20 20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>' +
        '<svg viewBox="0 0 24 24"><rect x="3.8" y="3.8" width="16.4" height="16.4" rx="4.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>' +
        '<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="4.5"/><path d="M3.5 8.6h17M8.4 3.6l2.6 5M13.6 3.6l2.6 5" stroke="#000" stroke-width="1.5"/><path d="M10.2 11.6v5.6l4.6-2.8z" fill="#000"/></svg>' +
        '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="10" r="3" fill="currentColor"/><path d="M6.6 18.3c1.2-2.2 3.1-3.4 5.4-3.4s4.2 1.2 5.4 3.4" fill="currentColor"/></svg>' +
      '</div><i class="ios-home"></i></div>' +
    '</div>';
  const initCaseVideos = (g, api) => {
    const track = $('[data-track]', g);
    const vids = $$('.slide video', g);
    if (!track || !vids.length) return;
    $('.iphone__screen', g)?.insertAdjacentHTML('beforeend', IOS_UI);
    vids.forEach((v) => {
      const hint = document.createElement('span');
      hint.className = 'video-open';
      hint.classList.toggle('is-used', videoHintUsed);
      hint.setAttribute('aria-hidden', 'true');
      hint.innerHTML = '<svg width="14" height="14"><use href="#icon-sound-on"/></svg><em>Смотреть со звуком</em>';
      v.after(hint);
    });
    let visible = false;
    let viewing = false; // пока ролик открыт крупно, превью в телефоне стоит
    const sync = () => {
      vids.forEach((v, i) => {
        if (visible && !viewing && i === api.index) { loadVideo(v); v.play().catch(() => {}); }
        else v.pause();
      });
    };
    api.onChange(sync);
    const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; sync(); }, { root: sheetScroll, threshold: 0.35 });
    io.observe(g);
    // клик после перетаскивания ленты галерея гасит (preventDefault) — такой клик ролик не открывает
    track.addEventListener('click', (e) => {
      if (e.defaultPrevented) return;
      const v = vids[api.index];
      if (!v) return;
      viewing = true;
      sync();
      videoHintUsed = true;
      $$('.video-open', sheetContent).forEach((h) => h.classList.add('is-used'));
      openVideo(v.dataset.src || v.currentSrc, {
        poster: v.getAttribute('poster') || '',
        label: v.getAttribute('aria-label') || '',
        onClose: () => { viewing = false; if (isSheetOpen()) sync(); },
      });
    });
    caseCleanups.push(() => { io.disconnect(); vids.forEach((v) => v.pause()); });
  };

  // НячангGO: выбор варианта логотипа — нажатием на холст или на слой в панели;
  // в обоих случаях рамка выделения на холсте и подсветка слоя меняются вместе
  const initEditor = (ed) => {
    const boards = $$('.artboard', ed);
    const layers = $$('.editor__layers [data-layer]', ed);
    const select = (i) => {
      boards.forEach((b, k) => { b.classList.toggle('is-active', k === i); b.setAttribute('aria-pressed', String(k === i)); });
      layers.forEach((l) => l.classList.toggle('is-active', Number(l.dataset.layer) === i));
    };
    boards.forEach((b, i) => b.addEventListener('click', () => select(i)));
    layers.forEach((l) => l.addEventListener('click', () => select(Number(l.dataset.layer))));
  };

  // НячангGO: флаер переворачивается — нажатием на него или переключателем «Снаружи / Внутри»
  const initFlyer = (fl) => {
    const card = $('.flyer__card', fl);
    const sides = $$('.seg button', fl);
    const setSide = (back) => {
      fl.classList.toggle('is-flipped', back);
      sides.forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.side === 'back') === back)));
    };
    card?.addEventListener('click', () => setSide(!fl.classList.contains('is-flipped')));
    sides.forEach((b) => b.addEventListener('click', () => setSide(b.dataset.side === 'back')));
    $('.flyer__zoom', fl)?.addEventListener('click', () => {
      const img = $(fl.classList.contains('is-flipped') ? '.flyer__face--back img' : '.flyer__face--front img', fl);
      if (img) openLightbox(img.currentSrc || img.src, img.alt);
    });
  };

  // список подписей рядом со скринами статистики: подсвечен текущий скрин, нажатие — переключает
  const initStatList = (g, api) => {
    const items = $$('.statgal__list button', g.closest('.statgal') || g);
    if (!items.length) return;
    const mark = (i) => items.forEach((b, k) => { b.classList.toggle('is-active', k === i); b.setAttribute('aria-pressed', String(k === i)); });
    items.forEach((b, i) => b.addEventListener('click', () => api.goTo(i)));
    api.onChange(mark);
    mark(api.index);
  };

  // шаги рядом с телефоном: активен шаг, который ближе всех к середине окна,
  // и телефон показывает его экран. Считаем по положению на каждом кадре прокрутки,
  // поэтому переключение не зависит от скорости и не пропускает шаги.
  const initSteps = (scope, gallery) => {
    const steps = $$('.cs-step', scope);
    if (!steps.length) return;
    const activate = (i) => steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
    gallery.onChange(activate);
    activate(0);

    const centerOf = (el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; };
    const focusLine = () => {
      const r = sheetScroll.getBoundingClientRect();
      return r.top + sheetScroll.clientHeight / 2;
    };

    // клик: плавно подводим шаг к середине окна, экран на телефоне переключится сам
    steps.forEach((s, i) => s.addEventListener('click', () => {
      if (!isDesktop()) { gallery.goTo(i); return; }
      const top = sheetScroll.scrollTop + centerOf(s) - focusLine();
      if (sheetLenis) sheetLenis.scrollTo(top, { duration: 0.9, easing: easeOutCubic });
      else sheetScroll.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
    }));

    sheetSyncs.push(() => {
      if (!isDesktop()) return;
      const line = focusLine();
      let best = 0;
      let bestDist = Infinity;
      steps.forEach((s, k) => {
        const d = Math.abs(centerOf(s) - line);
        if (d < bestDist) { bestDist = d; best = k; }
      });
      if (best !== gallery.index) gallery.goTo(best);
    });
  };

  /* ---------- окно кейса ---------- */
  const sheetWrap = $('#caseSheet');
  const sheetContent = $('#sheetContent');
  const sheetScroll = $('#sheetScroll');
  const sheetTitle = $('#sheetTitle');
  const sheetSub = $('#sheetSub');
  const sheetProgress = $('#sheetProgress');
  let sheetLenis = null;
  let sheetSyncs = []; // что пересчитать при прокрутке окна кейса (шаги у телефона)
  let currentCase = null;
  let pushedState = false;
  const tplFor = (key) => document.getElementById(`case-${key}`);
  const isSheetOpen = () => sheetWrap.classList.contains('is-open');

  const renderCase = (key) => {
    const tpl = tplFor(key);
    sheetSyncs = [];
    runCaseCleanups();
    sheetContent.replaceChildren(tpl.content.cloneNode(true));

    const nextKey = tpl.dataset.next;
    const nextTpl = nextKey && tplFor(nextKey);
    if (nextTpl) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cs-next';
      btn.dataset.case = nextKey;
      btn.innerHTML = `<span><small>Следующий кейс</small><b>${nextTpl.dataset.title}</b></span><span class="cs-next__arrow"><svg width="22" height="22"><use href="#icon-arrow"/></svg></span>`;
      btn.addEventListener('click', () => switchCase(nextKey));
      sheetContent.appendChild(btn);
    }

    sheetWrap.dataset.case = key;
    sheetTitle.textContent = tpl.dataset.title;
    sheetSub.textContent = tpl.dataset.sub || '';
    currentCase = key;

    observeReveals(sheetContent);
    $$('[data-gallery]', sheetContent).forEach((g) => {
      if (g.hasAttribute('data-shots')) initShotTheme(g);
      const api = initGallery(g);
      const how = g.closest('.cs-how');
      if (api && how) initSteps(how, api);
      if (api && g.hasAttribute('data-videos')) initCaseVideos(g, api);
      if (api && g.hasAttribute('data-statgal')) initStatList(g, api);
    });
    $$('[data-editor]', sheetContent).forEach(initEditor);
    $$('[data-flyer]', sheetContent).forEach(initFlyer);
    $$('[data-lightbox]', sheetContent).forEach((el) => {
      el.addEventListener('click', () => openLightbox(el.dataset.lightbox, $('img', el)?.alt));
    });
    enhance(sheetContent);
    sheetProgress.style.setProperty('--p', 0);
    collectParallax();
    requestParallax();
  };

  // review — data-review-id отзыва: окно открывается сразу на нём, и отзыв коротко подсвечивается
  const openCase = (key, { push = true, review = null } = {}) => {
    if (!tplFor(key)) return;
    if (isSheetOpen()) { switchCase(key, { push }); return; }
    renderCase(key);
    sheetScroll.scrollTop = 0;
    const target = review && $(`[data-review-id="${review}"]`, sheetContent);
    if (target) {
      // если отзыв помещается в окно вместе с заголовком секции — показываем с заголовком
      const box = sheetScroll.getBoundingClientRect();
      const section = target.closest('section') || target;
      const t = target.getBoundingClientRect();
      const anchor = t.bottom - section.getBoundingClientRect().top < sheetScroll.clientHeight - 40 ? section : target;
      sheetScroll.scrollTop = Math.max(0, anchor.getBoundingClientRect().top - box.top - 28);
      target.classList.add('is-flash');
    }
    sheetWrap.classList.add('is-open');
    sheetWrap.setAttribute('aria-hidden', 'false');
    lock();
    if (window.Lenis && !reduceMotion) {
      sheetLenis = new window.Lenis({ wrapper: sheetScroll, content: sheetContent, lerp: 0.09, autoRaf: true });
    }
    if (push) {
      history.pushState({ case: key }, '', `#case-${key}`);
      pushedState = true;
    }
    setTimeout(() => $('.sheet__close', sheetWrap)?.focus({ preventScroll: true }), 60);
  };

  const closeCase = ({ fromPop = false } = {}) => {
    if (!isSheetOpen()) return;
    runCaseCleanups(); // видео в кейсе замолкают сразу, не дожидаясь очистки окна
    sheetWrap.classList.remove('is-open');
    sheetWrap.setAttribute('aria-hidden', 'true');
    sheetLenis?.destroy();
    sheetLenis = null;
    unlock();
    if (!fromPop) {
      if (pushedState) { pushedState = false; history.back(); }
      else history.replaceState(null, '', location.pathname + location.search);
    } else {
      pushedState = false;
    }
    setTimeout(() => {
      if (isSheetOpen()) return;
      sheetSyncs = [];
      sheetContent.replaceChildren();
      currentCase = null;
      collectParallax();
    }, 900);
  };

  function switchCase(key, { push = true } = {}) {
    if (!tplFor(key) || key === currentCase) return;
    sheetContent.classList.add('is-swapping');
    setTimeout(() => {
      renderCase(key);
      if (sheetLenis) sheetLenis.scrollTo(0, { immediate: true });
      sheetScroll.scrollTop = 0;
      sheetContent.classList.remove('is-swapping');
      // заменяем запись в истории: «назад» закрывает окно целиком
      if (push) history.replaceState({ case: key }, '', `#case-${key}`);
    }, 350);
  }

  $$('[data-open-case]').forEach((el) => {
    el.addEventListener('click', () => openCase(el.dataset.openCase));
    if (el.getAttribute('role') === 'button') {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCase(el.dataset.openCase); }
      });
    }
  });
  $$('[data-sheet-close]', sheetWrap).forEach((el) => el.addEventListener('click', () => closeCase()));
  const syncSheet = () => sheetSyncs.forEach((fn) => fn());
  sheetScroll.addEventListener('scroll', () => {
    syncSheet(); // сначала замеры, потом запись стилей
    const max = sheetScroll.scrollHeight - sheetScroll.clientHeight;
    sheetProgress.style.setProperty('--p', max > 0 ? (sheetScroll.scrollTop / max).toFixed(4) : 0);
    requestParallax();
  }, { passive: true });
  window.addEventListener('resize', () => { if (isSheetOpen()) syncSheet(); }, { passive: true });

  const caseFromHash = () => {
    const m = location.hash.match(/^#case-([a-z]+)$/);
    return m && tplFor(m[1]) ? m[1] : null;
  };
  window.addEventListener('popstate', () => {
    const key = caseFromHash();
    if (key) {
      if (!isSheetOpen()) openCase(key, { push: false });
      else if (key !== currentCase) switchCase(key, { push: false });
    } else {
      closeCase({ fromPop: true });
    }
  });
  const initialCase = caseFromHash();
  if (initialCase) openCase(initialCase, { push: false });

  /* ---------- Escape закрывает верхнее окно ---------- */
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (closeLightbox()) return;
    if (closeDiploma()) return;
    if (isSheetOpen()) closeCase();
    closeMenu();
  });

  /* ---------- другие работы: по нажатию картинка открывается крупно, ролик — со звуком ---------- */
  $$('.portfolio [data-lightbox]').forEach((el) => {
    el.addEventListener('click', () => openLightbox(el.dataset.lightbox, $('img', el)?.alt));
  });
  $$('.portfolio [data-pf-video]').forEach((el) => {
    el.addEventListener('click', () => openVideo(el.dataset.pfVideo, {
      poster: $('img', el)?.getAttribute('src') || '',
      label: $('img', el)?.alt || '',
    }));
  });

  /* ---------- диплом ---------- */
  const diplomaModal = $('#diplomaModal');
  const openDiploma = () => {
    diplomaModal.classList.add('is-open');
    diplomaModal.setAttribute('aria-hidden', 'false');
    lock();
  };
  function closeDiploma() {
    if (!diplomaModal?.classList.contains('is-open')) return false;
    diplomaModal.classList.remove('is-open');
    diplomaModal.setAttribute('aria-hidden', 'true');
    unlock();
    return true;
  }
  $('#diplomaBtn')?.addEventListener('click', openDiploma);
  diplomaModal && $$('[data-close]', diplomaModal).forEach((el) => el.addEventListener('click', closeDiploma));
  const diplomaGallery = $('.modal__panel--gallery', diplomaModal || document);
  diplomaGallery?.setAttribute('data-lenis-prevent', '');

  /* ---------- вкладки услуг ---------- */
  const serviceTabsWrap = $('.services__tabs');
  const serviceTabs = $$('.services__tab');
  const servicePanes = $$('.services__pane');
  const serviceKnob = $('.services__knob');
  // подсветка переезжает под выбранную вкладку (вкладки могут стоять в две строки — двигаем по x и y)
  const placeKnob = () => {
    const tab = serviceTabs.find((t) => t.classList.contains('is-active'));
    if (!serviceKnob || !tab) return;
    serviceKnob.style.width = `${tab.offsetWidth}px`;
    serviceKnob.style.height = `${tab.offsetHeight}px`;
    serviceKnob.style.transform = `translate(${tab.offsetLeft}px, ${tab.offsetTop}px)`;
    serviceTabsWrap.classList.add('has-knob');
  };
  if (serviceKnob) {
    placeKnob();
    requestAnimationFrame(() => serviceTabsWrap.classList.add('is-animated'));
    window.addEventListener('resize', placeKnob, { passive: true });
    document.fonts?.ready.then(placeKnob); // ширина вкладок меняется, когда догрузится шрифт
  }
  // строки появляются по очереди
  servicePanes.forEach((p) => $$('.svc, .smm__pkg', p).forEach((el, i) => el.style.setProperty('--i', i)));
  serviceTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      if (tab.classList.contains('is-active')) return;
      serviceTabs.forEach((t) => { t.classList.remove('is-active'); t.setAttribute('aria-selected', 'false'); });
      servicePanes.forEach((p) => { p.classList.remove('is-active'); p.hidden = true; });
      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');
      placeKnob();
      const pane = $(`.services__pane[data-pane="${tab.dataset.tab}"]`);
      if (pane) {
        pane.hidden = false;
        void pane.offsetWidth;
        pane.classList.add('is-active');
      }
      lenis?.resize();
    });
  });

  /* ---------- карусель отзывов ---------- */
  const track = $('#reviewsTrack');
  if (track) {
    const cards = $$('.review-card', track);
    const prevBtn = $('[data-reviews-prev]');
    const nextBtn = $('[data-reviews-next]');
    let currentIndex = 0;
    guardHorizontal(track);

    const updateCenter = () => {
      const trackRect = track.getBoundingClientRect();
      const center = trackRect.left + trackRect.width / 2;
      let closest = null;
      let closestDist = Infinity;
      cards.forEach((card, i) => {
        const r = card.getBoundingClientRect();
        const dist = Math.abs(r.left + r.width / 2 - center);
        if (dist < closestDist) { closestDist = dist; closest = card; currentIndex = i; }
      });
      cards.forEach((card) => card.classList.toggle('is-center', card === closest));
    };

    let rafPending = false;
    const onScroll = () => {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(() => { updateCenter(); rafPending = false; });
    };
    track.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    updateCenter();

    const goTo = (index) => {
      currentIndex = (index + cards.length) % cards.length;
      const card = cards[currentIndex];
      track.scrollTo({ left: card.offsetLeft - (track.clientWidth - card.clientWidth) / 2, behavior: 'smooth' });
    };
    prevBtn?.addEventListener('click', () => goTo(currentIndex - 1));
    nextBtn?.addEventListener('click', () => goTo(currentIndex + 1));

    // нажатие на отзыв открывает кейс сразу на этом отзыве (клик после перетаскивания гасится ниже)
    const openReview = (card) => {
      const [key, review] = (card.dataset.reviewLink || '').split(':');
      if (key) openCase(key, { review });
    };
    track.addEventListener('click', (e) => {
      const card = e.target.closest('[data-review-link]');
      if (card) openReview(card);
    });
    track.addEventListener('keydown', (e) => {
      const card = e.target.closest('[data-review-link]');
      if (card && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openReview(card); }
    });

    // перетаскивание мышью (на телефоне — обычный свайп).
    // Указатель захватываем, только когда лента правда поехала: иначе клик достаётся
    // самой ленте, а не карточке под курсором, и отзыв не открывается
    let isDown = false, startX = 0, startScroll = 0, moved = false, pointerId = null;
    track.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' || e.button !== 0) return;
      isDown = true; moved = false;
      pointerId = e.pointerId;
      startX = e.clientX;
      startScroll = track.scrollLeft;
    });
    track.addEventListener('pointermove', (e) => {
      if (!isDown) return;
      if (!e.buttons) { isDown = false; return; } // кнопку отпустили за пределами ленты
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > 4) {
        moved = true;
        track.classList.add('is-dragging');
        track.setPointerCapture(pointerId);
      }
      if (moved) track.scrollLeft = startScroll - dx;
    });
    const endDrag = () => {
      if (!isDown) return;
      isDown = false;
      track.classList.remove('is-dragging');
      if (moved) {
        const clickBlock = (ev) => { ev.preventDefault(); ev.stopPropagation(); track.removeEventListener('click', clickBlock, true); };
        track.addEventListener('click', clickBlock, true);
      }
    };
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointerleave', endDrag);
  }

  /* ---------- фон: сетка точек, которая реагирует на курсор ---------- */
  // kickDots объявлена в начале файла
  const canvas = $('#dots');
  const ctx = canvas?.getContext('2d');
  if (ctx) {
    const GAP = 28;           // шаг сетки
    const BASE_R = 1.1;       // радиус обычной точки
    const RADIUS = 90;        // зона влияния курсора
    let w = 0, h = 0, dpr = 1;
    let dotColor = '', hotColor = '';
    // цель (курсор) и сглаженная позиция «пятна»
    let tx = -9999, ty = -9999, px = -9999, py = -9999;
    let strength = 0, target = 0;
    let running = false, last = 0, lastDraw = 0;

    const readColors = () => {
      const cs = getComputedStyle(root);
      dotColor = `rgba(${cs.getPropertyValue('--dot-rgb').trim()},${parseFloat(cs.getPropertyValue('--dot-a'))})`;
      hotColor = `rgb(${cs.getPropertyValue('--glow-rgb').trim()})`;
    };
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const offX = (w % GAP) / 2;
      const offY = (h % GAP) / 2;
      const r2 = RADIUS * RADIUS;
      const hot = [];

      ctx.fillStyle = dotColor;
      ctx.beginPath();
      for (let y = offY; y <= h; y += GAP) {
        for (let x = offX; x <= w; x += GAP) {
          const dx = x - px, dy = y - py;
          const d2 = dx * dx + dy * dy;
          if (strength > 0.01 && d2 < r2) {
            hot.push(x, y, dx, dy, Math.sqrt(d2));
            continue;
          }
          ctx.moveTo(x + BASE_R, y);
          ctx.arc(x, y, BASE_R, 0, Math.PI * 2);
        }
      }
      ctx.fill();

      // точки рядом с курсором: крупнее, в цвет акцента и чуть расходятся в стороны
      for (let i = 0; i < hot.length; i += 5) {
        const x = hot[i], y = hot[i + 1], dx = hot[i + 2], dy = hot[i + 3], d = hot[i + 4];
        let k = 1 - d / RADIUS;
        k = k * k * (3 - 2 * k) * strength;
        const push = d > 0 ? (k * 9) / d : 0;
        const nx = x + dx * push, ny = y + dy * push;
        ctx.beginPath();
        ctx.arc(nx, ny, BASE_R + k * 2.1, 0, Math.PI * 2);
        ctx.fillStyle = dotColor;
        ctx.fill();
        ctx.globalAlpha = Math.min(1, k * 1.25);
        ctx.fillStyle = hotColor;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    };

    const loop = (now) => {
      if (document.body.classList.contains('is-locked')) { running = false; return; }
      if (!finePointer && now - lastDraw < 32) { requestAnimationFrame(loop); return; } // на телефонах 30 кадров хватает
      const dt = Math.min(64, now - (last || now));
      last = now;
      lastDraw = now;
      if (!finePointer) {
        // на телефонах курсора нет: мягкое пятно медленно гуляет по экрану
        const t = now / 1000;
        tx = w * (0.5 + 0.38 * Math.sin(t * 0.23));
        ty = h * (0.45 + 0.32 * Math.sin(t * 0.17 + 1.3));
        target = 0.7;
      }
      const f = dt / 16.67;
      const e = 1 - Math.pow(1 - 0.14, f);
      px += (tx - px) * e;
      py += (ty - py) * e;
      strength += (target - strength) * (1 - Math.pow(1 - 0.08, f));
      draw();

      const settled = Math.abs(tx - px) < 0.3 && Math.abs(ty - py) < 0.3 && Math.abs(target - strength) < 0.01;
      if (finePointer && settled) { running = false; return; }
      requestAnimationFrame(loop);
    };

    kickDots = () => {
      if (running || reduceMotion || document.hidden) return;
      running = true;
      last = 0;
      requestAnimationFrame(loop);
    };

    readColors();
    resize();
    draw();
    window.addEventListener('resize', () => { resize(); draw(); }, { passive: true });
    themeListeners.push(() => { readColors(); draw(); });

    if (finePointer) {
      window.addEventListener('pointermove', (e) => {
        if (px < -1000) { px = e.clientX; py = e.clientY; }
        tx = e.clientX;
        ty = e.clientY;
        target = 1;
        kickDots();
      }, { passive: true });
      document.documentElement.addEventListener('mouseleave', () => { target = 0; kickDots(); });
    } else {
      px = w / 2;
      py = h / 2;
      kickDots();
      document.addEventListener('visibilitychange', kickDots);
    }
  }
})();
