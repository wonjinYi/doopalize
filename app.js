const input = document.querySelector("#photoInput");
const canvas = document.querySelector("#photoCanvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const dropZone = document.querySelector("#dropZone");
const intensity = document.querySelector("#intensity");
const intensityValue = document.querySelector("#intensityValue");
const downloadButton = document.querySelector("#downloadButton");
const copyPrompt = document.querySelector("#copyPrompt");
const promptText = document.querySelector("#promptText");
const avoidanceScore = document.querySelector("#avoidanceScore");
const meterFill = document.querySelector("#meterFill");
const identitySafe = document.querySelector("#identitySafe");
const backgroundMute = document.querySelector("#backgroundMute");
const badgeCrop = document.querySelector("#badgeCrop");
const presetButtons = [...document.querySelectorAll(".segment")];

let sourceImage = null;
let preset = "badge";

const presetCopy = {
  badge: "원래 인물의 정체성과 얼굴 비율은 유지하되, 눈매와 턱선이 더 또렷하고 차분하게 단호한 사원증 사진으로 편집한다. 과장된 표정 변화 없이 대비, 조명, 선명도만 높인다.",
  executive: "원본 얼굴의 특징을 유지하면서 임원실에 바로 호출할 것 같은 묵직한 인상으로 편집한다. 조명은 낮고 입체적이며, 피부 질감과 윤곽은 절제해서 강화한다.",
  enforcer: "원본 인물임을 알아볼 수 있게 유지하면서 곽두팔이라는 이름이 어울릴 정도로 강한 눈빛, 선명한 턱선, 낮은 채도의 강렬한 분위기로 편집한다. 폭력적 요소나 상처 표현은 추가하지 않는다.",
};

const loadFile = (file) => {
  if (!file || !file.type.startsWith("image/")) return;

  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      sourceImage = img;
      dropZone.classList.add("has-image");
      downloadButton.disabled = false;
      render();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
};

const fitDimensions = (img) => {
  const targetRatio = badgeCrop.checked ? 4 / 5 : img.width / img.height;
  const maxWidth = 1400;
  const maxHeight = 1700;
  let width = img.width;
  let height = img.height;

  if (badgeCrop.checked) {
    if (width / height > targetRatio) {
      width = height * targetRatio;
    } else {
      height = width / targetRatio;
    }
  }

  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
    sx: Math.round((img.width - width) / 2),
    sy: Math.round((img.height - height) / 2),
    sw: Math.round(width),
    sh: Math.round(height),
  };
};

const drawOverlay = (amount) => {
  const { width, height } = canvas;
  const vignette = ctx.createRadialGradient(
    width * 0.5,
    height * 0.42,
    width * 0.08,
    width * 0.5,
    height * 0.45,
    width * 0.72,
  );
  vignette.addColorStop(0, `rgba(255,255,255,${0.03 * amount})`);
  vignette.addColorStop(0.52, "rgba(0,0,0,0)");
  vignette.addColorStop(1, `rgba(0,0,0,${0.48 * amount})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = `rgba(50, 56, 62, ${0.2 * amount})`;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = "source-over";

  const browY = height * 0.36;
  const browWidth = width * 0.28;
  ctx.strokeStyle = `rgba(20, 22, 24, ${0.22 * amount})`;
  ctx.lineWidth = Math.max(8, width * 0.014);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(width * 0.5 - browWidth, browY);
  ctx.quadraticCurveTo(width * 0.43, browY - height * 0.035, width * 0.5, browY - height * 0.01);
  ctx.quadraticCurveTo(width * 0.57, browY - height * 0.035, width * 0.5 + browWidth, browY);
  ctx.stroke();

  ctx.strokeStyle = `rgba(240, 178, 63, ${0.12 * amount})`;
  ctx.lineWidth = Math.max(2, width * 0.004);
  ctx.beginPath();
  ctx.moveTo(width * 0.24, height * 0.08);
  ctx.lineTo(width * 0.76, height * 0.08);
  ctx.stroke();
};

const applyPixels = (amount) => {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const contrast = 1 + amount * (preset === "enforcer" ? 0.62 : 0.42);
  const saturation = 1 - amount * (preset === "executive" ? 0.32 : 0.48);
  const brightness = 1 - amount * 0.05;
  const warmth = preset === "executive" ? 6 : -4;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    const gray = r * 0.299 + g * 0.587 + b * 0.114;

    r = gray + (r - gray) * saturation;
    g = gray + (g - gray) * saturation;
    b = gray + (b - gray) * saturation;

    r = (r - 128) * contrast + 128;
    g = (g - 128) * contrast + 128;
    b = (b - 128) * contrast + 128;

    data[i] = Math.max(0, Math.min(255, r * brightness + warmth * amount));
    data[i + 1] = Math.max(0, Math.min(255, g * brightness + 2 * amount));
    data[i + 2] = Math.max(0, Math.min(255, b * brightness - warmth * amount));
  }

  ctx.putImageData(imageData, 0, 0);
};

const render = () => {
  updateCopy();
  if (!sourceImage) return;

  const dim = fitDimensions(sourceImage);
  canvas.width = dim.width;
  canvas.height = dim.height;

  const amount = Number(intensity.value) / 100;
  const blur = backgroundMute.checked ? Math.max(0, amount * 0.7) : 0;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (blur) {
    ctx.filter = `blur(${blur * 4}px) saturate(${1 - amount * 0.35}) brightness(${1 - amount * 0.18})`;
    ctx.drawImage(sourceImage, dim.sx, dim.sy, dim.sw, dim.sh, 0, 0, dim.width, dim.height);
    ctx.filter = "none";
    const inset = Math.min(dim.width, dim.height) * 0.055;
    ctx.drawImage(
      sourceImage,
      dim.sx,
      dim.sy,
      dim.sw,
      dim.sh,
      inset,
      inset,
      dim.width - inset * 2,
      dim.height - inset * 2,
    );
  } else {
    ctx.drawImage(sourceImage, dim.sx, dim.sy, dim.sw, dim.sh, 0, 0, dim.width, dim.height);
  }

  applyPixels(amount);
  if (!identitySafe.checked) {
    ctx.filter = `contrast(${1 + amount * 0.1})`;
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = "none";
  }
  drawOverlay(amount);
};

const updateCopy = () => {
  const value = Number(intensity.value);
  intensityValue.value = value;
  const presetBonus = preset === "enforcer" ? 11 : preset === "executive" ? 6 : 0;
  const safePenalty = identitySafe.checked ? 0 : 5;
  const score = Math.max(8, Math.min(96, Math.round(value * 0.82 + presetBonus - safePenalty + 19)));
  avoidanceScore.textContent = `${score}%`;
  meterFill.style.width = `${score}%`;
  promptText.textContent = presetCopy[preset];
};

input.addEventListener("change", (event) => loadFile(event.target.files[0]));
intensity.addEventListener("input", render);
identitySafe.addEventListener("change", render);
backgroundMute.addEventListener("change", render);
badgeCrop.addEventListener("change", render);

presetButtons.forEach((button) => {
  button.addEventListener("click", () => {
    presetButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    preset = button.dataset.preset;
    render();
  });
});

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("dragging");
});

dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragging"));

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("dragging");
  loadFile(event.dataTransfer.files[0]);
});

downloadButton.addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = "doopalized-profile.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
});

copyPrompt.addEventListener("click", async () => {
  await navigator.clipboard.writeText(promptText.textContent);
  copyPrompt.textContent = "✓";
  window.setTimeout(() => {
    copyPrompt.textContent = "⧉";
  }, 900);
});

updateCopy();
