(() => {
  "use strict";

  const STORAGE_KEY = "missionEscapeStateV2";
  const OLD_STORAGE_KEY = "missionEscapeStateV1";
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
  let pendingQr = new URLSearchParams(location.search).get("qr");
  let state = loadState();

  const scenarios = {
    A: {
      badge: "企業探索ミッション",
      title: "13の企業を巡る発見の旅",
      paragraphs: [
        "学会会場には、あなたがまだ知らない13の企業との出会いが待っている。",
        "会場を歩き、新たな発見を探しに行こう！",
        "指定された13の企業展示ブースを訪れ、担当者と話をしながら製品・技術の魅力を発見せよ。",
        "各ブースで担当者の名刺1枚をゲット。13ブースを制覇し、13枚の名刺を集めればミッションコンプリート！",
        "担当者にぜひ聞いてみよう。『このブースのイチオシは何ですか？』",
        "あなたの知らない『新しい発見』は、すぐそこにある。さあ、13のブースを巡る発見の旅へ！"
      ],
      mission: "企業名を導く謎を解き、答えだと思う企業ブースへ移動。ブースのQRコードを読み込んで次のミッションを解放せよ。"
    },
    B: {
      badge: "CE災害対策ミッション",
      title: "南海トラフ巨大地震 ― 病院機能停止まで、あと48時間",
      paragraphs: [
        "20XX年12月5日 13時00分。南海トラフ巨大地震が発生。",
        "病院は停電・通信障害・断水に見舞われ、多くの患者が院内に取り残された。",
        "病院を救うには、⚡ 電力　🫁 呼吸　❤️ 循環　💧 血液浄化――これらの医療機能を一刻も早く復旧させなければならない。",
        "しかし、復旧に必要な情報は企業展示ブースに分散している。",
        "あなたはCE災害対策チームの一員。企業展示ブースを巡り、QRコードからミッションに挑戦せよ！",
        "問題を解き、メーカー担当者から名刺をゲットし病院を救え！",
        "タイムリミットは48時間。あなたの知識と判断力が、患者と病院の未来を変える。"
      ],
      mission: "災害下の判断問題を突破し、指定された企業ブースのQRコードから次のステージへ進め。"
    },
    C: {
      badge: "中国・四国冒険ミッション",
      title: "中国・四国9県 完全制覇",
      paragraphs: [
        "あなたは、中国・四国地方を旅する冒険家。",
        "ある日、あなたのもとに一通のメッセージが届いた。",
        "『中国・四国9県に、9つの謎を仕掛けた。すべての謎を解き、最後の宝を探し出せ。』",
        "鳥取、島根、岡山、広島、山口、そして、徳島、香川、愛媛、高知。",
        "9県に隠された観光地や名物、歴史にまつわる謎を解きながら企業ブースを巡れ！",
        "各ブースのQRコードからミッションに挑戦し、担当者の名刺をゲットしよう。",
        "タイムリミットは48時間。すべての謎を解けば、中国・四国9県完全制覇！豪華景品があなたを待っている。",
        "さあ、冒険の始まりだ。"
      ],
      mission: "中国・四国9県の観光地・名物・歴史にまつわる謎を解き、企業ブースを巡って完全制覇を目指せ。"
    },
    D: {
      badge: "高知県冒険ミッション",
      title: "高知県に仕掛けられた10の謎",
      paragraphs: [
        "あなたは、高知県を旅する冒険家。",
        "ある日、あなたのもとに一通のメッセージが届いた。",
        "『高知県全域に、10個の謎を仕掛けた。すべての謎を解き、お宝を探し出せ。』",
        "高知県に隠された観光地や名物、歴史にまつわる謎を解きながら企業ブースを巡れ！",
        "各ブースのQRコードからミッションに挑戦し、担当者の名刺をゲットしよう。",
        "タイムリミットは48時間。すべての謎を解けば、高知県完全制覇！豪華景品があなたを待っている。",
        "さあ、冒険の始まりだ。"
      ],
      mission: "高知の方言・自然・祭り・食・歴史など10の謎を解き、企業ブースを巡ってお宝を目指せ。"
    }
  };

  function emptyState() {
    return {
      route: null,
      stageIndex: 0,
      phase: "challenge",
      fragments: [],
      completed: false,
      completedAt: null
    };
  }

  function normalizeState(value) {
    const base = emptyState();
    if (!value || typeof value !== "object") return base;
    return {
      route: typeof value.route === "string" ? value.route : null,
      stageIndex: Number.isInteger(value.stageIndex) && value.stageIndex >= 0 ? value.stageIndex : 0,
      phase: value.phase === "awaitingQr" ? "awaitingQr" : "challenge",
      fragments: Array.isArray(value.fragments) ? value.fragments : [],
      completed: Boolean(value.completed),
      completedAt: value.completedAt || null
    };
  }

  function loadState() {
    try {
      const current = localStorage.getItem(STORAGE_KEY);
      if (current) return normalizeState(JSON.parse(current));

      const old = localStorage.getItem(OLD_STORAGE_KEY);
      if (old) {
        const migrated = normalizeState(JSON.parse(old));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
    } catch (error) {
      console.warn("state load failed", error);
    }
    return emptyState();
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function resetState() {
    state = emptyState();
    saveState();
    clearQrFromUrl();
  }

  function ensurePlayerId() {
    let id = localStorage.getItem(PLAYER_KEY);
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `p-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      localStorage.setItem(PLAYER_KEY, id);
    }
    return id;
  }

  function esc(value = "") {
    return String(value).replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#039;"
    }[c]));
  }

  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
      toast.hidden = true;
    }, 3200);
  }

  function clearQrFromUrl() {
    if (location.search) {
      history.replaceState({}, "", location.pathname + location.hash);
    }
    pendingQr = null;
  }

  function renderHeader(label = "GAME CONTROL") {
    return `
      <header class="topbar">
        <div>
          <p class="eyebrow">MISSION ESCAPE</p>
          <div class="topbar-title">${esc(label)}</div>
        </div>
        <button id="menuButton" class="icon-button" type="button" aria-label="メニュー">☰</button>
      </header>`;
  }

  function wireHeader() {
    document.getElementById("menuButton")?.addEventListener("click", () => menuDialog.showModal());
  }

  function routeProgress(route) {
    const total = route.stages.length;
    const cleared = state.completed ? total : Math.min(state.stageIndex, total);
    return {
      total,
      cleared,
      pct: Math.round((cleared / total) * 100)
    };
  }

  function renderHome() {
    const cards = Object.entries(data.routes).map(([key, route]) => {
      const active = state.route === key;
      const progress = active ? routeProgress(route) : null;
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
        <p>好きなルートを選択してください。まずシナリオを確認し、その後ミッションを開始します。</p>
      </section>
      <section class="route-grid">${cards}</section>
      <p class="note" style="margin-top:18px">※ 進行状況はこの端末・このブラウザに保存されます。QR読み取りも同じブラウザで行ってください。</p>`;

    wireHeader();
    app.querySelectorAll("[data-route]").forEach(button => {
      button.addEventListener("click", () => renderScenario(button.dataset.route));
    });
  }

  function renderScenario(routeKey) {
    const route = data.routes[routeKey];
    const scenario = scenarios[routeKey];
    if (!route || !scenario) {
      renderHome();
      return;
    }

    const sameRoute = state.route === routeKey;
    let buttonLabel = "MISSION START";
    if (sameRoute && state.completed) buttonLabel = "クリア画面へ";
    else if (sameRoute && (state.stageIndex > 0 || state.phase === "awaitingQr")) buttonLabel = "続きから再開";

    const paragraphs = scenario.paragraphs.map(text => `<p>${esc(text)}</p>`).join("");

    app.innerHTML = `
      ${renderHeader(`${route.name} · SCENARIO`)}
      <article class="mission-card scenario-page">
        <div class="mission-head">
          <div class="stage-label">SCENARIO BRIEFING</div>
          <h1>${esc(scenario.title)}</h1>
        </div>
        <div class="mission-body">
          <div class="scenario-badge">${esc(scenario.badge)}</div>
          <div class="scenario-body">${paragraphs}</div>
          <section class="scenario-mission">
            <span>YOUR MISSION</span>
            <p>${esc(scenario.mission)}</p>
          </section>
          <button id="scenarioStartButton" class="primary-button" type="button">${buttonLabel}</button>
          <button id="scenarioBackButton" class="ghost-button" type="button">ルート選択へ戻る</button>
        </div>
      </article>`;

    wireHeader();
    document.getElementById("scenarioBackButton").addEventListener("click", renderHome);
    document.getElementById("scenarioStartButton").addEventListener("click", () => startOrResumeRoute(routeKey));
  }

  function startOrResumeRoute(routeKey) {
    if (!data.routes[routeKey]) return;

    const sameRoute = state.route === routeKey;
    if (!sameRoute && state.route && !state.completed) {
      const ok = confirm("別ルートへ変更すると現在の進行状況をリセットします。変更しますか？");
      if (!ok) return;
    }

    if (!sameRoute) {
      state = {
        route: routeKey,
        stageIndex: 0,
        phase: "challenge",
        fragments: [],
        completed: false,
        completedAt: null
      };
      saveState();
    }

    if (state.completed) {
      renderComplete();
      return;
    }

    renderGame();
  }

  function renderGame() {
    const route = data.routes[state.route];
    if (!route) {
      renderHome();
      return;
    }

    if (state.completed) {
      renderComplete();
      return;
    }

    if (state.stageIndex >= route.stages.length) {
      renderCipher();
      return;
    }

    const stage = route.stages[state.stageIndex];
    const progress = routeProgress(route);
    const awaitingQr = state.phase === "awaitingQr";

    const choices = stage.type === "quiz"
      ? Object.entries(stage.choices).map(([letter, text]) => `
          <button class="choice" type="button" data-choice="${letter}">
            <span class="choice-letter">${letter}</span>
            <span>${esc(text)}</span>
          </button>`).join("")
      : "";

    let actionArea = "";
    if (stage.type === "clue") {
      actionArea = `
        <div class="callout warn">
          <h3>🔎 TARGETを特定せよ</h3>
          <p>答えだと思う企業ブースへ移動し、ブースに設置されたQRコードを読み込んでください。</p>
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
        <div class="stat"><b>${progress.cleared}/${progress.total}</b><span>CLEAR</span></div>
        <div class="stat"><b>${state.fragments.length}</b><span>CODE</span></div>
      </div>
      <div class="progress" aria-label="進行状況"><div style="width:${progress.pct}%"></div></div>
      <article class="mission-card">
        <div class="mission-head">
          <div class="stage-label">STAGE ${String(stage.number).padStart(2, "0")}</div>
          <h1>${esc(stage.title)}</h1>
        </div>
        <div class="mission-body">
          <p class="question">${esc(stage.question)}</p>
          ${actionArea}
        </div>
      </article>`;

    wireHeader();

    if (stage.type === "quiz" && !awaitingQr) wireQuiz(stage);
    handlePendingQr(stage);
  }

  function wireQuiz(stage) {
    let selected = null;
    const answerButton = document.getElementById("answerButton");

    app.querySelectorAll("[data-choice]").forEach(button => {
      button.addEventListener("click", () => {
        selected = button.dataset.choice;
        app.querySelectorAll("[data-choice]").forEach(item => {
          item.classList.toggle("selected", item === button);
        });
        answerButton.disabled = false;
      });
    });

    answerButton.addEventListener("click", () => {
      if (!selected) return;

      const result = document.getElementById("answerResult");
      if (selected !== stage.answer) {
        result.innerHTML = `<div class="callout bad"><h3>❌ ACCESS DENIED</h3><p>その回答ではありません。もう一度考えてください。</p></div>`;
        return;
      }

      if (stage.booth && stage.qrToken) {
        state.phase = "awaitingQr";
        saveState();
        result.innerHTML = `<div class="callout ok"><h3>✅ CORRECT</h3><p>正解。次のブースが特定されました。</p></div>${destinationHtml(stage)}`;
        app.querySelectorAll("[data-choice]").forEach(item => item.disabled = true);
        answerButton.disabled = true;
        return;
      }

      result.innerHTML = `<div class="callout ok"><h3>✅ CORRECT</h3><p>正解です。</p></div>`;
      awardFragment(stage);
      setTimeout(advanceStage, 450);
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
        <div>
          <strong>ブースのQRを読み込め</strong><br>
          <span class="note">正しいQRコードを読み込むまで次のミッションはロックされています。</span>
        </div>
      </div>`;
  }

  function handlePendingQr(stage) {
    if (!pendingQr) return;

    const expected = stage.qrToken;
    const canScan = stage.type === "clue" || state.phase === "awaitingQr";

    if (!expected) {
      showToast("このステージではQR認証は必要ありません。");
      clearQrFromUrl();
      return;
    }

    if (!canScan) {
      showToast("先に現在の問題へ正解してください。");
      clearQrFromUrl();
      return;
    }

    if (pendingQr !== expected) {
      showToast("このブースではありません。現在のミッションを確認してください。");
      clearQrFromUrl();
      return;
    }

    awardFragment(stage);
    showToast(`QR認証成功：CODE ${stage.fragment} を取得`);
    clearQrFromUrl();
    setTimeout(advanceStage, 350);
  }

  function awardFragment(stage) {
    const key = `${state.route}-${stage.number}`;
    if (state.fragments.some(fragment => fragment.key === key)) return;

    state.fragments.push({
      key,
      slot: stage.slot,
      value: stage.fragment,
      stage: stage.number
    });
    saveState();
  }

  function advanceStage() {
    const route = data.routes[state.route];
    if (!route) {
      renderHome();
      return;
    }

    state.stageIndex += 1;
    state.phase = "challenge";
    saveState();

    if (state.stageIndex >= route.stages.length) renderCipher();
    else renderGame();
  }

  function renderCipher() {
    const route = data.routes[state.route];
    if (!route) {
      renderHome();
      return;
    }

    const fragments = [...state.fragments]
      .sort((a, b) => a.stage - b.stage)
      .map(fragment => `
        <div class="fragment-card">
          <span>暗号位置 ${fragment.slot}</span>
          <b>${esc(fragment.value)}</b>
        </div>`).join("");

    app.innerHTML = `
      ${renderHeader(`${route.name} · FINAL`)}
      <article class="mission-card">
        <div class="mission-head">
          <div class="stage-label">FINAL MISSION</div>
          <h1>暗号を復元せよ</h1>
        </div>
        <div class="mission-body">
          <p class="question">集めた暗号の欠片を「暗号位置」の順に並べ、完成したFINAL CODEを入力せよ。</p>
          <div class="fragments">${fragments}</div>
          <input id="finalCodeInput" class="code-input" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="FINAL CODE">
          <button id="finalCodeButton" class="primary-button" type="button">UNLOCK</button>
          <div id="finalResult"></div>
        </div>
      </article>`;

    wireHeader();
    document.getElementById("finalCodeButton").addEventListener("click", () => {
      const value = document.getElementById("finalCodeInput").value.replace(/\s+/g, "").toUpperCase();
      if (value !== route.finalCode.toUpperCase()) {
        document.getElementById("finalResult").innerHTML = `<div class="callout bad"><h3>❌ CODE ERROR</h3><p>暗号位置を確認して、もう一度入力してください。</p></div>`;
        return;
      }

      state.completed = true;
      state.completedAt = new Date().toISOString();
      saveState();
      renderComplete();
    });
  }

  function renderComplete() {
    const route = data.routes[state.route];
    if (!route) {
      renderHome();
      return;
    }

    const shortId = ensurePlayerId().replace(/-/g, "").slice(0, 8).toUpperCase();
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
      </article>`;
    wireHeader();
  }

  function renderLoadError() {
    app.innerHTML = `
      <section class="boot-card">
        <p class="eyebrow">LOAD ERROR</p>
        <h1>MISSION ESCAPE</h1>
        <p>ゲームデータを読み込めませんでした。通信状態を確認して再読み込みしてください。</p>
      </section>`;
  }

  async function init() {
    try {
      const response = await fetch("./game-data.json", { cache: "no-cache" });
      if (!response.ok) throw new Error(`game-data ${response.status}`);
      data = await response.json();
      ensurePlayerId();

      if (pendingQr) {
        if (state.route && data.routes[state.route]) renderGame();
        else {
          renderHome();
          showToast("先にルートを選択してゲームを開始してください。");
        }
        return;
      }

      if (state.route && data.routes[state.route]) {
        if (state.completed) renderComplete();
        else if (state.stageIndex >= data.routes[state.route].stages.length) renderCipher();
        else renderGame();
      } else {
        renderHome();
      }
    } catch (error) {
      console.error(error);
      renderLoadError();
    }
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installButton.hidden = false;
  });

  installButton.addEventListener("click", async () => {
    if (!deferredInstallPrompt) {
      showToast("ブラウザのメニューから『ホーム画面に追加』を選択してください。");
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
    if (!confirm("この端末の進行状況をすべてリセットします。よろしいですか？")) return;
    resetState();
    menuDialog.close();
    renderHome();
  });

  closeMenuButton.addEventListener("click", () => menuDialog.close());

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(console.error);
    });
  }

  init();
})();
