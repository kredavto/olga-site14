/* ============================================================
   OLGA — digital showroom. Motion engine.
   Один rAF-цикл на все scroll-сцены, IntersectionObserver для reveal.
   Всё движение уважает prefers-reduced-motion.
   ============================================================ */
(() => {
  'use strict';

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  /** Прогресс прохождения элемента через вьюпорт: 0 — верх у низа экрана, 1 — низ ушёл вверх. */
  const passed = el => {
    const r = el.getBoundingClientRect();
    return clamp((window.innerHeight - r.top) / (window.innerHeight + r.height));
  };
  /** Прогресс «залипшей» сцены: 0 в начале pin, 1 — когда сцена дошла до конца. */
  const pinned = el => {
    const r = el.getBoundingClientRect();
    return clamp(-r.top / Math.max(1, r.height - window.innerHeight));
  };

  const scenes = [];
  const onScroll = fn => { scenes.push(fn); fn(); };

  let ticking = false;
  const tick = () => {
    ticking = false;
    for (const fn of scenes) fn();
  };
  const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(tick); } };
  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', () => { scenes.forEach(f => f.measure && f.measure()); request(); }, { passive: true });

  const nf = new Intl.NumberFormat('ru-RU');

  /* ---------------------------------------------------------- reveal */
  const io = new IntersectionObserver(es => {
    // Соседи, входящие в кадр одновременно, появляются лесенкой, а не разом
    const hits = es.filter(e => e.isIntersecting).sort((a, b) =>
      a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left);
    hits.forEach((e, i) => {
      e.target.style.setProperty('--rd', (Math.min(i, 6) * 90) + 'ms');
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.06 });
  $$('.reveal, .clip-reveal, .split-line, .wordmark, .cat').forEach(el => io.observe(el));

  /* ---------------------------------------------------------- запасные кадры */
  // Удалённое изображение не загрузилось — молча подставляем локальный кадр
  // той же секции, чтобы вместо фотографии не появлялась «битая картинка».
  $$('img[data-fallback]').forEach(im => {
    const swap = () => {
      const fb = im.dataset.fallback;
      if (!fb || im.dataset.swapped) return;
      im.dataset.swapped = '1';
      im.src = fb;
    };
    im.addEventListener('error', swap);
    if (im.complete && im.naturalWidth === 0) swap();
  });

  /* ---------------------------------------------------------- header */
  const header = $('.header');
  if (header) {
    let last = 0;
    onScroll(() => {
      const y = window.scrollY;
      header.classList.toggle('is-compact', y > 40);
      header.classList.toggle('is-hidden', y > 480 && y > last && !document.body.classList.contains('is-locked'));
      last = y;
    });
  }

  /* ---------------------------------------------------------- мобильное меню */
  const burger = $('.burger'), menu = $('.menu');
  if (burger && menu) {
    const setMenu = open => {
      burger.setAttribute('aria-expanded', String(open));
      menu.classList.toggle('is-open', open);
      document.body.classList.toggle('is-locked', open);
    };
    burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
    $$('a', menu).forEach(a => a.addEventListener('click', () => setMenu(false)));
    addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
  }

  /* ---------------------------------------------------------- курсор + магнитные кнопки */
  if (FINE && !REDUCED) {
    const cur = document.createElement('div');
    cur.className = 'cursor';
    cur.innerHTML = '<span class="cursor__text"></span>';
    document.body.appendChild(cur);
    const label = $('.cursor__text', cur);
    let cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy;

    addEventListener('mousemove', e => {
      tx = e.clientX; ty = e.clientY;
      cur.classList.add('is-on');
    }, { passive: true });

    (function loop() {
      cx = lerp(cx, tx, 0.18); cy = lerp(cy, ty, 0.18);
      cur.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      requestAnimationFrame(loop);
    })();

    $$('[data-cursor]').forEach(el => {
      el.addEventListener('mouseenter', () => { cur.classList.add('is-hot'); label.textContent = el.dataset.cursor; });
      el.addEventListener('mouseleave', () => { cur.classList.remove('is-hot'); label.textContent = ''; });
    });

    $$('[data-magnetic]').forEach(el => {
      const strength = parseFloat(el.dataset.magnetic) || 0.32;
      let raf = 0, mx = 0, my = 0, x = 0, y = 0;
      const run = () => {
        x = lerp(x, mx, 0.2); y = lerp(y, my, 0.2);
        el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        raf = (Math.abs(x - mx) > 0.1 || Math.abs(y - my) > 0.1) ? requestAnimationFrame(run) : 0;
      };
      el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect();
        mx = (e.clientX - r.left - r.width / 2) * strength;
        my = (e.clientY - r.top - r.height / 2) * strength;
        if (!raf) raf = requestAnimationFrame(run);
      });
      el.addEventListener('mouseleave', () => { mx = 0; my = 0; if (!raf) raf = requestAnimationFrame(run); });
    });
  }

  /* ---------------------------------------------------------- 01 HERO: scroll-driven video */
  const hero = $('.hero');
  if (hero) {
    const cfg = JSON.parse(hero.dataset.hero || '{}');
    const canvas = $('.hero__canvas', hero);
    const video  = $('.hero__video', hero);
    const bar    = $('.hero__progress i', hero);
    const annos  = $$('.anno', hero);
    const content = $('.hero__content', hero);
    const hint = $('.hero__scroll', hero);
    let progress = 0;

    /* Аннотации: появляются в своей точке таймлайна, линия ведёт к детали мебели. */
    const layoutAnno = a => {
      const d = a.dataset;
      const dot = $('.anno__dot', a), line = $('.anno__line', a), tag = $('.anno__tag', a);
      const w = hero.clientWidth, h = window.innerHeight;
      const px = +d.x / 100 * w, py = +d.y / 100 * h;
      const tX = +d.tx / 100 * w, tY = +d.ty / 100 * h;
      dot.style.left = px + 'px'; dot.style.top = py + 'px';
      tag.style.left = tX + 'px'; tag.style.top = tY + 'px';
      const dx = tX - px, dy = tY - py;
      line.style.left = px + 'px'; line.style.top = py + 'px';
      line.style.width = Math.hypot(dx, dy) + 'px';
      line.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
    };
    annos.forEach(layoutAnno);

    const paintAnnos = p => annos.forEach(a => {
      const at = +a.dataset.at;
      a.classList.toggle('is-on', p >= at - 0.02 && p <= at + 0.20);
    });

    /* Сцена: видео скрабится скроллом; без видео — последовательность кадров на canvas. */
    if (video && cfg.video) {
      // Лёгкий файл на узких экранах — иначе мобильный тянет десктопный битрейт
      const attach = () => {
        video.src = matchMedia('(max-width: 720px)').matches && video.dataset.srcMobile
          ? video.dataset.srcMobile : video.dataset.src;
      };

      if (cfg.playback !== 'scrub') {
        // Сначала показываем фотографию-постер, затем поверх неё проявляется видео.
        // Подписи следуют за временем ролика, а не за скроллом.
        const INTRO = 1400;                       // сколько держим фотографию до старта
        hero.classList.add('is-ready');           // постер появляется сразу
        if (cfg.playback === 'loop') video.loop = true;
        video.muted = true;                       // свойство, а не только атрибут: без него автозапуск запрещён

        const btn = $('.hero__play', hero);
        const offer = () => hero.classList.add('is-offered');   // показать кнопку запуска

        // Фотография уходит по событию playing, а не «на всякий случай»: пока
        // кадров нет, она должна закрывать ролик.
        video.addEventListener('playing', () => hero.classList.replace('is-offered', 'is-playing')
          || hero.classList.add('is-playing'));
        // Файл не открылся или браузер его не декодирует — оставляем фотографию
        // и предлагаем кнопку, а не пустой экран без объяснений.
        video.addEventListener('error', () => { hero.classList.remove('is-playing'); offer(); });

        let armed = false;

        // Автозапуск может быть запрещён (политика браузера, экономия энергии,
        // reduced-motion). Тогда ролик ждёт первого действия пользователя —
        // и параллельно предлагает явную кнопку, чтобы это не выглядело поломкой.
        const armGesture = () => {
          if (armed) return;
          armed = true;
          const go = () => { if (!video.src) attach(); play(); };
          ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach(t =>
            addEventListener(t, go, { once: true, passive: true }));
        };

        const play = () => {
          if (hero.classList.contains('is-ended')) return;
          const r = video.play();
          if (r && r.catch) r.catch(() => { offer(); armGesture(); });
        };

        // Источник подключается только после паузы «на фотографию»: у элемента
        // стоит autoplay, и с ранним src браузер стартовал бы сразу, съев паузу.
        // Дальше запуск делает сам браузер — это надёжнее, чем play() из JS;
        // play() ниже лишь подстраховка. Ждать canplay нельзя: Safari не
        // догружает медиа заранее, и событие может не прийти вовсе.
        setTimeout(() => {
          if (REDUCED) { offer(); return; }   // источник подключит кнопка
          attach();
          play();
          // Сторож. play() может не вернуть ни успеха, ни отказа: обещание
          // остаётся висеть, если медиа так и не подготовилось. Тогда не
          // срабатывает ни ветка отказа, ни error — и экран остаётся без
          // ролика и без объяснений. Через 6 с показываем кнопку.
          setTimeout(() => { if (!hero.classList.contains('is-playing')) offer(); }, 6000);
        }, INTRO);
        if (btn) btn.addEventListener('click', () => {
          hero.classList.remove('is-offered', 'is-ended');
          if (!video.src) attach(); else video.currentTime = 0;
          play();
        });

        const showAt = t => {
          const d = video.duration || 8;
          annos.forEach(a => {
            const from = +a.dataset.at * d;
            a.classList.toggle('is-on', t >= from && t < from + 2.4);
          });
        };
        video.addEventListener('timeupdate', () => showAt(video.currentTime));
        video.addEventListener('ended', () => {
          hero.classList.add('is-ended');         // остаётся последний кадр
          annos.forEach(a => a.classList.remove('is-on'));
        });

        // Не тратим декодер, пока экран не виден; после конца ролика не перезапускаем
        new IntersectionObserver(es => es.forEach(e => {
          if (!hero.classList.contains('is-playing')) return;
          if (hero.classList.contains('is-ended')) return;
          if (e.isIntersecting) play(); else video.pause();
        }), { rootMargin: '0px' }).observe(video);

        // Текст hero остаётся обычным содержимым экрана — гасить его нечем и незачем
        onScroll(() => { if (bar) bar.style.width = '0%'; });
      } else {
      attach();
      video.addEventListener('loadedmetadata', () => hero.classList.add('is-ready'), { once: true });

      // Перемотка идёт в такт кадрам браузера: подряд идущие события скролла
      // не должны ставить в очередь несколько seek — на этом видео и дёргается.
      let want = 0, seeking = false;
      const seek = () => {
        seeking = false;
        if (video.duration) video.currentTime = video.duration * want;
      };
      onScroll(() => {
        progress = pinned(hero);
        want = progress;
        if (!seeking) { seeking = true; requestAnimationFrame(seek); }
        paint(progress);
      });
      }
    } else if (canvas && cfg.frames) {
      const ctx = canvas.getContext('2d', { alpha: false });
      const { pattern, count, pad } = cfg.frames;
      const frames = [];
      let loaded = 0, current = -1;

      const size = () => {
        const dpr = Math.min(devicePixelRatio || 1, 2);
        canvas.width = Math.round(hero.clientWidth * dpr);
        canvas.height = Math.round(window.innerHeight * dpr);
        current = -1;
      };
      size();

      const draw = i => {
        const img = frames[i];
        if (!img || !img.complete || current === i) return;
        current = i;
        const cw = canvas.width, ch = canvas.height;
        const scale = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
        const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
        ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
      };

      for (let i = 0; i < count; i++) {
        const img = new Image();
        img.decoding = 'async';
        img.src = pattern.replace('{i}', String(i).padStart(pad || 2, '0'));
        img.onload = () => {
          if (++loaded === 1) { hero.classList.add('is-ready'); draw(0); }
          if (loaded === count) request();
        };
        frames.push(img);
      }

      const scene = () => {
        progress = pinned(hero);
        draw(Math.min(count - 1, Math.round(progress * (count - 1))));
        paint(progress);
      };
      scene.measure = size;
      onScroll(scene);
    }

    function paint(p) {
      if (bar) bar.style.width = (p * 100).toFixed(2) + '%';
      paintAnnos(p);
      if (content && !REDUCED) {
        // Текст уходит до появления первой аннотации (12.5% прокрутки),
        // иначе заголовок и подписи к деталям спорят друг с другом.
        const k = clamp(p / 0.10);
        content.style.transform = `translate3d(0, ${-k * 90}px, 0)`;
        content.style.opacity = String(1 - k);
        content.style.pointerEvents = k > 0.85 ? 'none' : '';   // невидимые кнопки не должны ловить клики
        if (hint) { hint.style.opacity = String(1 - k); hint.style.pointerEvents = 'none'; }
      }
    }
    addEventListener('resize', () => annos.forEach(layoutAnno), { passive: true });
  }

  /* ---------------------------------------------------------- 02 USP: горизонтальная сцена */
  const uspOuter = $('.usp__track-outer');
  if (uspOuter && matchMedia('(min-width: 861px)').matches) {
    const track = $('.usp__track', uspOuter);
    const rail  = $('.usp__rail i', uspOuter);
    const items = $$('.usp__item', track);
    let distance = 0;

    const measure = () => {
      distance = Math.max(0, track.scrollWidth - window.innerWidth + 64);
      uspOuter.style.height = (window.innerHeight + distance) + 'px';
    };
    measure();

    const scene = () => {
      const p = pinned(uspOuter);
      track.style.transform = `translate3d(${-p * distance}px, 0, 0)`;
      if (rail) rail.style.width = (p * 100).toFixed(2) + '%';
      const centre = window.innerWidth / 2;
      items.forEach(it => {
        const r = it.getBoundingClientRect();
        it.classList.toggle('is-live', r.left < centre && r.right > centre * 0.2);
      });
    };
    scene.measure = measure;
    onScroll(scene);
  }

  /* ---------------------------------------------------------- 03 КАТАЛОГ: проход сквозь пространства */
  const cats = $$('.cat');
  if (cats.length && !REDUCED) {
    const narrowMQ = matchMedia('(max-width: 720px)');
    onScroll(() => {
      const narrow = narrowMQ.matches;
      for (const cat of cats) {
        const r = cat.getBoundingClientRect();
        if (r.bottom < -100 || r.top > window.innerHeight + 100) continue;
        // -0.5 сверху экрана, +0.5 снизу: кадр «проезжает» медленнее секции
        const p = (r.top + r.height / 2 - window.innerHeight / 2) / (window.innerHeight + r.height);
        // Сдвиг кадра — внутри 8% запаса по высоте, края не открываются.
        // На мобильном плитка равна пропорции кадра, запаса нет — не двигаем.
        if (!narrow) {
          const im = $('.cat__media img', cat);
          if (im) im.style.transform = `translate3d(0, ${(p * 44).toFixed(1)}px, 0)`;
        }
        const title = $('.cat__title', cat);
        if (title) title.style.transform = `translate3d(0, ${(p * -58).toFixed(1)}px, 0)`;
      }
    });
  }

  /* ---------------------------------------------------------- 04 ПРОЕКТЫ: parallax + фильтр */
  const gallery = $('.gallery');
  if (gallery) {
    if (!REDUCED) {
      const figs = $$('.pj__fig img', gallery);
      onScroll(() => {
        for (const img of figs) {
          const r = img.parentElement.getBoundingClientRect();
          if (r.bottom < -200 || r.top > window.innerHeight + 200) continue;
          const p = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;
          const depth = +img.dataset.depth || 1;
          img.style.transform = `translate3d(0, ${(-p * 96 * depth).toFixed(2)}px, 0) scale(1.22)`;
        }
      });
    }

    const state = { style: 'Все', budget: 'Все', type: 'Все' };
    const cards = $$('.pj', gallery);
    const count = $('.filters__count');
    const empty = $('.gallery__empty');

    const apply = () => {
      let shown = 0;
      cards.forEach((c, i) => {
        const ok = (state.style === 'Все' || c.dataset.style === state.style)
                && (state.budget === 'Все' || c.dataset.budget === state.budget)
                && (state.type === 'Все' || c.dataset.type === state.type);
        c.classList.toggle('is-out', !ok);
        if (ok) {
          shown++;
          c.style.transitionDelay = (shown * 70) + 'ms';   // staggered reveal
          c.hidden = false;
        } else {
          c.style.transitionDelay = '0ms';
          setTimeout(() => { if (c.classList.contains('is-out')) c.hidden = true; }, 420);
        }
      });
      if (count) count.textContent = shown === 0 ? 'Ничего не найдено'
        : `${shown} ${shown === 1 ? 'проект' : shown < 5 ? 'проекта' : 'проектов'}`;
      if (empty) empty.hidden = shown !== 0;
      request();
    };

    $$('.filter').forEach(f => {
      const key = f.dataset.filter;
      $$('.chip', f).forEach(chip => chip.addEventListener('click', () => {
        $$('.chip', f).forEach(c => c.setAttribute('aria-pressed', String(c === chip)));
        state[key] = chip.dataset.value;
        apply();
      }));
    });
    apply();
  }

  /* ---------------------------------------------------------- 05 CASE STUDY */
  const caseSec = $(".case");
  if (caseSec) {
    const frame = $(".case__frame", caseSec);
    const facts = $$(".fact", caseSec);
    const counted = new WeakSet();

    const countTo = el => {
      if (counted.has(el)) return;
      counted.add(el);
      const target = +el.dataset.value, dur = REDUCED ? 0 : 1100, t0 = performance.now();
      const pre = el.dataset.prefix || '', suf = el.dataset.suffix || '';
      const step = now => {
        const k = clamp((now - t0) / (dur || 1));
        el.textContent = pre + nf.format(Math.round(target * easeOut(k))) + suf;
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    onScroll(() => {
      const p = pinned(caseSec);
      const k = easeOut(clamp(p / 0.62));
      frame.style.width = lerp(70, 100, k).toFixed(2) + '%';
      frame.style.height = lerp(62, 100, k).toFixed(2) + '%';
      frame.style.borderRadius = lerp(14, 0, k).toFixed(1) + 'px';
      facts.forEach((f, i) => {
        const on = p > 0.30 + i * 0.11;
        f.classList.toggle('is-on', on);
        if (on) countTo($('.fact__v', f));
      });
    });
  }

  /* ---------------------------------------------------------- фоновое видео кейса */
  // Кадр кейса и без того растёт при скролле, поэтому видео здесь не скрабится,
  // а просто идёт по кругу. Играет только пока секция на экране — иначе
  // декодер работает вхолостую всю страницу.
  const caseVideo = $('.case__video');
  if (caseVideo) {
    caseVideo.src = matchMedia('(max-width: 720px)').matches && caseVideo.dataset.srcMobile
      ? caseVideo.dataset.srcMobile : caseVideo.dataset.src;
    if (REDUCED) {
      caseVideo.removeAttribute('loop');      // при reduced-motion остаётся постер
    } else {
      new IntersectionObserver(es => es.forEach(e => {
        if (e.isIntersecting) caseVideo.play().catch(() => {});
        else caseVideo.pause();
      }), { rootMargin: '10% 0px' }).observe(caseVideo);
    }
  }

  /* ---------------------------------------------------------- 06 КАЛЬКУЛЯТОР */
  const calc = $('.calc');
  if (calc) {
    const cfg = JSON.parse(calc.dataset.calc || '{}');
    const state = { kind: null, facade: null, hardware: null, dims: {} };
    const out = $('.calc__sum', calc);
    const panel = $('.calc__panel', calc);
    let shown = 0;

    cfg.steps.forEach(s => {
      if (s.type === 'choice') state[s.id] = s.options[0].id;
      if (s.type === 'dimensions') s.fields.forEach(f => { state.dims[f.id] = f.value; });
    });

    const optionOf = (stepId, id) =>
      cfg.steps.find(s => s.id === stepId).options.find(o => o.id === id);

    const price = () => {
      const kind = optionOf('kind', state.kind);
      const facade = optionOf('facade', state.facade);
      const hw = optionOf('hardware', state.hardware);
      const { length = 1, height = 1, depth = 0.6 } = state.dims;
      // База + погонный метр, с поправкой на высоту и глубину относительно типовых 2,6 × 0,6 м
      const running = length * kind.rate;
      const shape = (0.72 + 0.28 * (height / 2.6)) * (0.80 + 0.20 * (depth / 0.6));
      return Math.round((kind.base + running) * shape * facade.k * hw.k / 1000) * 1000;
    };

    const render = () => {
      const v = price();
      const t0 = performance.now(), from = shown, dur = REDUCED ? 0 : 620;
      const step = now => {
        const k = clamp((now - t0) / (dur || 1));
        shown = Math.round(lerp(from, v, easeOut(k)) / 1000) * 1000;
        out.textContent = 'от ' + nf.format(shown) + ' ' + (cfg.currency || '₽');
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      $$('[data-spec]', calc).forEach(el => {
        const key = el.dataset.spec;
        if (key === 'size') {
          el.textContent = `${state.dims.length} × ${state.dims.height} × ${state.dims.depth} м`;
        } else {
          const o = optionOf(key, state[key]);
          if (o) el.textContent = o.label;
        }
      });
    };

    $$('.opt', calc).forEach(b => b.addEventListener('click', () => {
      const step = b.dataset.step;
      $$(`.opt[data-step="${step}"]`, calc).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      state[step] = b.dataset.value;
      render();
    }));

    $$('.dim input', calc).forEach(r => r.addEventListener('input', () => {
      state.dims[r.dataset.dim] = +r.value;
      $(`[data-dimout="${r.dataset.dim}"]`, calc).textContent = (+r.value).toFixed(r.step < 0.1 ? 2 : 1);
      render();
    }));

    render();

    if (panel && matchMedia('(max-width: 999px)').matches) {
      onScroll(() => {
        const r = calc.getBoundingClientRect();
        const on = r.top < window.innerHeight * 0.6 && r.bottom > 260;
        panel.classList.toggle('is-shown', on);
        document.body.classList.toggle('calc-open', on);   // чтобы не спорил с нижним dock
      });
    }
  }

  /* ---------------------------------------------------------- 07 QUIZ */
  const quiz = $('.quiz');
  if (quiz) {
    const qs = $$('.q', quiz), railI = $('.quiz__rail i', quiz);
    const cur = $('.quiz__cur', quiz), done = $('.quiz__done', quiz);
    const back = $('[data-quiz="back"]', quiz);
    const answers = {};
    let idx = 0;

    const show = i => {
      idx = i;
      qs.forEach((q, n) => {
        q.classList.toggle('is-active', n === i);
        q.classList.toggle('is-prev', n < i);
      });
      const finished = i >= qs.length;
      if (done) done.hidden = !finished;
      quiz.querySelector('.quiz__viewport').hidden = finished;
      if (cur) cur.textContent = String(Math.min(i + 1, qs.length)).padStart(2, '0');
      if (railI) railI.style.width = (Math.min(i, qs.length) / qs.length * 100) + '%';
      if (back) back.disabled = i === 0 || finished;
    };

    qs.forEach((q, n) => $$('.q__opt', q).forEach(b => b.addEventListener('click', () => {
      $$('.q__opt', q).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      answers[q.dataset.q] = b.dataset.value;
      setTimeout(() => show(n + 1), 240);
    })));
    if (back) back.addEventListener('click', () => show(Math.max(0, idx - 1)));
    show(0);
    quiz.dataset.answers = '';
    $('[data-quiz="submit"]', quiz)?.addEventListener('click', () => {
      openSheet('Расчёт по опросу', Object.entries(answers).map(([k, v]) => `${k}: ${v}`).join(' · '));
    });
  }

  /* ---------------------------------------------------------- 08 МАТЕРИАЛЫ: mouse tracking */
  $$('.mat').forEach(mat => {
    const img = $('img', mat), cap = $('.mat__cap', mat);
    if (!FINE || REDUCED) return;
    mat.addEventListener('mousemove', e => {
      const r = mat.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      img.style.transform = `scale(1.10) translate3d(${(-nx * 22).toFixed(1)}px, ${(-ny * 22).toFixed(1)}px, 0)`;
      cap.style.left = (e.clientX - r.left) + 'px';
      cap.style.top  = (e.clientY - r.top - 34) + 'px';
    });
    mat.addEventListener('mouseleave', () => { img.style.transform = ''; });
  });

  /* ---------------------------------------------------------- 09 HOTSPOTS */
  $$('.spot').forEach(spot => {
    const btn = $('.spot__btn', spot);
    const close = () => $$('.spot').forEach(s => s.classList.remove('is-open'));
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const open = spot.classList.contains('is-open');
      close();
      spot.classList.toggle('is-open', !open);
      btn.setAttribute('aria-expanded', String(!open));
    });
    if (FINE) spot.addEventListener('mouseenter', () => { close(); spot.classList.add('is-open'); });
  });
  document.addEventListener('click', () => $$('.spot').forEach(s => s.classList.remove('is-open')));

  /* ---------------------------------------------------------- 10 ПРОИЗВОДСТВО: слои */
  const prod = $('.prod__scene');
  if (prod) {
    const layers = $$('.prod__layer', prod);
    const stage = $('.prod__stage', prod);
    const ticks = $$('.prod__ticks i', prod);
    const steps = JSON.parse(prod.closest('.prod').dataset.steps || '[]');
    const num = $('.prod__stage .num', prod), ttl = $('.prod__stage h3', prod), txt = $('.prod__text', prod);
    let last = -1;

    const measure = () => { prod.style.height = (layers.length * 100) + 'svh'; };
    measure();

    const scene = () => {
      const p = pinned(prod);
      const pos = p * (layers.length - 1);
      layers.forEach((l, i) => {
        // Каждый следующий слой приходит снизу и вытесняет предыдущий
        const k = clamp(pos - (i - 1));
        l.style.clipPath = i === 0 ? 'inset(0 0 0 0)' : `inset(${((1 - k) * 100).toFixed(2)}% 0 0 0)`;
        const img = l.firstElementChild;
        if (img && !REDUCED) img.style.transform = `translate3d(0, ${((1 - k) * -6).toFixed(2)}%, 0) scale(1.06)`;
      });
      const i = Math.min(steps.length - 1, Math.round(pos));
      if (i !== last && steps[i]) {
        last = i;
        if (stage && !REDUCED) {
          stage.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }],
                        { duration: 520, easing: 'cubic-bezier(.16,1,.3,1)' });
        }
        num.textContent = steps[i].n; ttl.textContent = steps[i].title; txt.textContent = steps[i].text;
        ticks.forEach((t, n) => t.classList.toggle('is-on', n <= i));
      }
    };
    scene.measure = measure;
    onScroll(scene);
  }

  /* ---------------------------------------------------------- 11 МОДАЛКА ДОКУМЕНТА */
  const modal = $('.modal');
  if (modal) {
    const img = $('.modal__box img', modal), cap = $('.modal__cap', modal);
    let opener = null;
    const open = btn => {
      opener = btn;
      img.src = btn.dataset.doc; img.alt = btn.dataset.title; img.hidden = false;
      cap.textContent = btn.dataset.title;
      modal.classList.add('is-open');
      document.body.classList.add('is-locked');
      $('.modal__close', modal).focus();
    };
    const shut = () => {
      modal.classList.remove('is-open');
      document.body.classList.remove('is-locked');
      opener?.focus();
    };
    $$('.doc').forEach(b => b.addEventListener('click', () => open(b)));
    $('.modal__close', modal).addEventListener('click', shut);
    modal.addEventListener('click', e => { if (e.target === modal) shut(); });
    addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('is-open')) shut(); });
  }

  /* ---------------------------------------------------------- 12 ОТЗЫВЫ */
  const reviews = $('.reviews');
  if (reviews) {
    const slides = $$('.rev', reviews), dots = $$('.reviews__dots i', reviews);
    const measure = () => { reviews.style.height = (slides.length * 100) + 'svh'; };
    measure();
    const scene = () => {
      const i = Math.min(slides.length - 1, Math.round(pinned(reviews) * (slides.length - 1)));
      slides.forEach((s, n) => s.classList.toggle('is-on', n === i));
      dots.forEach((d, n) => d.classList.toggle('is-on', n === i));
    };
    scene.measure = measure;
    onScroll(scene);
  }

  /* ---------------------------------------------------------- 13 PROCESS timeline */
  const tl = $('.tl');
  if (tl) {
    const items = $$('.tl__i', tl), line = $('.tl__line i', tl);
    onScroll(() => {
      const p = clamp((passed(tl) - 0.25) / 0.5);
      const active = Math.floor(p * items.length);
      items.forEach((it, i) => it.classList.toggle('is-on', i <= active));
      if (line) line.style.width = (clamp((active + 1) / items.length) * 100) + '%';
    });
  }

  /* ---------------------------------------------------------- 14 CTA parallax */
  const measureBg = $('.measure__bg img');
  if (measureBg && !REDUCED) {
    const host = $('.measure');
    onScroll(() => {
      const p = passed(host) - 0.5;
      measureBg.style.transform = `translate3d(0, ${(p * -60).toFixed(1)}px, 0) scale(1.14)`;
    });
  }

  /* ---------------------------------------------------------- 15 КАРТА (тёмная, без внешних тайлов) */
  const map = $('.map__canvas');
  if (map) {
    const ctx = map.getContext('2d');
    let cam = { x: 0, y: 0, z: 1 }, drag = null;

    const draw = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const w = map.clientWidth, h = map.clientHeight;
      map.width = w * dpr; map.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#0B0A09'; ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w / 2 + cam.x, h / 2 + cam.y);
      ctx.scale(cam.z, cam.z);

      // кварталы
      ctx.strokeStyle = 'rgba(246,243,239,.06)'; ctx.lineWidth = 1;
      ctx.fillStyle = 'rgba(246,243,239,.022)';
      for (let gx = -8; gx <= 8; gx++) for (let gy = -6; gy <= 6; gy++) {
        const x = gx * 92 + ((gy % 2) * 16), y = gy * 78;
        const bw = 62 + ((gx * 7 + gy * 13) % 22), bh = 48 + ((gx * 5 + gy * 11) % 20);
        ctx.beginPath(); ctx.rect(x, y, bw, bh); ctx.fill(); ctx.stroke();
      }
      // магистрали
      ctx.strokeStyle = 'rgba(246,243,239,.12)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-900, 40); ctx.lineTo(900, -20); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-120, -700); ctx.lineTo(60, 700); ctx.stroke();
      // река
      ctx.strokeStyle = 'rgba(111,141,157,.35)'; ctx.lineWidth = 22; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-800, 240); ctx.bezierCurveTo(-300, 140, 200, 330, 820, 190); ctx.stroke();
      // точка шоурума и подпись — на самой карте, чтобы двигались вместе с ней
      ctx.fillStyle = '#D8B27C';
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(216,178,124,.34)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.stroke();
      const text = (map.dataset.label || '').toUpperCase();
      if (text) {
        ctx.font = '500 10px Inter, system-ui, sans-serif';
        ctx.letterSpacing = '1.4px';
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(246,243,239,.86)';
        ctx.fillText(text, 0, -34);
      }
      ctx.restore();
    };

    const at = e => (e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY });
    const start = e => { drag = { ...at(e), cx: cam.x, cy: cam.y }; };
    const move = e => {
      if (!drag) return;
      const p = at(e);
      cam.x = drag.cx + (p.x - drag.x); cam.y = drag.cy + (p.y - drag.y);
      draw();
    };
    const end = () => { drag = null; };
    map.addEventListener('mousedown', start); addEventListener('mousemove', move); addEventListener('mouseup', end);
    map.addEventListener('touchstart', start, { passive: true });
    map.addEventListener('touchmove', move, { passive: true });
    map.addEventListener('touchend', end);
    map.addEventListener('wheel', e => {
      e.preventDefault();
      cam.z = clamp(cam.z * (e.deltaY > 0 ? 0.92 : 1.08), 0.5, 3);
      draw();
    }, { passive: false });
    $$('[data-map]').forEach(b => b.addEventListener('click', () => {
      const k = b.dataset.map;
      if (k === 'reset') cam = { x: 0, y: 0, z: 1 };
      else cam.z = clamp(cam.z * (k === 'in' ? 1.25 : 0.8), 0.5, 3);
      draw();
    }));
    addEventListener('resize', draw, { passive: true });
    draw();
  }

  /* ---------------------------------------------------------- ФОРМА-ЛИСТ */
  const sheet = $('.sheet');
  let sheetOpener = null;
  function openSheet(title, context) {
    if (!sheet) return;
    $('.sheet__title', sheet).textContent = title || 'Оставить заявку';
    $('#form-context', sheet).value = context || '';
    $('.sheet__form', sheet).hidden = false;
    $('.sheet__ok', sheet).hidden = true;
    sheet.classList.add('is-open');
    document.body.classList.add('is-locked');
    setTimeout(() => $('input', sheet)?.focus(), 260);
  }
  function shutSheet() {
    sheet.classList.remove('is-open');
    document.body.classList.remove('is-locked');
    sheetOpener?.focus();
  }
  if (sheet) {
    $$('[data-form]').forEach(b => b.addEventListener('click', e => {
      e.preventDefault(); sheetOpener = b; openSheet(b.dataset.form, b.dataset.context);
    }));
    $('.sheet__close', sheet).addEventListener('click', shutSheet);
    sheet.addEventListener('click', e => { if (e.target === sheet) shutSheet(); });
    addEventListener('keydown', e => { if (e.key === 'Escape' && sheet.classList.contains('is-open')) shutSheet(); });

    const drop = $('.drop', sheet), file = $('.drop input', sheet), fileName = $('.drop__name', sheet);
    drop.addEventListener('click', () => file.click());
    file.addEventListener('change', () => { fileName.textContent = file.files[0]?.name || 'Файл не выбран'; });
    ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('is-over'); }));
    drop.addEventListener('drop', e => {
      if (e.dataTransfer.files.length) { file.files = e.dataTransfer.files; fileName.textContent = e.dataTransfer.files[0].name; }
    });

    $('.sheet__form', sheet).addEventListener('submit', e => {
      e.preventDefault();
      // Точка интеграции: сюда подставляется endpoint CRM/бэкенда (см. README).
      $('.sheet__form', sheet).hidden = true;
      $('.sheet__ok', sheet).hidden = false;
    });
  }
  window.OLGA = { openSheet };

  /* ---------------------------------------------------------- Sticky dock */
  const dock = $('.dock');
  if (dock) onScroll(() => dock.classList.toggle('is-shown', window.scrollY > window.innerHeight * 0.9));

  /* ---------------------------------------------------------- Плавный переход к якорям */
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const t = document.querySelector(id);
    if (!t) return;
    e.preventDefault();
    t.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
  }));
})();
