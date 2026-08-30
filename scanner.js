(() => {
  "use strict";

  let stream = null;
  let timer = null;
  let busy = false;
  let gameDataPromise = null;

  const STATE_KEY = "missionEscapeStateV1";

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(STATE_KEY) || "null");
    } catch {
      return null;
    }
  }

  function loadGameData() {
    if (!gameDataPromise) {
      gameDataPromise = fetch("./game-data.json", { cache: "no-cache" }).then(r => {
        if (!r.ok) throw new Error("game-data load failed");
        return r.json();
      });
    }
    return gameDataPromise;
  }

  function currentExpectedToken(data) {
    const state = loadState();
    if (!state?.route || !data?.routes?.[state.route]) return null;
    const stage = data.routes[state.route].stages?.[state.stageIndex];
    return stage?.qrToken || null;
  }

  function extractToken(rawValue) {
    const raw = String(rawValue || "").trim();
    if (!raw) return null;
    try {
      const url = new URL(raw, location.href);
      const token = url.searchParams.get("qr");
      if (token) return token;
    } catch {}
    return /^[A-Z0-9-]{4,}$/i.test(raw) ? raw : null;
  }

  function shouldShowScanner() {
    if (document.querySelector(".qr-instruction")) return true;
    return [...document.querySelectorAll(".callout.warn h3")]
      .some(el => el.textContent.includes("TARGET"));
  }

  function ensureScanButton() {
    if (!shouldShowScanner()) {
      document.getElementById("cameraQrButton")?.remove();
      return;
    }
    if (document.getElementById("cameraQrButton")) return;

    const anchor = document.querySelector(".qr-instruction") || document.querySelector(".callout.warn");
    if (!anchor) return;

    const button = document.createElement("button");
    button.id = "cameraQrButton";
    button.type = "button";
    button.className = "primary-button camera-qr-button";
    button.textContent = "📷 QRコードを読み込む";
    button.addEventListener("click", openScanner);
    anchor.insertAdjacentElement("afterend", button);
  }

  async function openScanner() {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert("このブラウザではカメラを利用できません。スマートフォン標準カメラでQRコードを読み込んでください。");
      return;
    }

    closeScanner();

    const overlay = document.createElement("div");
    overlay.id = "cameraQrOverlay";
    overlay.className = "camera-qr-overlay";
    overlay.innerHTML = `
      <section class="camera-qr-panel" role="dialog" aria-modal="true" aria-label="QRコード読み取り">
        <header class="camera-qr-head">
          <div>
            <p class="eyebrow">QR SCANNER</p>
            <strong>ブースのQRを枠内に入れてください</strong>
          </div>
          <button id="cameraQrClose" class="icon-button" type="button" aria-label="QR読み取りを閉じる">×</button>
        </header>
        <div class="camera-qr-frame">
          <video id="cameraQrVideo" playsinline muted autoplay></video>
          <div class="camera-qr-guide" aria-hidden="true"></div>
        </div>
        <p id="cameraQrStatus" class="note">カメラを起動しています…</p>
      </section>`;
    document.body.appendChild(overlay);
    document.getElementById("cameraQrClose").addEventListener("click", closeScanner);

    const video = document.getElementById("cameraQrVideo");
    const status = document.getElementById("cameraQrStatus");

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 960 },
          height: { ideal: 720 }
        }
      });
      video.srcObject = stream;
      await video.play();
      status.textContent = "QRコードを検索中…";
      startDetection(video, status);
    } catch (error) {
      console.error(error);
      status.textContent = "カメラを起動できません。ブラウザのカメラ権限を確認してください。";
    }
  }

  async function startDetection(video, status) {
    busy = false;
    const data = await loadGameData().catch(() => null);
    const expected = currentExpectedToken(data);

    let detector = null;
    if ("BarcodeDetector" in window) {
      try {
        const formats = await BarcodeDetector.getSupportedFormats?.();
        if (!formats || formats.includes("qr_code")) {
          detector = new BarcodeDetector({ formats: ["qr_code"] });
        }
      } catch {}
    }

    let jsQR = null;
    let canvas = null;
    let ctx = null;

    if (!detector) {
      status.textContent = "QR解析エンジンを準備中…";
      try {
        jsQR = await loadJsQr();
        canvas = document.createElement("canvas");
        ctx = canvas.getContext("2d", { willReadFrequently: true });
        status.textContent = "QRコードを検索中…";
      } catch (error) {
        console.error(error);
        status.textContent = "QR解析機能を読み込めませんでした。標準カメラをご利用ください。";
        return;
      }
    }

    const detect = async () => {
      if (!document.getElementById("cameraQrOverlay") || busy) return;
      if (video.readyState < 2) {
        timer = setTimeout(detect, 180);
        return;
      }

      busy = true;
      try {
        let raw = null;

        if (detector) {
          const results = await detector.detect(video);
          raw = results?.[0]?.rawValue || null;
        } else {
          const maxWidth = 640;
          const scale = Math.min(1, maxWidth / video.videoWidth);
          canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
          canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
          raw = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" })?.data || null;
        }

        if (raw) {
          const token = extractToken(raw);
          if (!token) {
            status.textContent = "MISSION ESCAPE用QRではありません。";
          } else if (expected && token !== expected) {
            status.textContent = "このブースではありません。指定されたブースのQRを読み込んでください。";
            navigator.vibrate?.([50, 60, 50]);
          } else {
            status.textContent = "QR認証中…";
            navigator.vibrate?.(80);
            stopCameraOnly();
            const next = new URL(location.href);
            next.search = "";
            next.searchParams.set("qr", token);
            location.href = next.toString();
            return;
          }
        }
      } catch (error) {
        console.debug("QR detection error", error);
      } finally {
        busy = false;
      }

      timer = setTimeout(detect, 180);
    };

    detect();
  }

  function loadJsQr() {
    if (window.jsQR) return Promise.resolve(window.jsQR);
    return new Promise((resolve, reject) => {
      const existing = document.querySelector("script[data-jsqr]");
      if (existing) {
        existing.addEventListener("load", () => resolve(window.jsQR), { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.dataset.jsqr = "1";
      script.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
      script.async = true;
      script.onload = () => resolve(window.jsQR);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function stopCameraOnly() {
    clearTimeout(timer);
    timer = null;
    busy = false;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
  }

  function closeScanner() {
    stopCameraOnly();
    document.getElementById("cameraQrOverlay")?.remove();
  }

  const observer = new MutationObserver(ensureScanButton);
  observer.observe(document.getElementById("app"), { childList: true, subtree: true });
  ensureScanButton();
})();
