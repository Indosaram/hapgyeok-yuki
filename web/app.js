(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const main = $("#main");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const ICON = {
    check: '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="m12 3.8 2.5 5.2 5.6.7-4.1 3.9 1 5.6L12 16.5l-5 2.7 1-5.6-4.1-3.9 5.6-.7z"/></svg>',
    arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
    redo: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5"/><path d="M4 4v4.5h4.5"/></svg>',
  };

  // ---------- local progress (no account) ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem("hy." + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("hy." + k, JSON.stringify(v)); } catch { /* private mode: progress just isn't kept */ } },
  };
  const sets = { done: new Set(store.get("done", [])), star: new Set(store.get("star", [])), ino: new Set(store.get("ino", [])) };
  const toggle = (name, key) => { const s = sets[name]; s.has(key) ? s.delete(key) : s.add(key); store.set(name, [...s]); return s.has(key); };
  let covered = store.get("cover", false);

  // ---------- data ----------
  const cache = {};
  const load = (name) => (cache[name] ||= fetch(`data/${name}.json`).then((r) => {
    if (!r.ok) throw new Error(`${name} ${r.status}`);
    return r.json();
  }).catch((e) => { delete cache[name]; throw e; }));
  let IDX;

  const chap = (no) => IDX.organic.find((c) => String(c.no) === String(no));
  const doneIn = (c) => c.problems.filter((p) => sets.done.has(`${c.no}/${p.n}`)).length;
  const totalProblems = () => IDX.organic.reduce((a, c) => a + c.problems.length, 0);
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const bar = (a, b) => `<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${b}" aria-valuenow="${a}"><i style="width:${pct(a, b)}%"></i></div>`;
  const foot = () => `<footer class="foot">『합격화학 연습문제 유기편』 해답은 책의 해답표를 따르며, 해설은 일본 약학부 기준·일본 용어로 작성했습니다. 무기 교재는 직접 만든 일본어 정리본을 한국어로 옮긴 것입니다. 풀이 기록과 별표는 이 기기 브라우저에만 저장됩니다.</footer>`;

  function setNav(key) {
    document.querySelectorAll("[data-nav]").forEach((a) => {
      if (a.dataset.nav === key) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  }
  function page(html, title, nav) {
    main.innerHTML = html;
    document.title = title ? `${title} · 합격화학 스터디` : "합격화학 스터디 · 유기편 해설 & 무기 정리";
    setNav(nav);
  }

  // ---------- views ----------
  function home() {
    const total = totalProblems();
    const done = sets.done.size;
    const last = store.get("last", null);
    const lastC = last && chap(last.split("/")[0]);
    const art = IDX.organic.map((c) => `<a href="#/o/${c.no}" style="--b:${c.band}"><span class="z">${c.no}</span><span class="sym">${esc(c.title.slice(0, 2))}</span><span class="nm">${esc(c.title)}</span></a>`).join("")
      + `<a href="#/i" style="--b:${IDX.band}"><span class="z">無</span><span class="sym">무기</span><span class="nm">무기화학 정리 교재</span></a>`
      + IDX.decks.slice(0, 3).map((d) => `<a href="#/d/${d.id}" style="--b:#f2c94c"><span class="z">${d.count}</span><span class="sym">${esc(d.title.slice(0, 2))}</span><span class="nm">${esc(d.title)} 카드</span></a>`).join("")
      + `<span class="gap" aria-hidden="true"></span><span class="gap" aria-hidden="true"></span><span class="gap" aria-hidden="true"></span>`;
    page(`
      <section class="hero">
        <div>
          <h1>풀고, 덮고, <em>확인</em>합니다.</h1>
          <p>『합격화학 연습문제 유기편』 ${total}문항의 정답과 상세 해설, 그리고 무기화학 정리 노트를 한국어로 옮긴 교재입니다. 용어는 일본 시험 기준 그대로 두었습니다.</p>
          <div class="cta">
            <a class="btn primary" href="#/o">${ICON.arrow}유기 해설 보기</a>
            <a class="btn" href="#/i">무기 교재 읽기</a>
          </div>
          ${last && lastC ? `<p class="resume">마지막으로 본 문항: <a href="#/o/${last}">${lastC.no}장 ${esc(last.split("/")[1])}번 · ${esc(lastC.title)}</a></p>` : ""}
        </div>
        <div class="table-art" aria-label="단원 바로가기">${art}</div>
      </section>
      <div class="stats">
        <div><b>${done} / ${total}</b><span>푼 문항</span>${bar(done, total)}</div>
        <div><b>${sets.star.size}</b><span>별표한 문항</span></div>
        <div><b>${sets.ino.size} / ${IDX.inorganic.length}</b><span>읽은 무기 단원</span>${bar(sets.ino.size, IDX.inorganic.length)}</div>
      </div>
      <h2 class="sec-title">유기편 해설 <small>제31–37장</small><a href="#/o">전체 보기</a></h2>
      ${chapList()}
      <h2 class="sec-title">무기화학 교재 <small>${IDX.inorganic.length}단원</small><a href="#/i">전체 보기</a></h2>
      ${inoGrid()}
      ${foot()}`, "", "home");
  }

  function chapList() {
    return `<ul class="chap-list">${IDX.organic.map((c) => {
      const d = doneIn(c), n = c.problems.length;
      return `<li><a href="#/o/${c.no}" style="--b:${c.band}"><span class="chap-no">${c.no}</span><span><span class="t">${esc(c.title)}</span><br><span class="s">${n}문항</span></span><span class="p">${d}/${n}${bar(d, n)}</span></a></li>`;
    }).join("")}</ul>`;
  }

  function organicIndex() {
    page(`<nav class="crumb" aria-label="위치"><a href="#/">처음</a><span aria-hidden="true">/</span><span>유기편 해설</span></nav>
      <h1 class="page">합격화학 연습문제 유기편 해설</h1>
      <p class="lede">장을 고르면 문항이 주기율표처럼 칸으로 놓입니다. 칸마다 번호, 정답, 문제 요지가 있습니다.</p>
      ${chapList()}${foot()}`, "유기편 해설", "o");
  }

  let filter = "all", compact = store.get("compact", false);
  function chapter(no) {
    const c = chap(no);
    if (!c) return notFound();
    const list = c.problems.filter((p) => {
      const k = `${c.no}/${p.n}`;
      return filter === "all" || (filter === "todo" && !sets.done.has(k)) || (filter === "star" && sets.star.has(k));
    });
    const cells = list.map((p) => {
      const k = `${c.no}/${p.n}`;
      const cls = ["cell", sets.done.has(k) && "done", sets.star.has(k) && "star"].filter(Boolean).join(" ");
      const mark = sets.done.has(k) ? ICON.check : sets.star.has(k) ? `<span class="st">${ICON.star}</span>` : "";
      return `<a class="${cls}" href="#/o/${k}" aria-label="${p.n}번${covered ? "" : `, 정답 ${p.a}`}. ${esc(p.g)}"><span class="z">${p.n}${mark}</span><span class="ans">${esc(p.a)}</span><span class="g">${esc(p.g)}</span></a>`;
    }).join("");
    const d = doneIn(c);
    page(`<nav class="crumb" aria-label="위치"><a href="#/">처음</a><span aria-hidden="true">/</span><a href="#/o">유기편 해설</a><span aria-hidden="true">/</span><span>제${c.no}장</span></nav>
      <div class="chap-head" style="--b:${c.band}">
        <div><h1 class="page"><span class="chap-band" aria-hidden="true"></span>제${c.no}장 ${esc(c.title)}</h1><p class="lede" style="margin:0">${c.problems.length}문항 중 ${d}문항 풀었음</p></div>
        <div class="toolbar">
          <div class="seg" role="group" aria-label="보기 필터">
            <button data-f="all" aria-pressed="${filter === "all"}">전체</button>
            <button data-f="todo" aria-pressed="${filter === "todo"}">안 푼 것</button>
            <button data-f="star" aria-pressed="${filter === "star"}">별표</button>
          </div>
          <div class="seg" role="group" aria-label="칸 크기">
            <button data-v="0" aria-pressed="${!compact}">요지</button>
            <button data-v="1" aria-pressed="${compact}">정답만</button>
          </div>
          <button class="sheet-toggle" aria-pressed="${covered}" title="정답을 붉은 시트로 가립니다 (단축키 R)"><i></i>赤シート</button>
        </div>
      </div>
      <div class="legend"><span><i class="d"></i>푼 문항</span><span><i class="s"></i>별표</span>${covered ? "<span>赤シート가 켜져 있습니다. 마우스를 올리면 정답이 잠깐 보이고, 해설 화면에서는 정답 칸을 눌러 확인합니다.</span>" : ""}</div>
      ${cells ? `<div class="wall${compact ? " compact" : ""}${covered ? " covered" : ""}" style="--b:${c.band}">${cells}</div>`
        : `<div class="empty">${filter === "star" ? "아직 별표한 문항이 없습니다. 해설 화면에서 ☆ 버튼으로 표시해 두세요." : "이 장의 문항을 모두 풀었습니다."}</div>`}
      ${foot()}`, `제${c.no}장 ${c.title}`, "o");
    main.querySelectorAll("[data-f]").forEach((b) => b.addEventListener("click", () => { filter = b.dataset.f; chapter(no); }));
    main.querySelectorAll("[data-v]").forEach((b) => b.addEventListener("click", () => { compact = b.dataset.v === "1"; store.set("compact", compact); chapter(no); }));
    $(".sheet-toggle", main).addEventListener("click", () => { covered = !covered; store.set("cover", covered); chapter(no); });
    const wall = $(".wall", main);
    if (wall) {
      const on = (e) => { const c = e.target.closest(".cell"); if (c) c.classList.add("peek"); };
      const off = (e) => { const c = e.target.closest(".cell"); if (c) c.classList.remove("peek"); };
      wall.addEventListener("pointerover", on); wall.addEventListener("pointerout", off);
      wall.addEventListener("contextmenu", (e) => { if (e.target.closest(".cell") && covered) e.preventDefault(); });
    }
  }

  async function problem(no, n) {
    const c = chap(no);
    if (!c) return notFound();
    const i = c.problems.findIndex((p) => p.n === n);
    if (i < 0) return notFound();
    const p = c.problems[i];
    const k = `${c.no}/${p.n}`;
    store.set("last", k);
    main.innerHTML = '<div class="loading" role="status">해설을 불러오는 중…</div>';
    let body;
    try { body = (await load("o" + c.no))[p.n]; } catch (e) { return loadError(e); }
    if (location.hash !== `#/o/${k}`) return;
    const prev = c.problems[i - 1], next = c.problems[i + 1];
    const ci = IDX.organic.indexOf(c), nextC = !next && IDX.organic[ci + 1], prevC = !prev && IDX.organic[ci - 1];
    const prevHref = prev ? `#/o/${c.no}/${prev.n}` : prevC ? `#/o/${prevC.no}/${prevC.problems.at(-1).n}` : "";
    const nextHref = next ? `#/o/${c.no}/${next.n}` : nextC ? `#/o/${nextC.no}/${nextC.problems[0].n}` : "";
    const mini = c.problems.map((q) => `<a href="#/o/${c.no}/${q.n}" class="${sets.done.has(`${c.no}/${q.n}`) ? "done" : ""}"${q.n === p.n ? ' aria-current="page"' : ""}>${q.n}</a>`).join("");
    page(`<nav class="crumb" aria-label="위치"><a href="#/">처음</a><span aria-hidden="true">/</span><a href="#/o">유기편 해설</a><span aria-hidden="true">/</span><a href="#/o/${c.no}">제${c.no}장 ${esc(c.title)}</a></nav>
      <div class="prob" style="--b:${c.band}">
        <article>
          <div class="prob-head">
            <div class="big-cell${covered ? " covered" : ""}"><span class="z">${c.no}–${p.n}</span><span class="ans" ${covered ? 'role="button" tabindex="0" aria-label="정답 보기"' : ""}>${esc(p.a)}</span><span class="cap">정답</span></div>
            <div class="meta"><h1>${Number(p.n)}번 문제</h1><span class="chap">제${c.no}장 ${esc(c.title)}</span></div>
          </div>
          <div class="actions">
            <button class="chip" data-t="done" aria-pressed="${sets.done.has(k)}">${ICON.check}<span>${sets.done.has(k) ? "풀었음" : "풀었음 표시"}</span></button>
            <button class="chip star" data-t="star" aria-pressed="${sets.star.has(k)}">${ICON.star}<span>${sets.star.has(k) ? "별표됨" : "별표"}</span></button>
          </div>
          <div class="prose">${body}</div>
          <nav class="pager" aria-label="이전·다음 문항">
            ${prevHref ? `<a href="${prevHref}"><small>이전 문항</small><b>${prev ? `${prev.n}번 · 정답 ${esc(prev.a)}` : `제${prevC.no}장 마지막 문항`}</b></a>` : '<span class="spacer"></span>'}
            ${nextHref ? `<a class="next" href="${nextHref}"><small>다음 문항</small><b>${next ? `${next.n}번` : `제${nextC.no}장 ${esc(nextC.title)}`}</b></a>` : '<span class="spacer"></span>'}
          </nav>
        </article>
        <aside class="aside" aria-label="이 장의 문항">
          <h4>제${c.no}장 문항</h4><div class="mini">${mini}</div>
          <p class="keys"><kbd>←</kbd> <kbd>→</kbd> 이전·다음 문항<br><kbd>D</kbd> 풀었음 <kbd>S</kbd> 별표 <kbd>R</kbd> 赤シート</p>
        </aside>
      </div>${foot()}`, `${c.no}장 ${p.n}번`, "o");
    main.querySelectorAll("[data-t]").forEach((b) => b.addEventListener("click", () => {
      const on = toggle(b.dataset.t, k);
      b.setAttribute("aria-pressed", on);
      $("span", b).textContent = b.dataset.t === "done" ? (on ? "풀었음" : "풀었음 표시") : (on ? "별표됨" : "별표");
      const m = main.querySelector(`.mini a[aria-current]`);
      if (b.dataset.t === "done" && m) m.classList.toggle("done", on);
    }));
    const big = $(".big-cell", main), ans = $(".ans", big);
    const reveal = () => big.classList.remove("covered");
    ans.addEventListener("click", reveal);
    ans.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); reveal(); } });
    keyNav = { prev: prevHref, next: nextHref };
    window.scrollTo(0, 0);
  }

  function inoGrid() {
    return `<div class="ino-grid">${IDX.inorganic.map((s) => `<a href="#/i/${s.id}" class="${sets.ino.has(s.id) ? "done" : ""}"><span class="n">${s.no}</span><b>${esc(s.title)}</b><span>${esc(s.lead)}</span></a>`).join("")}</div>`;
  }
  function inorganicIndex() {
    page(`<nav class="crumb" aria-label="위치"><a href="#/">처음</a><span aria-hidden="true">/</span><span>무기 교재</span></nav>
      <h1 class="page">무기화학 정리 교재</h1>
      <p class="lede">일본어 정리 노트(18쪽)와 「気体の実験的製法」「色」 표를 한국어로 옮겼습니다. 용어는 일본어 원어를 함께 적었고, 원본의 오타는 따로 표시했습니다.</p>
      ${inoGrid()}
      <p class="src-note">외울 표는 <a href="#/d">암기 카드</a>로 바로 연습할 수 있습니다.</p>${foot()}`, "무기 교재", "i");
  }
  async function inorganic(id) {
    const s = IDX.inorganic.find((x) => x.id === id);
    if (!s) return notFound();
    main.innerHTML = '<div class="loading" role="status">불러오는 중…</div>';
    let data;
    try { data = await load("inorg"); } catch (e) { return loadError(e); }
    if (location.hash !== `#/i/${id}`) return;
    const i = IDX.inorganic.indexOf(s), prev = IDX.inorganic[i - 1], next = IDX.inorganic[i + 1];
    sets.ino.add(id); store.set("ino", [...sets.ino]);
    const deck = { color: "color", gas: "gas" }[id];
    page(`<nav class="crumb" aria-label="위치"><a href="#/">처음</a><span aria-hidden="true">/</span><a href="#/i">무기 교재</a><span aria-hidden="true">/</span><span>${s.no}. ${esc(s.title)}</span></nav>
      <div class="ino-page">
        <nav class="toc" aria-label="단원 목차"><h4>단원</h4><ol>${IDX.inorganic.map((x) => `<li><a href="#/i/${x.id}"${x.id === id ? ' aria-current="page"' : ""}><i>${x.no}</i>${esc(x.title)}</a></li>`).join("")}</ol></nav>
        <article>
          <h1 class="page">${s.no}. ${esc(s.title)}</h1>
          ${deck ? `<div class="actions"><a class="chip" href="#/d/${deck}">${ICON.redo}<span>이 단원 암기 카드로 연습</span></a>${id === "gas" ? `<a class="chip" href="#/d/trap">${ICON.redo}<span>단골 함정 20</span></a>` : `<a class="chip" href="#/d/flame">${ICON.redo}<span>불꽃반응 카드</span></a>`}</div>` : ""}
          <div class="prose">${data[id]}</div>
          <nav class="pager" aria-label="이전·다음 단원">
            ${prev ? `<a href="#/i/${prev.id}"><small>이전 단원</small><b>${prev.no}. ${esc(prev.title)}</b></a>` : '<span class="spacer"></span>'}
            ${next ? `<a class="next" href="#/i/${next.id}"><small>다음 단원</small><b>${next.no}. ${esc(next.title)}</b></a>` : '<span class="spacer"></span>'}
          </nav>
        </article>
      </div>${foot()}`, s.title, "i");
    keyNav = { prev: prev ? `#/i/${prev.id}` : "", next: next ? `#/i/${next.id}` : "" };
    window.scrollTo(0, 0);
  }

  async function deckIndex() {
    let D;
    try { D = await load("decks"); } catch (e) { return loadError(e); }
    const best = store.get("best", {});
    page(`<nav class="crumb" aria-label="위치"><a href="#/">처음</a><span aria-hidden="true">/</span><span>암기 카드</span></nav>
      <h1 class="page">암기 카드</h1>
      <p class="lede">문제를 보고 답을 떠올린 뒤 붉은 시트를 눌러 확인합니다. 맞혔는지 스스로 고르면, 틀린 카드만 모아 다시 돌릴 수 있습니다.</p>
      <div class="deck-list">${Object.entries(D).map(([id, d]) => `<a href="#/d/${id}"><b>${esc(d.title)}</b><span>${d.cards.length}장${best[id] != null ? ` · 최고 ${best[id]}%` : ""}</span>${d.cards[0].sw ? `<span class="sw" aria-hidden="true">${[...new Set(d.cards.map((x) => x.sw))].slice(0, 10).map((c) => `<i style="background:${c}"></i>`).join("")}</span>` : ""}</a>`).join("")}</div>
      ${foot()}`, "암기 카드", "d");
  }

  let session = null;
  async function deck(id, retry) {
    let D;
    try { D = await load("decks"); } catch (e) { return loadError(e); }
    const d = D[id];
    if (!d) return notFound();
    if (!session || session.id !== id || retry) {
      const pool = retry && session ? session.miss.map((i) => d.cards.indexOf(i)) : d.cards.map((_, i) => i);
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      session = { id, order: pool, at: 0, ok: 0, miss: [], shown: false };
    }
    drawCard(d);
  }
  function drawCard(d) {
    const s = session, n = s.order.length;
    const head = `<nav class="crumb" aria-label="위치"><a href="#/">처음</a><span aria-hidden="true">/</span><a href="#/d">암기 카드</a><span aria-hidden="true">/</span><span>${esc(d.title)}</span></nav>`;
    if (s.at >= n) {
      const score = pct(s.ok, n), best = store.get("best", {});
      if (n === d.cards.length && (best[s.id] == null || score > best[s.id])) { best[s.id] = score; store.set("best", best); }
      page(`${head}<div class="study"><div class="result"><b>${s.ok} / ${n}</b><p>${score === 100 ? "전부 맞혔습니다." : `${n - s.ok}장을 다시 볼 필요가 있습니다.`}</p>
        <div class="cta">${s.miss.length ? `<button class="btn primary" data-a="retry">${ICON.redo}틀린 ${s.miss.length}장만 다시</button>` : ""}<button class="btn" data-a="all">처음부터 다시</button><a class="btn" href="#/d">카드 목록</a></div>
        ${s.miss.length ? `<ul class="miss">${s.miss.map((c) => `<li><b>${esc(c.q)}</b> → ${esc(c.a)}${c.s ? ` <span style="color:var(--ink3)">(${esc(c.s)})</span>` : ""}</li>`).join("")}</ul>` : ""}
      </div></div>`, d.title, "d");
      main.querySelector('[data-a="retry"]')?.addEventListener("click", () => deck(s.id, true));
      main.querySelector('[data-a="all"]').addEventListener("click", () => { session = null; deck(s.id); });
      return;
    }
    const c = d.cards[s.order[s.at]];
    page(`${head}<div class="study">
      <div class="study-top"><span>${s.at + 1} / ${n}</span>${bar(s.at, n)}<span>맞힘 ${s.ok}</span></div>
      <div class="flash${s.shown ? " revealed" : ""}" role="button" tabindex="0" aria-label="${s.shown ? "답이 보입니다" : "눌러서 답 보기"}">
        <span class="hint">${esc(d.hint)}</span>
        <div class="q${c.q.length > 14 ? " long" : ""}">${esc(c.q)}</div>
        <div class="a" aria-live="polite">${s.shown
          ? `<span class="val">${c.sw ? `<i style="background:${c.sw}"></i>` : ""}${esc(c.a)}</span>${c.s ? `<span class="sub">${esc(c.s)}</span>` : ""}${c.n ? `<span class="note">반응원리: ${esc(c.n)}</span>` : ""}`
          : `<span class="cover">赤シート · 눌러서 확인</span>`}</div>
      </div>
      ${s.shown ? `<div class="grade"><button class="btn no" data-g="0">틀렸어요 <kbd>2</kbd></button><button class="btn ok" data-g="1">맞혔어요 <kbd>1</kbd></button></div>` : `<div class="grade"><button class="btn primary" data-a="show" style="grid-column:span 2">답 보기 <kbd>Space</kbd></button></div>`}
    </div>`, d.title, "d");
    const show = () => { if (!s.shown) { s.shown = true; drawCard(d); main.querySelector('[data-g="1"]')?.focus(); } };
    $(".flash", main).addEventListener("click", show);
    main.querySelector('[data-a="show"]')?.addEventListener("click", show);
    main.querySelectorAll("[data-g]").forEach((b) => b.addEventListener("click", () => grade(d, b.dataset.g === "1")));
    cardKeys = { show, grade: (ok) => s.shown && grade(d, ok) };
  }
  function grade(d, ok) {
    const s = session, c = d.cards[s.order[s.at]];
    if (ok) s.ok++; else s.miss.push(c);
    s.at++; s.shown = false; drawCard(d);
  }

  let searchData = null, searchTimer = 0;
  async function search(q0) {
    page(`<nav class="crumb" aria-label="위치"><a href="#/">처음</a><span aria-hidden="true">/</span><span>검색</span></nav>
      <h1 class="page">검색</h1>
      <div class="search-box">${ICON.search}<input type="search" placeholder="예: 비대칭탄소, 은거울반응, 33장 20번" value="${esc(q0)}" aria-label="해설과 교재 검색" autocomplete="off" enterkeyhint="search"></div>
      <div class="search-tips">${["비대칭탄소", "은거울반응", "요오드포름", "펩티드", "건조제", "착이온"].map((t) => `<button type="button">${t}</button>`).join("")}</div>
      <div id="hits" style="margin-top:18px"></div>${foot()}`, "검색", "search");
    const input = $("input", main), out = $("#hits", main);
    main.querySelectorAll(".search-tips button").forEach((b) => b.addEventListener("click", () => { input.value = b.textContent; run(); }));
    const run = async () => {
      const q = input.value.trim();
      history.replaceState(null, "", "#/search" + (q ? "?q=" + encodeURIComponent(q) : ""));
      if (!q) { out.innerHTML = ""; return; }
      if (!searchData) {
        out.innerHTML = '<p class="count">검색 색인을 불러오는 중…</p>';
        try { searchData = await load("search"); } catch (e) { out.innerHTML = `<div class="err"><p>검색 색인을 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 다시 입력해 주세요.</p></div>`; return; }
      }
      const m = q.match(/^(3[1-7])\s*장?\s*(\d{1,2})\s*번?$/);
      if (m) { location.hash = `#/o/${m[1]}/${m[2].padStart(2, "0")}`; return; }
      const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
      const hits = [];
      for (const r of searchData) {
        const low = r.x.toLowerCase();
        if (!terms.every((t) => low.includes(t) || r.t.toLowerCase().includes(t))) continue;
        const pos = low.indexOf(terms[0]);
        const st = Math.max(0, pos - 40);
        let snip = (st ? "…" : "") + r.x.slice(st, st + 130) + "…";
        snip = esc(snip);
        for (const t of terms) snip = snip.replace(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), (x) => `<mark>${x}</mark>`);
        hits.push(`<li><a href="#/${r.k}"><b>${esc(r.t)}</b><span class="s">${esc(r.s)}</span><p>${snip}</p></a></li>`);
        if (hits.length >= 80) break;
      }
      out.innerHTML = hits.length
        ? `<p class="count">${hits.length >= 80 ? "80건 이상 · 앞의 80건만 보여 줍니다" : `${hits.length}건`}</p><ul class="hits">${hits.join("")}</ul>`
        : `<div class="empty">「${esc(q)}」가 들어간 해설이 없습니다. 일본식 용어(예: 삭산, 안식향산)나 더 짧은 낱말로 찾아보세요.</div>`;
    };
    input.addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(run, 160); });
    input.focus();
    if (q0) run();
  }

  function notFound() {
    page(`<div class="err"><h1 class="page">찾는 페이지가 없습니다</h1><p>주소가 바뀌었거나 없는 문항입니다.</p><a class="btn primary" href="#/">처음으로</a></div>`, "없는 페이지", "");
  }
  function loadError(e) {
    console.error(e);
    page(`<div class="err"><h1 class="page">내용을 불러오지 못했습니다</h1><p>인터넷 연결을 확인한 뒤 다시 시도해 주세요.</p><button class="btn primary" onclick="location.reload()">다시 시도</button></div>`, "오류", "");
  }

  // ---------- router & keys ----------
  let keyNav = null, cardKeys = null;
  function route() {
    keyNav = null; cardKeys = null;
    const h = location.hash.replace(/^#\/?/, "");
    const [path, qs] = h.split("?");
    const seg = path.split("/").filter(Boolean);
    switch (seg[0]) {
      case undefined: return home();
      case "o": return seg[2] ? problem(seg[1], seg[2]) : seg[1] ? chapter(seg[1]) : organicIndex();
      case "i": return seg[1] ? inorganic(seg[1]) : inorganicIndex();
      case "d": return seg[1] ? deck(seg[1]) : deckIndex();
      case "search": return search(new URLSearchParams(qs || "").get("q") || "");
      default: return notFound();
    }
  }
  let lastPath = "";
  window.addEventListener("hashchange", () => {
    const p = location.hash.split("?")[0];
    if (p === lastPath && p === "#/search") return;
    lastPath = p;
    route();
    if (!/^#\/o\/\d+\/\d+|^#\/i\//.test(p)) { window.scrollTo(0, 0); main.focus({ preventScroll: true }); }
  });
  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || /input|textarea|select/i.test(e.target.tagName)) return;
    if (cardKeys) {
      if (e.key === " " || e.key === "Enter") { if (e.target.closest("button,a")) return; e.preventDefault(); cardKeys.show(); }
      else if (e.key === "1") cardKeys.grade(true);
      else if (e.key === "2") cardKeys.grade(false);
      return;
    }
    if (keyNav && e.key === "ArrowLeft" && keyNav.prev) location.hash = keyNav.prev;
    else if (keyNav && e.key === "ArrowRight" && keyNav.next) location.hash = keyNav.next;
    else if (e.key === "d" || e.key === "s") main.querySelector(`[data-t="${e.key === "d" ? "done" : "star"}"]`)?.click();
    else if (e.key === "r") {
      const t = main.querySelector(".sheet-toggle");
      if (t) t.click();
      else if (main.querySelector(".big-cell")) { covered = !covered; store.set("cover", covered); main.querySelector(".big-cell").classList.toggle("covered", covered); }
    } else if (e.key === "/") { e.preventDefault(); location.hash = "#/search"; }
  });

  load("index").then((d) => { IDX = d; lastPath = location.hash.split("?")[0]; route(); }).catch(loadError);
})();
