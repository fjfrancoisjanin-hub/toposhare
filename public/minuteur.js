// Minuteur de poutre (Tabata, répéteurs…) : effort, repos, répétitions, séries.
// Chargé à la demande par index.html (premier clic sur « Minuteur poutre ») : rien ici ne pèse sur le reste de l'appli.
// Tous les textes visibles sont en français et passent par i18n.js (traduction à la volée des nœuds de texte).
// Le temps vient de l'horloge (performance.now), pas du nombre de ticks : un onglet ralenti ne fait pas dériver la séance.
(function () {
  const KEY = "ts-timer", KEY_SOUND = "ts-timer-sound";
  const PREP = 5;                                                   // compte à rebours avant le premier effort (s)
  const DEFAULTS = { effort: 7, rest: 3, reps: 6, sets: 3, setRest: 180 };   // répéteurs 7 s / 3 s × 6, 3 séries
  const FIELDS = [
    { k: "effort", label: "Effort", unit: "s", min: 1, max: 600, step: 1, group: 0 },
    { k: "rest", label: "Repos", unit: "s", min: 0, max: 600, step: 1, group: 0 },
    { k: "reps", label: "Répétitions", unit: "", min: 1, max: 99, step: 1, group: 0 },
    { k: "sets", label: "Séries", unit: "", min: 1, max: 99, step: 1, group: 1 },
    { k: "setRest", label: "Repos entre séries", unit: "s", min: 0, max: 1800, step: 5, group: 1 },
  ];
  const PHASE_LABEL = { prep: "Préparation", effort: "Effort", rest: "Repos", setrest: "Repos entre séries", done: "Séance terminée" };

  const CSS = `
.tm { display: grid; gap: 14px; padding-bottom: 24px; }
.tm .plhead { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.tm .plhead h1 { margin: 0; font-size: 22px; }
.tm-hint { margin: 0; color: var(--muted); font-size: 14px; }
.tm-card { display: grid; gap: 2px; background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 10px 14px 6px; }
.tm-card > .label { padding: 4px 0 2px; }
.tm-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 0; border-top: 1px solid var(--line); }
.tm-card > .label + .tm-row { border-top: 0; }
.tm-row label { font-weight: 700; font-size: 16px; min-width: 0; }
.tm-step { display: flex; align-items: center; gap: 6px; flex: none; }
.tm-step button { appearance: none; width: 44px; height: 44px; border-radius: 12px; border: 1px solid var(--line); background: var(--bg); color: var(--fg); font: 700 22px var(--f-body); cursor: pointer; touch-action: manipulation; }
.tm-step button:active { background: var(--accent); color: var(--accent-ink); border-color: var(--accent); }
.tm-step input { width: 62px; height: 44px; text-align: center; border: 1px solid var(--line); border-radius: 12px; background: var(--bg); color: var(--fg); font: 800 20px var(--f-body); padding: 0; }
.tm-step .u { width: 14px; color: var(--muted); font-size: 14px; }
.tm-total { display: flex; justify-content: space-between; align-items: baseline; padding: 2px 4px; color: var(--muted); font-size: 15px; }
.tm-total b { color: var(--fg); font-size: 20px; }
.tm-go { font-size: 20px; padding: 16px 18px; }
.tm-sound { justify-self: start; }
.tm-run { position: fixed; inset: 0; z-index: 60; display: grid; grid-template-rows: auto 1fr auto; padding: max(14px, env(safe-area-inset-top, 0px)) 16px max(16px, env(safe-area-inset-bottom, 0px)); color: #fff; background: #3D4650; text-align: center; }
.tm-run[hidden] { display: none; }
.tm-run[data-phase="effort"] { background: #D8430F; }
.tm-run[data-phase="rest"] { background: #1F7A5A; }
.tm-run[data-phase="setrest"] { background: #2B5FA8; }
.tm-run[data-phase="done"] { background: #1F7A5A; }
.tm-run .top { display: flex; justify-content: space-between; align-items: center; min-height: 44px; font-size: 18px; font-weight: 700; }
.tm-run .mid { display: grid; align-content: center; justify-items: center; gap: 6px; }
.tm-phase { font: 800 clamp(30px, 10vw, 52px) var(--f-display, var(--f-body)); letter-spacing: .02em; text-transform: uppercase; }
.tm-digits { font: 800 clamp(110px, 44vw, 210px)/1 var(--f-display, var(--f-body)); font-variant-numeric: tabular-nums; }
.tm-run[data-phase="done"] .tm-digits { font-size: clamp(60px, 22vw, 110px); }
.tm-pos { font-size: 18px; opacity: .95; }
.tm-next { font-size: 15px; opacity: .8; min-height: 1.3em; }
.tm-run .bottom { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.tm-run .bottom button { appearance: none; border: 2px solid rgba(255,255,255,.85); background: transparent; color: #fff; border-radius: 14px; padding: 16px 10px; font: 800 18px var(--f-body); cursor: pointer; }
.tm-run .bottom button.main { background: #fff; color: #1B2024; }
.tm-run .snd { appearance: none; border: 0; background: rgba(255,255,255,.18); color: #fff; width: 44px; height: 44px; border-radius: 999px; font-size: 20px; cursor: pointer; }
`;

  const clamp = (v, f) => Math.min(f.max, Math.max(f.min, v));
  const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  function loadSettings() {
    let s = {};
    try { s = JSON.parse(lsGet(KEY, "{}")) || {}; } catch {}
    const out = {};
    for (const f of FIELDS) { const n = Math.round(Number(s[f.k])); out[f.k] = Number.isFinite(n) && s[f.k] != null ? clamp(n, f) : DEFAULTS[f.k]; }
    return out;
  }
  const fmt = sec => sec >= 60 ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}` : String(sec);
  const fmtLong = sec => { const m = Math.floor(sec / 60), s = sec % 60; return m ? (s ? `${m} min ${s} s` : `${m} min`) : `${s} s`; };

  // Les phases de la séance, dans l'ordre. Pas de repos après le dernier effort d'une série (il est remplacé par le repos entre séries).
  function build(s) {
    const ph = [{ kind: "prep", dur: PREP, set: 1, rep: 1 }];
    for (let set = 1; set <= s.sets; set++) {
      for (let rep = 1; rep <= s.reps; rep++) {
        ph.push({ kind: "effort", dur: s.effort, set, rep });
        if (rep < s.reps && s.rest > 0) ph.push({ kind: "rest", dur: s.rest, set, rep });
      }
      if (set < s.sets && s.setRest > 0) ph.push({ kind: "setrest", dur: s.setRest, set, rep: s.reps });
    }
    return ph;
  }
  const totalSeconds = s => build(s).filter(p => p.kind !== "prep").reduce((a, p) => a + p.dur, 0);

  let root = null, hooks = {}, settings = loadSettings(), sound = lsGet(KEY_SOUND, "1") !== "0";
  let ctx = null, wake = null;
  let run = null;        // { phases, i, start, pausedAt, lastShown, done }
  let timer = 0;
  const api = { beeps: 0, mount, leave, stop: leave };

  // ---------- sons : trois cues distincts, sans fichier audio ----------
  function tone(freq, dur, when = 0, vol = 0.28) {
    if (!sound || !ctx) return;
    try {
      const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + dur + 0.03);
      api.beeps++;
    } catch {}
  }
  const buzz = p => { try { if (sound && navigator.vibrate) navigator.vibrate(p); } catch {} };
  const cue = {
    effort() { tone(988, 0.5); buzz(220); },                                           // aigu et long : on y va
    rest() { tone(523, 0.18); tone(392, 0.28, 0.2); buzz([70, 60, 70]); },             // descendant : on relâche
    setrest() { tone(392, 0.18); tone(330, 0.18, 0.22); tone(262, 0.4, 0.44); buzz([120, 80, 120]); },
    tick() { tone(660, 0.1, 0, 0.2); },                                                // 3, 2, 1
    done() { [523, 659, 784, 1047].forEach((f, n) => tone(f, 0.28, n * 0.18)); buzz([200, 100, 200, 100, 400]); },
  };

  // ---------- écran toujours allumé pendant la séance ----------
  async function lockScreen() { try { if (navigator.wakeLock && !wake) { wake = await navigator.wakeLock.request("screen"); wake.addEventListener?.("release", () => { wake = null; }); } } catch { wake = null; } }
  function unlockScreen() { try { wake?.release?.(); } catch {} wake = null; }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && run && !run.pausedAt && !run.done) lockScreen(); });

  // ---------- réglages ----------
  function renderSetup() {
    const group = g => FIELDS.filter(f => f.group === g).map(f => `<div class="tm-row"><label for="tm-${f.k}">${f.label}</label>
      <div class="tm-step"><button type="button" data-k="${f.k}" data-d="-1" aria-label="Moins">−</button><input id="tm-${f.k}" data-k="${f.k}" inputmode="numeric" pattern="[0-9]*" autocomplete="off" value="${settings[f.k]}"><span class="u" aria-hidden="true">${f.unit}</span><button type="button" data-k="${f.k}" data-d="1" aria-label="Plus">＋</button></div></div>`).join("");
    root.innerHTML = `<div class="tm" id="tmSetup">
      <div class="plhead"><button class="btn ghost small" type="button" data-tm-home>← Accueil</button><h1>Minuteur poutre</h1></div>
      <p class="tm-hint">Réglez, puis lancez. L'écran reste allumé pendant la séance.</p>
      <div class="tm-card"><div class="label">Une série</div>${group(0)}</div>
      <div class="tm-card"><div class="label">Plusieurs séries</div>${group(1)}</div>
      <div class="tm-total"><span>Durée totale</span><b id="tmTotal"></b></div>
      <button class="btn tm-go" type="button" id="tmGo">Lancer</button>
    </div>
    <div class="tm-run" id="tmRun" hidden aria-live="off">
      <div class="top"><span class="tm-pos" id="tmPos"></span><button class="snd" type="button" id="tmSnd"></button></div>
      <div class="mid"><div class="tm-phase" id="tmPhase" aria-live="polite"></div><div class="tm-digits" id="tmDigits" role="timer"></div><div class="tm-next" id="tmNext"></div></div>
      <div class="bottom"><button type="button" id="tmStop">Arrêter</button><button type="button" class="main" id="tmPause">Pause</button></div>
    </div>`;
    paintTotal(); paintSound();
  }
  function paintTotal() { const el = root.querySelector("#tmTotal"); if (el) el.textContent = fmtLong(totalSeconds(settings)); }
  function paintSound() {
    const b = root.querySelector("#tmSnd"); if (!b) return;
    b.textContent = sound ? "🔔" : "🔕"; b.setAttribute("aria-label", sound ? "Son activé" : "Son coupé"); b.setAttribute("aria-pressed", String(sound));
  }
  function setField(k, v, input) {
    const f = FIELDS.find(x => x.k === k); if (!f || !Number.isFinite(v)) return;
    settings[k] = clamp(Math.round(v), f);
    lsSet(KEY, JSON.stringify(settings));
    if (input) input.value = settings[k];
    paintTotal();
  }

  // Appui long sur − / ＋ : répétition accélérée (utile pour 180 s). Un clic clavier (detail 0) fait un pas.
  let holdT = 0, holdI = 0;
  function stopHold() { clearTimeout(holdT); clearInterval(holdI); holdT = holdI = 0; }
  function bump(btn) {
    const f = FIELDS.find(x => x.k === btn.dataset.k), inp = root.querySelector(`#tm-${f.k}`);
    setField(f.k, settings[f.k] + Number(btn.dataset.d) * f.step, inp);
  }

  // ---------- séance ----------
  function showRun(on) { root.querySelector("#tmRun").hidden = !on; root.querySelector("#tmSetup").hidden = on; }
  function start() {
    try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); ctx.resume?.(); } catch { ctx = null; }
    run = { phases: build(settings), i: 0, start: performance.now(), pausedAt: 0, lastShown: null, done: false };
    showRun(true); lockScreen(); paint(true);
    clearInterval(timer); timer = setInterval(tick, 100);
  }
  function stopRun(back = true) {
    clearInterval(timer); timer = 0; run = null; unlockScreen();
    if (root && back) { showRun(false); }
  }
  function leave() { stopHold(); stopRun(false); }

  function tick() {
    if (!run || run.pausedAt || run.done) return;
    let now = performance.now(), changed = false;
    while (!run.done && now - run.start >= run.phases[run.i].dur * 1000) {
      run.start += run.phases[run.i].dur * 1000;     // le surplus est reporté : pas de dérive
      run.i++; changed = true; run.lastShown = null;
      if (run.i >= run.phases.length) { run.done = true; break; }
      cue[run.phases[run.i].kind === "prep" ? "tick" : run.phases[run.i].kind]();
    }
    if (run.done) { clearInterval(timer); timer = 0; unlockScreen(); cue.done(); paint(true); return; }
    const p = run.phases[run.i], left = Math.max(0, Math.ceil(p.dur - (now - run.start) / 1000));
    if (left !== run.lastShown) {
      if (!changed && left > 0 && left <= 3 && left < p.dur) cue.tick();
      run.lastShown = left;
    }
    paint(changed);
  }

  function paint(full) {
    const q = id => root.querySelector(id), r = q("#tmRun");
    if (!run) return;
    if (run.done) {
      r.dataset.phase = "done";
      q("#tmPhase").textContent = PHASE_LABEL.done; q("#tmDigits").textContent = fmtLong(totalSeconds(settings));
      q("#tmPos").textContent = ""; q("#tmNext").textContent = "";
      q("#tmStop").textContent = "Réglages"; q("#tmPause").textContent = "Recommencer";
      return;
    }
    const p = run.phases[run.i], now = run.pausedAt || performance.now(), left = Math.max(0, Math.ceil(p.dur - (now - run.start) / 1000));
    q("#tmDigits").textContent = fmt(left);
    if (full || r.dataset.phase !== p.kind) {
      r.dataset.phase = p.kind;
      q("#tmPhase").textContent = PHASE_LABEL[p.kind];
      const pos = q("#tmPos");
      pos.innerHTML = p.kind === "prep" ? "" : `<span>Série</span> <b>${p.set}</b> / ${settings.sets} · <span>Répétition</span> <b>${p.rep}</b> / ${settings.reps}`;
      const nx = run.phases[run.i + 1];
      q("#tmNext").innerHTML = nx ? `<span>Ensuite</span> : <span>${PHASE_LABEL[nx.kind]}</span> ${fmtLong(nx.dur)}` : "";
      q("#tmStop").textContent = "Arrêter"; q("#tmPause").textContent = run.pausedAt ? "Reprendre" : "Pause";
      r.dataset.set = p.set; r.dataset.rep = p.rep;
    }
    r.dataset.paused = run.pausedAt ? "1" : "";
  }
  function togglePause() {
    if (!run) return;
    if (run.done) { stopRun(false); start(); return; }          // Recommencer
    if (run.pausedAt) { run.start += performance.now() - run.pausedAt; run.pausedAt = 0; lockScreen(); }
    else { run.pausedAt = performance.now(); }
    root.querySelector("#tmPause").textContent = run.pausedAt ? "Reprendre" : "Pause";
    paint(false);
  }

  // ---------- montage ----------
  function onClick(e) {
    const t = e.target.closest("button"); if (!t || !root.contains(t)) return;
    if (t.matches("[data-tm-home]")) { leave(); hooks.onHome?.(); }
    else if (t.id === "tmGo") start();
    else if (t.id === "tmStop") { if (run) { stopRun(true); } }
    else if (t.id === "tmPause") togglePause();
    else if (t.id === "tmSnd") { sound = !sound; lsSet(KEY_SOUND, sound ? "1" : "0"); paintSound(); if (sound) cue.tick(); }
    else if (t.dataset.d && e.detail === 0) bump(t);                  // clavier ; la souris et le doigt passent par pointerdown
  }
  function onPointerDown(e) {
    const t = e.target.closest("button[data-d]"); if (!t || !root.contains(t)) return;
    bump(t); stopHold();
    holdT = setTimeout(() => { holdI = setInterval(() => bump(t), 90); }, 420);
  }
  function onInput(e) {
    const i = e.target.closest("input[data-k]"); if (!i) return;
    const digits = i.value.replace(/\D/g, "");
    if (digits !== i.value) i.value = digits;
    if (digits !== "") setField(i.dataset.k, Number(digits), null);
  }
  function onChange(e) { const i = e.target.closest("input[data-k]"); if (i) { setField(i.dataset.k, i.value === "" ? settings[i.dataset.k] : Number(i.value), i); } }

  function mount(el, h = {}) {
    if (!document.getElementById("tmStyle")) { const s = document.createElement("style"); s.id = "tmStyle"; s.textContent = CSS; document.head.appendChild(s); }
    if (root !== el) {
      root = el;
      root.addEventListener("click", onClick);
      root.addEventListener("pointerdown", onPointerDown);
      for (const ev of ["pointerup", "pointercancel", "pointerout"]) root.addEventListener(ev, stopHold);
      root.addEventListener("input", onInput);
      root.addEventListener("change", onChange);
    }
    hooks = h; settings = loadSettings(); stopRun(false); renderSetup();
  }

  window.TSTimer = api;
})();
