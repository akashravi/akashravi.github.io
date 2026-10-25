(() => {
  "use strict";

  const card = document.getElementById("scratch-card");
  const canvas = document.getElementById("scratch-canvas");
  const prize = document.getElementById("birthday-prize");
  const label = document.getElementById("scratch-label");
  const button = document.getElementById("reveal-button");
  const hint = document.getElementById("gift-hint");
  const status = document.getElementById("gift-status");
  const confetti = document.getElementById("birthday-confetti");
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  const buffer = document.createElement("canvas");
  const bufferContext = buffer.getContext("2d");

  if (!context || !bufferContext) {
    console.warn("Scratch card canvas is unavailable; showing the gift without scratching.");
    hint.textContent = "No scratching needed. Your surprise is already unwrapped.";
    return;
  }

  const theme = getComputedStyle(document.documentElement);
  const color = (name) => theme.getPropertyValue(`--bday-${name}`).trim();
  let revealed = false;
  let activePointer = null;
  let previousPoint = null;
  let width = 0;
  let height = 0;
  let ratio = 1;
  let checkTimer = 0;

  function paintCover() {
    const bounds = canvas.getBoundingClientRect();
    const nextRatio = Math.min(window.devicePixelRatio || 1, 2);
    if (revealed || (width === bounds.width && height === bounds.height && ratio === nextRatio)) {
      return;
    }

    const initialized = width > 0;
    if (initialized) {
      // Scale the existing foil, including erased pixels, instead of resetting progress.
      buffer.width = canvas.width;
      buffer.height = canvas.height;
      bufferContext.drawImage(canvas, 0, 0);
    }
    width = bounds.width;
    height = bounds.height;
    ratio = nextRatio;
    canvas.width = Math.max(1, Math.round(width * ratio));
    canvas.height = Math.max(1, Math.round(height * ratio));
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    if (initialized) {
      context.drawImage(buffer, 0, 0, width, height);
    } else {
      const gradient = context.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, color("foil-start"));
      gradient.addColorStop(0.45, color("foil-mid"));
      gradient.addColorStop(1, color("foil-end"));
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
      context.fillStyle = color("paper");
      context.globalAlpha = 0.38;
      for (let y = 20; y < height; y += 42) {
        for (let x = 18 + (y % 4) * 9; x < width; x += 47) {
          context.beginPath();
          context.moveTo(x, y - 3);
          context.lineTo(x + 1.5, y);
          context.lineTo(x, y + 3);
          context.lineTo(x - 1.5, y);
          context.fill();
        }
      }
      context.globalAlpha = 1;
    }
    context.globalCompositeOperation = "destination-out";
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = Math.min(52, width * 0.15);
  }

  function celebrate() {
    if (motion.matches) return;
    const symbols = ["\u2665", "\u2736", "\u273f"];
    for (let index = 0; index < 24; index++) {
      const piece = document.createElement("span");
      piece.textContent = symbols[index % symbols.length];
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.fontSize = `${0.8 + Math.random() * 0.7}rem`;
      piece.style.setProperty("--fall-duration", `${2.6 + Math.random() * 1.4}s`);
      piece.style.setProperty("--fall-delay", `${Math.random() * 0.6}s`);
      piece.style.setProperty("--fall-drift", `${Math.random() * 80 - 40}px`);
      piece.style.setProperty("--fall-turn", `${Math.random() * 300 - 150}deg`);
      confetti.append(piece);
    }
    window.setTimeout(() => confetti.replaceChildren(), 4700);
  }

  function reveal(fromButton = false) {
    if (revealed) return;
    revealed = true;
    activePointer = null;
    window.clearTimeout(checkTimer);
    card.classList.add("is-revealed");
    prize.removeAttribute("aria-hidden");
    label.hidden = true;
    button.setAttribute("aria-expanded", "true");
    button.hidden = true;
    hint.textContent = "For you, my love. And for all the memories ahead.";
    status.textContent =
      "Surprise revealed! A Canon R100 is on its way to you and will arrive soon.";
    if (fromButton) prize.focus({ preventScroll: true });
    celebrate();
  }

  function clearedFraction() {
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let clear = 0;
    let samples = 0;
    for (let index = 3; index < data.length; index += 64) {
      samples++;
      if (data[index] < 128) clear++;
    }
    return clear / samples;
  }

  function scheduleCheck() {
    if (checkTimer) return;
    checkTimer = window.setTimeout(() => {
      checkTimer = 0;
      if (!revealed && clearedFraction() >= 0.45) reveal();
    }, 100);
  }

  function point(event) {
    const bounds = canvas.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  }

  function erase(from, to) {
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
    context.beginPath();
    context.arc(to.x, to.y, context.lineWidth / 2, 0, Math.PI * 2);
    context.fill();
    label.hidden = true;
    scheduleCheck();
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (revealed || !event.isPrimary || event.button !== 0 || activePointer !== null) return;
    event.preventDefault();
    activePointer = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    previousPoint = point(event);
    erase(previousPoint, previousPoint);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (revealed || event.pointerId !== activePointer) return;
    const next = point(event);
    erase(previousPoint, next);
    previousPoint = next;
  });

  function stop(event) {
    if (event.pointerId === activePointer) {
      activePointer = null;
      previousPoint = null;
    }
  }

  canvas.addEventListener("pointerup", stop);
  canvas.addEventListener("pointercancel", stop);
  canvas.addEventListener("lostpointercapture", stop);
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  button.addEventListener("click", () => reveal(true));
  motion.addEventListener("change", () => {
    if (motion.matches) confetti.replaceChildren();
  });

  canvas.hidden = false;
  paintCover();
  prize.setAttribute("aria-hidden", "true");
  label.hidden = false;
  button.hidden = false;
  hint.textContent = "Gently scratch with your finger, or tap the button below.";
  card.classList.add("is-ready");
  if ("ResizeObserver" in window) {
    new ResizeObserver(paintCover).observe(card);
  }
  window.addEventListener("resize", paintCover);
})();
