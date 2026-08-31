/* OLGA — шаблоны секций. Всё, что рендерится, приходит из content/site.json. */

export const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const attr = o => JSON.stringify(o).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
const lines = (arr, cls = '') => arr.map(l => `<span class="split-line ${cls}"><span>${esc(l)}</span></span>`).join('');
const ARROW = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.2"/></svg>';

/**
 * Источник изображения. Если значение — внешний URL, локальный кадр той же
 * секции остаётся запасным: не загрузилось (нет сети, ID протух) — показываем его,
 * а не битую картинку.
 */
export const img = (src, alt, { fallback = '', cls = '', extra = '' } = {}) => {
  const remote = /^https?:\/\//.test(String(src));
  const fb = remote && fallback ? ` data-fallback="${esc(fallback)}"` : '';
  return `<img src="${esc(src)}" alt="${esc(alt)}"${cls ? ` class="${esc(cls)}"` : ''}${fb}${extra ? ' ' + extra : ''} loading="lazy" decoding="async">`;
};

const icon = {
  wa: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.5 14.1c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.6-2.6-1.1-4.3-3.8-4.4-4-.1-.2-1-1.4-1-2.6 0-1.2.6-1.8.9-2 .2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 2c.1.2.1.3 0 .5l-.4.5-.3.3c-.1.1-.2.3 0 .5.2.3.7 1.2 1.6 1.9 1.1.9 1.9 1.2 2.2 1.3.2.1.4.1.5-.1l.7-.8c.2-.2.3-.2.5-.1l2 1c.2.1.4.2.4.3.1.1.1.5-.1 1.1Z"/></svg>',
  tg: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21.9 4.3 18.9 19c-.2 1-.8 1.3-1.7.8l-4.6-3.4-2.2 2.1c-.3.3-.5.5-1 .5l.4-4.9 8.9-8c.4-.3-.1-.5-.6-.2L6.3 12.6 1.8 11.2c-1-.3-1-1 .2-1.4l18.6-7.2c.8-.3 1.5.2 1.3 1.7Z"/></svg>',
  phone: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6.6 3h3l1.5 4-2 1.5a12 12 0 0 0 5.4 5.4l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16.8 16.8 0 0 1 4.6 5.2 2 2 0 0 1 6.6 3Z"/></svg>',
  zoom: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.2"/><path d="M11 11l3.5 3.5M7 5v4M5 7h4" stroke="currentColor" stroke-width="1.2"/></svg>'
};

/* ------------------------------------------------------------------ header */
export const header = d => `
<header class="header">
  <div class="wrap header__in">
    <a class="logo" href="#top" aria-label="${esc(d.meta.brand)} — на главную">
      <span class="logo__mark">${esc(d.meta.brand)}</span>
      <span class="logo__sub">${esc(d.meta.brandLine)}</span>
    </a>
    <nav class="nav" aria-label="Основная навигация">
      ${d.nav.map(n => `<a href="${esc(n.href)}">${esc(n.label)}</a>`).join('')}
    </nav>
    <div class="header__side">
      <a class="header__phone" href="${esc(d.contacts.phoneHref)}">${esc(d.contacts.phone)}</a>
      <a class="icon-btn" href="${esc(d.contacts.whatsapp)}" aria-label="WhatsApp" target="_blank" rel="noopener">${icon.wa}</a>
      <a class="icon-btn" href="${esc(d.contacts.telegram)}" aria-label="Telegram" target="_blank" rel="noopener">${icon.tg}</a>
      <button class="btn btn--solid" data-magnetic="0.3" data-form="Рассчитать проект" data-context="header">
        <span class="btn__label">Рассчитать проект</span>
      </button>
      <button class="burger" aria-expanded="false" aria-controls="menu" aria-label="Меню">
        <span></span><span></span><span></span>
      </button>
    </div>
  </div>
</header>

<div class="menu" id="menu">
  <nav class="menu__list" aria-label="Мобильная навигация">
    ${d.nav.map(n => `<a href="${esc(n.href)}">${esc(n.label)}</a>`).join('')}
  </nav>
  <div class="menu__foot">
    <a class="btn btn--ghost" href="${esc(d.contacts.phoneHref)}"><span class="btn__label">${esc(d.contacts.phone)}</span></a>
    <a class="icon-btn" href="${esc(d.contacts.whatsapp)}" aria-label="WhatsApp">${icon.wa}</a>
    <a class="icon-btn" href="${esc(d.contacts.telegram)}" aria-label="Telegram">${icon.tg}</a>
  </div>
</div>`;

/* ------------------------------------------------------------------ 01 hero */
export const hero = d => {
  const h = d.hero;
  const cfg = attr({ video: h.video, frames: h.frames, playback: h.playback || 'scrub' });
  // Источник выбирается в JS по ширине экрана: <source media> для этого
  // ненадёжен, а мобильному нужен свой, лёгкий файл.
  // Постер лежит отдельным слоем под видео: при загрузке страницы первой
  // появляется фотография, и только затем поверх неё проявляется видео.
  const poster = esc(h.poster || h.frames.pattern.replace('{i}', '00'));
  const posterFb = esc(h.posterFallback || h.frames.pattern.replace('{i}', '00'));
  const stage = h.video
    ? `<img class="hero__poster" src="${poster}" alt="" aria-hidden="true"
            data-fallback="${posterFb}">
       <video class="hero__video" playsinline muted autoplay preload="auto" poster="${poster}"
              data-src="${esc(h.video)}" data-src-mobile="${esc(h.videoMobile || h.video)}"></video>`
    : `<canvas class="hero__canvas" aria-hidden="true"></canvas>`;
  return `
<section class="hero grain" id="top" data-hero="${cfg}" data-playback="${esc(h.video ? (h.playback || 'scrub') : 'scrub')}">
  <div class="hero__pin">
    <div class="hero__stage">${stage}</div>
    ${h.video ? `<button class="hero__play" type="button">
      <span class="hero__play-i" aria-hidden="true"></span>
      <span>${esc(h.playLabel || 'Смотреть ролик')}</span>
    </button>` : ''}

    <div class="hero__annos" aria-hidden="true">
      ${h.annotations.map(a => `
      <div class="anno" data-at="${a.at}" data-x="${a.x}" data-y="${a.y}" data-tx="${a.tx}" data-ty="${a.ty}">
        <span class="anno__line"></span><span class="anno__dot"></span>
        <span class="anno__tag">${esc(a.label)}</span>
      </div>`).join('')}
    </div>

    <div class="hero__content">
      <p class="label hero__eyebrow">${esc(h.eyebrow)}</p>
      <h1 class="h-hero hero__title is-in">${lines(h.title)}</h1>
      <p class="lead hero__sub">${esc(h.subtitle)}</p>
      <div class="hero__actions">
        <button class="btn btn--solid" data-magnetic="0.34" data-form="Рассчитать стоимость" data-context="hero">
          <span class="btn__label">${esc(h.cta.label)}</span>
        </button>
        <a class="link-arrow" href="${esc(h.secondary.href)}">${esc(h.secondary.label)} ${ARROW}</a>
      </div>
    </div>

    <div class="hero__scroll" aria-hidden="true">
      <span class="label">${esc(h.scrollHint)}</span>
      <span class="hero__line"></span>
    </div>
    ${h.playback === 'scrub' || !h.video ? '<div class="hero__progress" aria-hidden="true"><i></i></div>' : ''}
  </div>
</section>`;
};

/* ------------------------------------------------------------------ 02 usp */
export const usp = d => `
<section class="usp" aria-labelledby="usp-title">
  <div class="wrap usp__statement">
    <h2 class="h-1 reveal" id="usp-title">${esc(d.usp.statement[0])}</h2>
    <h2 class="h-1 reveal">${esc(d.usp.statement[1])}</h2>
  </div>
  <div class="usp__track-outer">
    <div class="usp__pin">
      <div class="usp__track">
        ${d.usp.items.map(i => `
        <article class="usp__item">
          <div class="usp__media">${img(i.image, i.title, { fallback: i.fallback })}</div>
          <div class="usp__body">
            <span class="usp__num">${esc(i.n)}</span>
            <h3 class="h-3">${esc(i.title)}</h3>
            <p>${esc(i.text)}</p>
          </div>
        </article>`).join('')}
      </div>
      <div class="usp__rail" aria-hidden="true"><i></i></div>
    </div>
  </div>
</section>`;

/* ------------------------------------------------------------------ 03 catalog */
export const catalog = d => `
<section class="catalog section--flush" id="catalog" aria-labelledby="cat-title">
  <div class="wrap catalog__head section">
    <h2 class="h-1" id="cat-title">${lines(d.catalog.title)}</h2>
  </div>
  ${d.catalog.items.map(i => `
  <a class="cat" href="${esc(i.href)}" data-cursor="Смотреть">
    <div class="cat__media">${img(i.image, i.title, { fallback: i.fallback })}</div>
    <div class="wrap cat__in">
      <div class="cat__top">
        <span class="label">${esc(i.n)}</span>
        <span class="label">${esc(i.meta)}</span>
      </div>
      <div class="cat__bottom">
        <h3 class="cat__title">${esc(i.title)}</h3>
        <span class="cat__go">
          <span class="label">${esc(d.catalog.hint)}</span>
          <span class="cat__arrow">${ARROW}</span>
        </span>
      </div>
    </div>
  </a>`).join('')}
</section>`;

/* ------------------------------------------------------------------ 04 projects */
export const projects = d => {
  const p = d.projects;
  const filter = (key, f) => `
    <div class="filter" data-filter="${key}">
      <span class="label filter__label">${esc(f.label)}</span>
      <div class="filter__opts" role="group" aria-label="${esc(f.label)}">
        ${f.options.map((o, i) => `<button class="chip" type="button" data-value="${esc(o)}" aria-pressed="${i === 0}">${esc(o)}</button>`).join('')}
      </div>
    </div>`;
  // Раскладка карточки берётся из контента; без неё — чередование по порядку.
  // Через поле, а не через индекс: иначе добавление проекта в середину
  // перетасовало бы раскладки всех следующих.
  const shape = (it, i) => it.layout ? `pj--${esc(it.layout)}` : ['', 'pj--mirror', 'pj--pano', ''][i % 4];
  return `
<section class="projects section" id="projects" aria-labelledby="pj-title">
  <div class="wrap">
    <div class="section__head">
      <span class="label">Избранные работы</span>
      <h2 class="h-1" id="pj-title">${lines(p.title)}</h2>
    </div>

    <div class="filters">
      ${Object.entries(p.filters).map(([k, f]) => filter(k, f)).join('')}
      <p class="filters__count" role="status" aria-live="polite"></p>
    </div>

    <div class="gallery">
      ${p.items.map((it, i) => `
      <article class="pj ${shape(it, i)}" data-style="${esc(it.style)}" data-budget="${esc(it.budget)}" data-type="${esc(it.type)}">
        ${it.images.map((im, n) => `
        <figure class="pj__fig pj__${'abc'[n]} reveal">
          ${img(im.src, im.alt, { fallback: im.fallback, extra: `data-depth="${[1, 1.6, 2.2][n]}"` })}
          <figcaption>${esc(im.alt)}</figcaption>
        </figure>`).join('')}
        <div class="pj__meta">
          <h3 class="h-3">${esc(it.title)}</h3>
          <span class="muted sm">${esc(it.meta)}</span>
          <span class="pj__tags">
            <span class="pj__tag">${esc(it.style)}</span>
            <span class="pj__tag">${esc(it.type)}</span>
            <span class="pj__tag">${esc(it.budget)}</span>
          </span>
        </div>
      </article>`).join('')}
      <p class="gallery__empty" hidden>Под выбранные параметры проектов пока нет. Снимите один из фильтров.</p>
    </div>
  </div>
</section>`;
};

/* ------------------------------------------------------------------ 05 case study */
export const caseStudy = d => {
  const c = d.caseStudy;
  return `
<section class="case" aria-labelledby="case-title">
  <div class="case__pin">
    <div class="case__frame">
      ${c.video
        ? `<video class="case__video" playsinline muted loop preload="auto"
                  poster="${esc(c.poster || c.image)}"
                  data-src="${esc(c.video)}" data-src-mobile="${esc(c.videoMobile || c.video)}"
                  aria-label="${esc(c.title)}"></video>`
        : img(c.image, c.title, { fallback: c.fallback })}
      <div class="case__hud">
      <div>
        <span class="label">${esc(c.kicker)}</span>
        <h2 class="h-1" id="case-title" style="margin-top:var(--s-3)">${esc(c.title)}</h2>
        <p class="lead" style="margin-top:var(--s-3)">${esc(c.scope)}</p>
      </div>
      <div>
        <div class="case__facts">
          ${c.facts.map(f => `
          <div class="fact">
            <span class="label">${esc(f.label)}</span>
            <div class="fact__v" data-value="${f.value}" data-prefix="${esc(f.prefix || '')}" data-suffix="${esc(f.suffix || '')}">0</div>
          </div>`).join('')}
        </div>
        <div class="case__mats">${c.materials.map(m => `<span>${esc(m)}</span>`).join('')}</div>
        </div>
      </div>
    </div>
  </div>
</section>`;
};

/* ------------------------------------------------------------------ 06 calculator */
export const calculator = d => {
  const c = d.calculator;
  const choice = s => `
    <div class="step">
      <div class="step__head"><span class="step__n">0${c.steps.indexOf(s) + 1}</span><h3 class="h-3">${esc(s.label)}</h3></div>
      <div class="opts" role="group" aria-label="${esc(s.label)}">
        ${s.options.map((o, i) => `<button class="opt" type="button" data-step="${esc(s.id)}" data-value="${esc(o.id)}" aria-pressed="${i === 0}">${esc(o.label)}</button>`).join('')}
      </div>
    </div>`;
  const dims = s => `
    <div class="step">
      <div class="step__head"><span class="step__n">0${c.steps.indexOf(s) + 1}</span><h3 class="h-3">${esc(s.label)}</h3></div>
      <div class="dims">
        ${s.fields.map(f => `
        <div class="dim">
          <div class="dim__top">
            <label class="label" for="dim-${esc(f.id)}">${esc(f.label)}</label>
            <span class="dim__val"><span data-dimout="${esc(f.id)}">${f.value}</span> ${esc(f.unit)}</span>
          </div>
          <input id="dim-${esc(f.id)}" type="range" data-dim="${esc(f.id)}"
                 min="${f.min}" max="${f.max}" step="${f.step}" value="${f.value}">
        </div>`).join('')}
      </div>
    </div>`;
  return `
<section class="calc section" id="calculator" data-calc="${attr(c)}" aria-labelledby="calc-title">
  <div class="wrap">
    <div class="section__head">
      <span class="label">Калькулятор</span>
      <h2 class="h-1 reveal" id="calc-title">${esc(c.title)}</h2>
    </div>
    <div class="calc__grid">
      <div class="calc__steps">
        ${c.steps.map(s => (s.type === 'dimensions' ? dims(s) : choice(s))).join('')}
      </div>
      <aside class="calc__panel" aria-live="polite">
        <div class="calc__row">
          <div>
            <span class="label">Предварительная стоимость</span>
            <div class="calc__sum">от 0 ₽</div>
          </div>
          <button class="btn btn--accent" data-magnetic="0.3" data-form="${esc(c.cta)}" data-context="calculator">
            <span class="btn__label">${esc(c.cta)}</span>
            <span class="btn__label--short">Расчёт</span>
          </button>
        </div>
        <div class="calc__spec">
          <div><span>Тип</span><span data-spec="kind"></span></div>
          <div><span>Размеры</span><span data-spec="size"></span></div>
          <div><span>Фасады</span><span data-spec="facade"></span></div>
          <div><span>Фурнитура</span><span data-spec="hardware"></span></div>
        </div>
        <p class="sm muted" style="margin:0">${esc(c.note)}</p>
      </aside>
    </div>
  </div>
</section>`;
};

/* ------------------------------------------------------------------ 07 quiz */
export const quiz = d => {
  const q = d.quiz;
  return `
<section class="quiz section" aria-labelledby="quiz-title">
  <div class="wrap wrap--narrow">
    <div class="quiz__box">
      <div class="quiz__bar">
        <span class="num"><span class="quiz__cur">01</span> / 0${q.questions.length}</span>
        <span class="quiz__rail"><i></i></span>
      </div>
      <h2 class="h-2 reveal" id="quiz-title" style="margin-bottom:var(--s-6)">${esc(q.title)}</h2>

      <div class="quiz__viewport">
        ${q.questions.map(item => `
        <div class="q" data-q="${esc(item.label)}">
          <h3 class="h-3">${esc(item.label)}</h3>
          <div class="q__opts" role="group" aria-label="${esc(item.label)}">
            ${item.options.map(o => `
            <button class="q__opt" type="button" data-value="${esc(o)}" aria-pressed="false">
              <span>${esc(o)}</span><span>${ARROW}</span>
            </button>`).join('')}
          </div>
        </div>`).join('')}
      </div>

      <div class="quiz__nav">
        <button class="btn btn--ghost btn--sm" type="button" data-quiz="back"><span class="btn__label">Назад</span></button>
      </div>

      <div class="quiz__done" hidden>
        <h3 class="h-2">${esc(q.resultTitle)}</h3>
        <button class="btn btn--solid" type="button" data-magnetic="0.3" data-quiz="submit">
          <span class="btn__label">${esc(q.cta)}</span>
        </button>
      </div>
    </div>
  </div>
</section>`;
};

/* ------------------------------------------------------------------ 08 materials */
export const materials = d => `
<section class="materials section" id="materials" aria-labelledby="mat-title">
  <div class="wrap">
    <div class="section__head">
      <span class="label">Материалы и фурнитура</span>
      <h2 class="h-1" id="mat-title">${lines(d.materials.title)}</h2>
    </div>
    <div class="mats">
      ${d.materials.items.map(m => `
      <figure class="mat reveal">
        ${img(m.image, m.label, { fallback: m.fallback })}
        <figcaption class="mat__cap"><b>${esc(m.label)}</b><i>${esc(m.sub)}</i></figcaption>
      </figure>`).join('')}
    </div>
  </div>
</section>`;

/* ------------------------------------------------------------------ 09 details */
export const details = d => `
<section class="details section" aria-labelledby="det-title">
  <div class="wrap">
    <div class="section__head">
      <span class="label">Архитектура изделия</span>
      <h2 class="h-1 reveal" id="det-title">${esc(d.details.title)}</h2>
    </div>
    <div class="hot clip-reveal">
      <span class="hot__frame clip-target">
        ${img(d.details.image, "Кухня крупным планом", { fallback: d.details.fallback })}
      </span>
      ${d.details.hotspots.map(s => `
      <div class="spot" style="left:${s.x}%; top:${s.y}%">
        <button class="spot__btn" type="button" aria-expanded="false" aria-label="${esc(s.title)}">${esc(s.n)}</button>
        <div class="spot__card"><b>${esc(s.title)}</b><span>${esc(s.text)}</span></div>
      </div>`).join('')}
    </div>
    <ul class="hot__legend">
      ${d.details.hotspots.map(s => `<li><span class="num">${esc(s.n)}</span><span><b>${esc(s.title)}</b><span>${esc(s.text)}</span></span></li>`).join('')}
    </ul>
  </div>
</section>`;

/* ------------------------------------------------------------------ 10 production */
export const production = d => `
<section class="prod" id="production" data-steps="${attr(d.production.steps.map(s => ({ n: s.n, title: s.title, text: s.text })))}" aria-labelledby="prod-title">
  <div class="wrap section">
    <span class="label">Производство</span>
    <h2 class="h-1" id="prod-title" style="margin-top:var(--s-4)">${lines(d.production.title)}</h2>
  </div>
  <div class="prod__scene">
  <div class="prod__pin">
    ${d.production.steps.map(s => `
    <div class="prod__layer">${img(s.image, s.title, { fallback: s.fallback })}</div>`).join('')}
    <div class="prod__ticks" aria-hidden="true">${d.production.steps.map(() => '<i></i>').join('')}</div>
    <div class="prod__hud">
      <div class="prod__stage">
        <span class="num">${esc(d.production.steps[0].n)}</span>
        <h3>${esc(d.production.steps[0].title)}</h3>
      </div>
      <p class="prod__text">${esc(d.production.steps[0].text)}</p>
    </div>
  </div>
  </div>
</section>`;

/* ------------------------------------------------------------------ 11 quality */
export const quality = d => `
<section class="quality section" aria-labelledby="q-title">
  <div class="wrap">
    <div class="section__head">
      <span class="label">Документы</span>
      <h2 class="h-1 reveal" id="q-title">${esc(d.quality.title)}</h2>
      <p class="lead">${esc(d.quality.note)}</p>
    </div>
    <div class="docs">
      ${d.quality.documents.map(doc => `
      <button class="doc reveal" type="button" data-doc="${esc(doc.image)}" data-title="${esc(doc.title)}" data-cursor="Открыть">
        <span class="doc__thumb">
          ${img(doc.image, doc.title, { fallback: doc.fallback })}
          <span class="doc__zoom">${icon.zoom}</span>
        </span>
        <span class="h-3">${esc(doc.title)}</span>
        <span class="label">${esc(doc.meta)}</span>
      </button>`).join('')}
    </div>
    <div class="brands">${d.quality.brands.map(b => `<span>${esc(b)}</span>`).join('')}</div>
  </div>
</section>

<div class="modal" role="dialog" aria-modal="true" aria-label="Документ">
  <div class="modal__box">
    <button class="btn btn--ghost btn--sm modal__close" type="button"><span class="btn__label">Закрыть</span></button>
    <img alt="" hidden>
    <p class="label modal__cap"></p>
  </div>
</div>`;

/* ------------------------------------------------------------------ 12 reviews */
export const reviews = d => `
<section class="reviews" aria-label="Отзывы клиентов">
  <div class="reviews__pin">
    ${d.testimonials.map((t, i) => `
    <article class="rev${i === 0 ? ' is-on' : ''}">
      <div class="rev__media">${img(t.image, `Интерьер клиента: ${t.project}`, { fallback: t.fallback })}</div>
      <div class="wrap rev__body">
        <div class="rev__inner">
          <span class="rev__stars" aria-label="Оценка ${t.rating} из 5">${'★'.repeat(t.rating)}</span>
          <blockquote class="rev__quote">«${esc(t.quote)}»</blockquote>
          <div class="rev__who">
            <b>${esc(t.name)}</b>
            <span>${esc(t.city)} · проект: ${esc(t.project)}</span>
          </div>
        </div>
      </div>
    </article>`).join('')}
    <div class="reviews__dots" aria-hidden="true">${d.testimonials.map((_, i) => `<i${i === 0 ? ' class="is-on"' : ''}></i>`).join('')}</div>
  </div>
</section>`;

/* ------------------------------------------------------------------ 13 process */
export const process = d => `
<section class="process section" id="process" aria-labelledby="pr-title">
  <div class="wrap">
    <div class="section__head">
      <span class="label">Процесс</span>
      <h2 class="h-1 reveal" id="pr-title">${esc(d.process.title)}</h2>
    </div>
    <div class="tl">
      <div class="tl__line" aria-hidden="true"><i></i></div>
      <ol class="tl__row">
        ${d.process.steps.map(s => `
        <li class="tl__i">
          <span class="num">${esc(s.n)}</span>
          <h3 class="h-3">${esc(s.title)}</h3>
          <p>${esc(s.text)}</p>
        </li>`).join('')}
      </ol>
    </div>
  </div>
</section>`;

/* ------------------------------------------------------------------ 14 cta */
export const ctaMeasure = d => `
<section class="measure grain" aria-labelledby="cta-title">
  <div class="measure__bg">${img(d.ctaMeasure.image, "", { fallback: d.ctaMeasure.fallback, extra: 'aria-hidden="true"' })}</div>
  <div class="wrap measure__in">
    <h2 class="h-hero measure__title" id="cta-title">${lines(d.ctaMeasure.title)}</h2>
    <div class="measure__actions">
      <button class="btn btn--solid" data-magnetic="0.42" data-form="${esc(d.ctaMeasure.primary.label)}" data-context="cta-measure">
        <span class="btn__label">${esc(d.ctaMeasure.primary.label)}</span>
      </button>
      <a class="btn btn--ghost" data-magnetic="0.42" href="${esc(d.ctaMeasure.secondary.href)}">
        <span class="btn__label">${esc(d.ctaMeasure.secondary.label)}</span>
      </a>
    </div>
  </div>
</section>`;

/* ------------------------------------------------------------------ 15 contacts */
export const contacts = d => `
<section class="contacts section" id="contacts" aria-labelledby="c-title">
  <div class="wrap">
    <div class="section__head">
      <h2 class="h-mega" id="c-title">${lines(d.contactSection.title)}</h2>
    </div>
    <div class="contacts__grid">
      <div class="cinfo">
        <div class="cinfo__row">
          <span class="label">Телефон</span>
          <a href="${esc(d.contacts.phoneHref)}">${esc(d.contacts.phone)}</a>
        </div>
        <div class="cinfo__row">
          <span class="label">Мессенджеры</span>
          <span class="cinfo__links">
            <a class="link-arrow" href="${esc(d.contacts.whatsapp)}" target="_blank" rel="noopener">WhatsApp ${ARROW}</a>
            <a class="link-arrow" href="${esc(d.contacts.telegram)}" target="_blank" rel="noopener">Telegram ${ARROW}</a>
          </span>
        </div>
        <div class="cinfo__row"><span class="label">Шоурум</span><p>${esc(d.contacts.showroom)}</p></div>
        <div class="cinfo__row"><span class="label">Производство</span><p>${esc(d.contacts.production)}</p></div>
        <div class="cinfo__row"><span class="label">Режим работы</span><p>${esc(d.contacts.hours)}</p></div>
        <button class="btn btn--solid" data-magnetic="0.32" data-form="Оставить заявку" data-context="contacts">
          <span class="btn__label">${esc(d.contactSection.cta)}</span>
        </button>
      </div>

      <div class="map reveal">
        <canvas class="map__canvas" data-label="${esc(d.meta.brand)} showroom" aria-label="Схема расположения шоурума: ${esc(d.contacts.showroom)}"></canvas>
        <div class="map__note">
          <button class="btn btn--ghost btn--sm" type="button" data-map="in"><span class="btn__label">+</span></button>
          <button class="btn btn--ghost btn--sm" type="button" data-map="out"><span class="btn__label">−</span></button>
          <button class="btn btn--ghost btn--sm" type="button" data-map="reset"><span class="btn__label">Сброс</span></button>
        </div>
      </div>
    </div>
  </div>
</section>`;

/* ------------------------------------------------------------------ 16 footer */
export const footer = d => `
<footer class="footer">
  <div class="wrap">
    <div class="footer__grid">
      <div class="footer__col">
        <a class="logo" href="#top"><span class="logo__mark">${esc(d.meta.brand)}</span></a>
        <p class="sm muted" style="max-width:30ch">${esc(d.meta.description)}</p>
      </div>
      ${d.footer.columns.map(c => `
      <div class="footer__col">
        <span class="label">${esc(c.title)}</span>
        ${c.links.map(l => `<a href="${esc(l.href)}">${esc(l.label)}</a>`).join('')}
      </div>`).join('')}
      <div class="footer__col">
        <span class="label">Контакты</span>
        <a href="${esc(d.contacts.phoneHref)}">${esc(d.contacts.phone)}</a>
        <a href="mailto:${esc(d.contacts.email)}">${esc(d.contacts.email)}</a>
        ${d.footer.social.map(s => `<a href="${esc(s.href)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join('')}
      </div>
    </div>
    <div class="footer__bottom">
      <span class="sm muted">${esc(d.footer.copyright)}</span>
      <a class="sm muted" href="${esc(d.footer.legal.href)}">${esc(d.footer.legal.label)}</a>
    </div>
    <p class="wordmark">${esc(d.footer.wordmark)}</p>
  </div>
</footer>`;

/* ------------------------------------------------------------------ форма + dock */
export const sheet = d => {
  const f = d.calculator.form;
  return `
<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
  <div class="sheet__box">
    <button class="btn btn--ghost btn--sm sheet__close" type="button"><span class="btn__label">Закрыть</span></button>
    <span class="label">Заявка</span>
    <h2 class="h-2 sheet__title" id="sheet-title">${esc(f.title)}</h2>

    <form class="sheet__form" novalidate>
      <input type="hidden" id="form-context" name="context" value="">
      <div class="field">
        <label class="label" for="f-name">Имя</label>
        <input id="f-name" name="name" type="text" required autocomplete="name">
      </div>
      <div class="field">
        <label class="label" for="f-phone">Телефон</label>
        <input id="f-phone" name="phone" type="tel" required autocomplete="tel" placeholder="+7 ___ ___-__-__">
      </div>
      <div class="field">
        <label class="label" for="f-msg">Мессенджер</label>
        <select id="f-msg" name="messenger">
          ${f.fields.find(x => x.id === 'messenger').options.map(o => `<option>${esc(o)}</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <span class="label">План помещения или проект</span>
        <label class="drop">
          <input type="file" name="plan" accept="${esc(f.fields.find(x => x.id === 'plan').accept)}">
          <span class="sm">Перетащите файл или нажмите, чтобы выбрать</span>
          <span class="sm muted drop__name">PDF, JPG, PNG, DWG</span>
        </label>
      </div>
      <button class="btn btn--solid" type="submit"><span class="btn__label">${esc(f.submit)}</span></button>
      <p class="sheet__note">${esc(f.consent)}</p>
    </form>

    <div class="sheet__ok" hidden>
      <h3 class="h-2">Заявка отправлена</h3>
      <p class="lead">Инженер свяжется с вами в течение рабочего дня.</p>
    </div>
  </div>
</div>

<div class="dock">
  <button class="btn btn--solid btn--sm" data-form="Рассчитать стоимость" data-context="dock"><span class="btn__label">Рассчитать</span></button>
  <a class="icon-btn" href="${esc(d.contacts.whatsapp)}" aria-label="WhatsApp">${icon.wa}</a>
  <a class="icon-btn" href="${esc(d.contacts.telegram)}" aria-label="Telegram">${icon.tg}</a>
</div>`;
};
