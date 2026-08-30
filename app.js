(() => {
  "use strict";

  const STORAGE_KEY = "missionEscapeStateV1";
  const PLAYER_KEY = "missionEscapePlayerV1";
  const app = document.getElementById("app");
  const toast = document.getElementById("toast");
  const menuDialog = document.getElementById("menuDialog");
  const installButton = document.getElementById("installButton");
  const backHomeButton = document.getElementById("backHomeButton");
  const resetButton = document.getElementById("resetButton");
  const closeMenuButton = document.getElementById("closeMenuButton");
  let data = null;
  let deferredInstallPrompt = null;
  let state = loadState();
  let pendingQr = new URLSearchParams(location.search).get("qr");

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { route:null, stageIndex:0, phase:"challenge", fragments:[], completed:false };
    } catch {
      return { route:null, stageIndex:0, phase:"challenge", fragments:[], completed:false };
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function resetState() {
    state = { route:null, stageIndex:0, phase:"challenge", fragments:[], completed:false };
    saveState();
    clearQrFromUrl();
  }

  function ensurePlayerId() {
    let id = localStorage.getItem(PLAYER_KEY);
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : `p-${Date.now()}-${Math.random().toString(36).slice(2,9)}`);
      localStorage.setItem(PLAYER_KEY, id);
    }
    return id;
  }

  function esc(value="") {
    return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
  }

  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(showToast.t);
    showToast.t = setTimeout(() => { toast.hidden = true; }, 3200);
  }

  function clearQrFromUrl() {
    if (location.search) {
      history.replaceState({}, "", location.pathname + location.hash);
    }
    pendingQr = null;
  }

  function renderHeader(routeLabel="GAME CONTROL") {
    return `
      <header class="topbar">
        <div>
          <p class="eyebrow">MISSION ESCAPE</p>
          <div class="topbar-title">${esc(routeLabel)}</div>
        </div>
        <button id="menuButton" class="icon-button" type="button" aria-label="メニュー">☰</button>
      </header>`;
  }

  function wireHeader() {
    const b = document.getElementById("menuButton");
    if (b) b.addEventListener("click", () => menuDialog.showModal());
  }

  function routeProgress(route) {
    const total = route.stages.length;
    let cleared = state.stageIndex;
    if (state.completed) cleared = total;
    return { total, cleared, pct: Math.min(100, Math.round(cleared / total * 100)) };
  }

  function renderHome() {
    const cards = Object.entries(data.routes).map(([key,route]) => {
      const isActive = state.route === key;
      const progress = isActive ? routeProgress(route) : null;
      return `
      <button class="route-card" type="button" data-route="${key}">
        <span class="route-code">${esc(route.name)}</span>
        <strong>${esc(route.subtitle)}</strong>
        <span>${esc(route.intro)}</span>
        ${progress ? `<span style="display:block;margin-top:10px;color:var(--accent)">進行 ${progress.cleared}/${progress.total}${state.completed ? " · COMPLETE" : ""}</span>` : ""}
      </button>`;
    }).join("");

    app.innerHTML = `
      ${renderHeader("ROUTE SELECT")}
      <section class="hero">
        <p class="eyebrow">中四国連絡協議会組織委員会 presents</p>
        <h1>MISSION<br>ESCAPE</h1>
        <p>好きなルートを1つ選び、会場を歩け。謎を解き、指定された企業ブースのQRコードで次のミッションを解放せよ。</p>
      </section>
      <section class="route-grid">${cards}</section>
      <p class="note" style="margin-top:18px">※ 進行状況はこの端末・このブラウザ内に保存されます。当日は同じブラウザでQRコードを開いてください。</p>
    `;
    wireHeader();
    app.querySelectorAll("[data-route]").forEach(btn => {
      btn.addEventListener("click", () => selectRoute(btn.dataset.route));
    });
  }

  function selectRoute(key) {
    if (!data.routes[key]) return;
    if (state.route && state.route !== key && !state.completed) {
      if (!confirm("別ルートへ変更すると現在の進行状況をリセットします。変更しますか？")) return;
      resetState();
    }
    if (state.route !== key) {
      state = { route:key, stageIndex:0, phase:"challenge", fragments:[], completed:false };
      saveState();
    }
    renderGame();
  }

  function renderGame() {
    const route = data.routes[state.route];
    if (!route) { renderHome(); return; }
    if (state.completed) { renderCipher(); return; }
    const stage = route.stages[state.stageIndex];
    if (!stage) { renderCipher(); return; }

    const p = routeProgress(route);
    const awaitingQr = state.phase === "awaitingQr";
    const choices = stage.type === "quiz" ? Object.entries(stage.choices).map(([letter,text]) => `
      <button class="choice" type="button" data-choice="${letter}">
        <span class="choice-letter">${letter}</span>
        <span>${esc(text)}</span>
      </button>`).join("") : "";

    let actionArea = "";
    if (stage.type === "clue") {
      actionArea = `
        <div class="callout warn">
          <h3>🔎 TARGETを特定せよ</h3>
          <p>答えだと思う企業ブースへ移動し、ブースに設置されたQRコードをスマートフォンのカメラで読み込んでください。</p>
        </div>`;
    } else if (awaitingQr) {
      actionArea = destinationHtml(stage);
    } else {
      actionArea = `
        <div class="choice-list" id="choices">${choices}</div>
        <button id="answerButton" class="primary-button" type="button" disabled>回答する</button>
        <div id="answerResult"></div>`;
    }

    app.innerHTML = `
      ${renderHeader(`${route.name} · ${route.subtitle}`)}
      <div class="status-strip">
        <div class="stat"><b>${state.stageIndex + 1}</b><span>STAGE</span></div>
        <div class="stat"><b>${p.cleared}/${p.total}</b><span>CLEAR</span></div>
        <div class="stat"><b>${state.fragments.length}</b><span>CODE</span></div>
      </div>
      <div class="progress" aria-label="進行状況"><div style="width:${p.pct}%"></div></div>

      <article class="mission-card">
        <div class="mission-head">
          <div class="stage-label">STAGE ${String(stage.number).padStart(2,"0")}</div>
          <h1>${esc(stage.title)}</h1>
        </div>
        <div class="mission-body">
          <p class="question">${esc(stage.question)}</p>
          ${actionArea}
        </div>
      </article>
    `;
    wireHeader();

    if (stage.type === "quiz" && !awaitingQr) wireQuiz(stage);
    handlePendingQr(stage);
  }

  function wireQuiz(stage) {
    let selected = null;
    const answerButton = document.getElementById("answerButton");
    app.querySelectorAll("[data-choice]").forEach(btn => {
      btn.addEventListener("click", () => {
        selected = btn.dataset.choice;
        app.querySelectorAll("[data-choice]").forEach(x => x.classList.toggle("selected", x === btn));
        answerButton.disabled = false;
      });
    });
    answerButton.addEventListener("click", () => {
      if (!selected) return;
      const result = document.getElementById("answerResult");
      if (selected === stage.answer) {
        if (stage.booth && stage.qrToken) {
          state.phase = "awaitingQr";
          saveState();
          result.innerHTML = `<div class="callout ok"><h3>✅ CORRECT</h3><p>正解。次のブースが特定されました。</p></div>${destinationHtml(stage)}`;
          app.querySelectorAll("[data-choice]").forEach(x => x.disabled = true);
          answerButton.disabled = true;
        } else {
          result.innerHTML = `<div class="callout ok"><h3>✅ CORRECT</h3><p>最終判断に成功しました。</p></div>`;
          awardFragment(stage);
          setTimeout(() => advanceStage(), 450);
        }
      } else {
        result.innerHTML = `<div class="callout bad"><h3>❌ ACCESS DENIED</h3><p>その回答ではありません。状況を整理して、もう一度選択してください。</p></div>`;
      }
    });
  }

  function destinationHtml(stage) {
    return `
      <div class="callout ok">
        <h3>✅ NEXT TARGET</h3>
        <p>次の企業ブースが判明しました。</p>
        <div class="booth-name">${esc(stage.booth || "")}</div>
      </div>
      <div class="qr-instruction">
        <div class="qr-symbol">▦</div>
        <div><strong>ブースのQRを読み込め</strong><br><span class="note">正しいQRコードを読み込むまで次のミッションはロックされています。</span></div>
      </div>`;
  }

  function handlePendingQr(stage) {
    if (!pendingQr) return;

    if (!state.route) {
      showToast("先にルートを選択してください。");
      return;
    }

    const expected = stage.qrToken;
    if (!expected) {
      showToast("このステージではQR認証は必要ありません。");
      clearQrFromUrl();
      return;
    }

    const canScan = stage.type === "clue" || state.phase === "awaitingQr";
    if (!canScan) {
      showToast("先に現在の問題へ正解してください。");
      clearQrFromUrl();
      return;
    }

    if (pendingQr === expected) {
      awardFragment(stage);
      showToast(`QR認証成功：CODE ${stage.fragment} を取得`);
      clearQrFromUrl();
      setTimeout(() => advanceStage(), 350);
    } else {
      showToast("このブースではありません。現在のミッションを確認してください。");
      clearQrFromUrl();
    }
  }

  function awardFragment(stage) {
    const key = `${state.route}-${stage.number}`;
    if (!state.fragments.some(f => f.key === key)) {
      state.fragments.push({ key, slot:stage.slot, value:stage.fragment, stage:stage.number });
      saveState();
    }
  }

  function advanceStage() {
    const route = data.routes[state.route];
    state.stageIndex += 1;
    state.phase = "challenge";
    if (state.stageIndex >= route.stages.length) {
      saveState();
      renderCipher();
      return;
    }
    saveState();
    renderGame();
  }

  function renderCipher() {
    const route = data.routes[state.route];
    if (!route) { renderHome(); return; }
    const sorted = [...state.fragments].sort((a,b) => a.stage-b.stage);
    const cards = sorted.map(f => `
      <div class="fragment-card">
        <span>暗号位置 ${f.slot}</span>
        <b>${esc(f.value)}</b>
      </div>`).join("");

    app.innerHTML = `
      ${renderHeader(`${route.name} · FINAL`)}
      <article class="mission-card">
        <div class="mission-head">
          <div class="stage-label">FINAL MISSION</div>
          <h1>暗号を復元せよ</h1>
        </div>
        <div class="mission-body">
          <p class="question">集めた暗号の欠片には「暗号位置」が記録されている。位置1から順番に並べ、完成したFINAL CODEを入力せよ。</p>
          <div class="fragments">${cards}</div>
          <input id="finalCodeInput" class="code-input" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="FINAL CODE">
          <button id="finalCodeButton" class="primary-button" type="button">UNLOCK</button>
          <div id="finalResult"></div>
        </div>
      </article>`;
    wireHeader();

    document.getElementById("finalCodeButton").addEventListener("click", () => {
      const input = document.getElementById("finalCodeInput");
      const normalized = input.value.replace(/\s+/g,"").toUpperCase();
      if (normalized === route.finalCode.toUpperCase()) {
        state.completed = true;
        state.completedAt = new Date().toISOString();
        saveState();
        renderComplete();
      } else {
        document.getElementById("finalResult").innerHTML =
          `<div class="callout bad"><h3>❌ CODE ERROR</h3><p>暗号位置を確認し、もう一度並べ直してください。</p></div>`;
      }
    });
  }

  function renderComplete() {
    const route = data.routes[state.route];
    const playerId = ensurePlayerId();
    const shortId = playerId.replace(/-/g,"").slice(0,8).toUpperCase();
    app.innerHTML = `
      ${renderHeader(`${route.name} · COMPLETE`)}
      <article class="mission-card complete">
        <div class="complete-mark">🏆</div>
        <p class="eyebrow">ALL SYSTEMS GREEN</p>
        <h1>MISSION COMPLETE</h1>
        <div class="big">CLEAR</div>
        <p>${esc(route.subtitle)} を完全制覇しました。</p>
        <div class="callout ok">
          <h3>景品交換所へ向かえ</h3>
          <p>この画面をスタッフへ提示してください。</p>
          <div class="fragment"><span>CLEAR ID</span><b>${shortId}</b></div>
        </div>
        <p class="note">※ このCLEAR IDは端末内で生成される簡易識別子です。サーバーを使用しないため、厳密な不正防止・一回限りの景品交換管理には利用できません。</p>
      </article>`;
    wireHeader();
  }

  async function init() {
    try {
      const res = await fetch("./game-data.json", { cache:"no-cache" });
      if (!res.ok) throw new Error("game-data load failed");
      data = await res.json();
      ensurePlayerId();

      if (state.route && data.routes[state.route]) {
        if (state.completed) renderComplete();
        else renderGame();
      } else {
        renderHome();
      }
    } catch (err) {
      console.error(err);
      app.innerHTML = `<section class="boot-card"><p class="eyebrow">LOAD ERROR</p><h1>MISSION ESCAPE</h1><p>ゲームデータを読み込めませんでした。通信状態を確認して再読み込みしてください。</p></section>`;
    }
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    installButton.hidden = false;
  });

  installButton.addEventListener("click", async () => {
    if (!deferredInstallPrompt) {
      showToast("ブラウザのメニューから「ホーム画面に追加」を選択してください。");
      return;
    }
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installButton.hidden = true;
  });

  backHomeButton.addEventListener("click", () => {
    menuDialog.close();
    renderHome();
  });

  resetButton.addEventListener("click", () => {
    if (!confirm("この端末のゲーム進行状況をすべてリセットします。よろしいですか？")) return;
    resetState();
    menuDialog.close();
    renderHome();
  });

  closeMenuButton.addEventListener("click", () => menuDialog.close());

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js", { scope:"./" }).catch(console.error);
    });
  }

  init();
})();
