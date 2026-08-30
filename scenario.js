(() => {
  "use strict";

  const STATE_KEY = "missionEscapeStateV1";
  let pendingRouteButton = null;

  const scenarios = {
    A: {
      route: "ROUTE A",
      title: "13の企業を巡る発見の旅",
      badge: "企業探索ミッション",
      body: [
        "学会会場には、あなたがまだ知らない13の企業との出会いが待っている。",
        "さあ、会場を飛び出す……のではなく、会場を歩いて新たな発見を探しに行こう！",
        "指定された13の企業展示ブースを訪れ、担当者と話をしながら、製品・技術の魅力を発見せよ。",
        "そして、各ブースで担当者の名刺1枚をゲット！\n13ブースを制覇し、13枚の名刺を集めればミッションコンプリート！",
        "担当者にぜひ聞いてみよう。\n「このブースのイチオシは何ですか？」",
        "そこから始まる会話の中に、明日からの臨床に役立つヒントや、今まで知らなかった技術との出会いがあるかもしれない。",
        "あなたの知らない『新しい発見』は、すぐそこにある。\nさあ、13のブースを巡る発見の旅へ！"
      ],
      mission: "企業名を導く謎を解き、答えだと思う企業ブースへ移動。ブースのQRコードを読み込んで次のミッションを解放せよ。"
    },
    B: {
      route: "ROUTE B",
      title: "南海トラフ巨大地震 ― 病院機能停止まで、あと48時間",
      badge: "CE災害対策ミッション",
      body: [
        "20XX年12月5日 13時00分。南海トラフ巨大地震が発生。",
        "病院は停電・通信障害・断水に見舞われ、多くの患者が院内に取り残された。",
        "病院を救うには、\n⚡ 電力　🫁 呼吸　❤️ 循環　💧 血液浄化\n――これらの医療機能を一刻も早く復旧させなければならない。",
        "しかし、復旧に必要な情報は企業展示ブースに分散している。",
        "あなたはCE災害対策チームの一員。\n指定された10社の企業展示ブースを巡り、QRコードからミッションに挑戦せよ！",
        "問題を解き、メーカー担当者から名刺をゲットし病院を救え！",
        "タイムリミットは48時間。\nあなたの知識と判断力が、患者と病院の未来を変える。"
      ],
      mission: "災害下の判断問題を突破し、指定された企業ブースのQRコードから次のステージへ進め。"
    },
    C: {
      route: "ROUTE C",
      title: "中国・四国9県 完全制覇",
      badge: "中国・四国冒険ミッション",
      body: [
        "あなたは、中国・四国地方を旅する冒険家。",
        "ある日、あなたのもとに一通のメッセージが届いた。",
        "『中国・四国9県に、9つの謎を仕掛けた。すべての謎を解き、最後の宝を探し出せ。』",
        "鳥取、島根、岡山、広島、山口、そして、徳島、香川、愛媛、高知。",
        "9県に隠された観光地や名物、歴史にまつわる謎を解きながら、10社の企業ブースを巡れ！",
        "各ブースのQRコードからミッションに挑戦し、担当者の名刺をゲットしよう。",
        "タイムリミットは48時間。\n10枚の名刺を集めれば、中国・四国9県完全制覇！そして豪華景品があなたを待っている。",
        "さあ、冒険の始まりだ。"
      ],
      mission: "中国・四国9県の観光地・名物・歴史にまつわる謎を解き、企業ブースを巡って完全制覇を目指せ。"
    },
    D: {
      route: "ROUTE D",
      title: "高知県に仕掛けられた10の謎",
      badge: "高知県冒険ミッション",
      body: [
        "あなたは、高知県を旅する冒険家。",
        "ある日、あなたのもとに一通のメッセージが届いた。",
        "『高知県全域に、10個の謎を仕掛けた。すべての謎を解き、お宝を探し出せ。』",
        "高知県に隠された観光地や名物、歴史にまつわる謎を解きながら、10社の企業ブースを巡れ！",
        "各ブースのQRコードからミッションに挑戦し、担当者の名刺をゲットしよう。",
        "タイムリミットは48時間。\n10枚の名刺を集めれば、高知県完全制覇！そして豪華景品があなたを待っている。",
        "さあ、冒険の始まりだ。"
      ],
      mission: "高知の方言・自然・祭り・食・歴史など10の謎を解き、企業ブースを巡ってお宝を目指せ。"
    }
  };

  function esc(value = "") {
    return String(value).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
    }[c]));
  }

  function readState() {
    try {
      return JSON.parse(localStorage.getItem(STATE_KEY) || "null");
    } catch {
      return null;
    }
  }

  function getProgressLabel(routeKey) {
    const state = readState();
    if (!state || state.route !== routeKey) return "MISSION START";
    if (state.completed) return "クリア画面へ";
    if ((state.stageIndex || 0) > 0 || state.phase === "awaitingQr") return "続きから再開";
    return "MISSION START";
  }

  function openGameDirectly(routeKey, dialog) {
    const button = pendingRouteButton && pendingRouteButton.isConnected
      ? pendingRouteButton
      : document.querySelector(`[data-route="${routeKey}"]`);

    if (!button) {
      alert("ルート画面を再読み込みして、もう一度お試しください。");
      return;
    }

    document.removeEventListener("click", interceptRouteClick, true);
    dialog.close();

    try {
      button.click();
    } finally {
      pendingRouteButton = null;
      setTimeout(() => {
        document.addEventListener("click", interceptRouteClick, true);
      }, 0);
    }
  }

  function ensureDialog() {
    let dialog = document.getElementById("scenarioDialog");
    if (dialog) return dialog;

    dialog = document.createElement("dialog");
    dialog.id = "scenarioDialog";
    dialog.className = "scenario-dialog";
    dialog.innerHTML = `
      <article class="scenario-sheet">
        <header class="scenario-head">
          <div>
            <p class="scenario-kicker">SCENARIO BRIEFING</p>
            <div id="scenarioRoute" class="scenario-route"></div>
          </div>
          <button id="scenarioClose" class="icon-button" type="button" aria-label="シナリオを閉じる">×</button>
        </header>
        <div id="scenarioScroll" class="scenario-scroll">
          <div id="scenarioBadge" class="scenario-badge"></div>
          <h1 id="scenarioTitle"></h1>
          <div id="scenarioBody" class="scenario-body"></div>
          <section class="scenario-mission">
            <span>YOUR MISSION</span>
            <p id="scenarioMission"></p>
          </section>
          <button id="scenarioStart" class="primary-button scenario-start" type="button">MISSION START</button>
          <button id="scenarioCancel" class="ghost-button" type="button">ルート選択へ戻る</button>
        </div>
      </article>`;
    document.body.appendChild(dialog);

    dialog.querySelector("#scenarioClose").addEventListener("click", () => dialog.close());
    dialog.querySelector("#scenarioCancel").addEventListener("click", () => dialog.close());
    dialog.querySelector("#scenarioStart").addEventListener("click", () => {
      const routeKey = dialog.dataset.route;
      if (!routeKey || !scenarios[routeKey]) return;
      openGameDirectly(routeKey, dialog);
    });
    return dialog;
  }

  function showScenario(routeKey, sourceButton) {
    const scenario = scenarios[routeKey];
    if (!scenario) return;

    pendingRouteButton = sourceButton;
    const dialog = ensureDialog();
    dialog.dataset.route = routeKey;
    dialog.querySelector("#scenarioRoute").textContent = scenario.route;
    dialog.querySelector("#scenarioBadge").textContent = scenario.badge;
    dialog.querySelector("#scenarioTitle").textContent = scenario.title;
    dialog.querySelector("#scenarioBody").innerHTML = scenario.body
      .map(paragraph => `<p>${esc(paragraph).replace(/\n/g, "<br>")}</p>`)
      .join("");
    dialog.querySelector("#scenarioMission").textContent = scenario.mission;
    dialog.querySelector("#scenarioStart").textContent = getProgressLabel(routeKey);
    dialog.querySelector("#scenarioScroll").scrollTop = 0;
    dialog.showModal();
  }

  function interceptRouteClick(event) {
    const button = event.target.closest?.("[data-route]");
    if (!button) return;

    const routeKey = button.dataset.route;
    if (!scenarios[routeKey]) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    showScenario(routeKey, button);
  }

  document.addEventListener("click", interceptRouteClick, true);
})();
