const input = document.querySelector("#photoInput");
const canvas = document.querySelector("#photoCanvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const dropZone = document.querySelector("#dropZone");
const intensity = document.querySelector("#intensity");
const intensityValue = document.querySelector("#intensityValue");
const downloadButton = document.querySelector("#downloadButton");
const avoidanceScore = document.querySelector("#avoidanceScore");
const meterFill = document.querySelector("#meterFill");
const identitySafe = document.querySelector("#identitySafe");
const backgroundMute = document.querySelector("#backgroundMute");
const badgeCrop = document.querySelector("#badgeCrop");
const edgePower = document.querySelector("#edgePower");
const edgeValue = document.querySelector("#edgeValue");
const presetButtons = [...document.querySelectorAll(".segment")];

let sourceImage = null;
let preset = "badge";

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

const drawPortraitLighting = (amount, edgeAmount) => {
  const { width, height } = canvas;
  const backgroundFactor = backgroundMute.checked ? 1 : 0.38;
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
  vignette.addColorStop(1, `rgba(0,0,0,${0.48 * amount * backgroundFactor})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = `rgba(32, 38, 44, ${0.24 * amount})`;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = "source-over";

  const faceLight = ctx.createRadialGradient(
    width * 0.5,
    height * 0.36,
    width * 0.02,
    width * 0.5,
    height * 0.38,
    width * 0.34,
  );
  faceLight.addColorStop(0, `rgba(255, 242, 214, ${0.16 * amount})`);
  faceLight.addColorStop(0.48, `rgba(255, 255, 255, ${0.05 * amount})`);
  faceLight.addColorStop(1, "rgba(255,255,255,0)");
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = faceLight;
  ctx.fillRect(0, 0, width, height);

  const upperShadow = ctx.createLinearGradient(0, height * 0.18, 0, height * 0.48);
  upperShadow.addColorStop(0, `rgba(0,0,0,${0.16 * amount})`);
  upperShadow.addColorStop(0.48, `rgba(0,0,0,${(0.08 + edgeAmount * 0.08) * amount})`);
  upperShadow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = upperShadow;
  ctx.fillRect(0, 0, width, height);

  const lowerShadow = ctx.createRadialGradient(
    width * 0.5,
    height * 0.68,
    width * 0.08,
    width * 0.5,
    height * 0.66,
    width * 0.44,
  );
  lowerShadow.addColorStop(0, `rgba(0,0,0,${0.04 * amount})`);
  lowerShadow.addColorStop(0.62, `rgba(0,0,0,${(0.08 + edgeAmount * 0.1) * amount})`);
  lowerShadow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = lowerShadow;
  ctx.fillRect(0, 0, width, height);

  const sideBurn = ctx.createLinearGradient(0, 0, width, 0);
  sideBurn.addColorStop(0, `rgba(0,0,0,${0.28 * amount * backgroundFactor})`);
  sideBurn.addColorStop(0.28, "rgba(0,0,0,0)");
  sideBurn.addColorStop(0.72, "rgba(0,0,0,0)");
  sideBurn.addColorStop(1, `rgba(0,0,0,${0.28 * amount * backgroundFactor})`);
  ctx.fillStyle = sideBurn;
  ctx.fillRect(0, 0, width, height);

  ctx.globalCompositeOperation = "source-over";
};

const applyPixels = (amount, edgeAmount) => {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const contrast = 1 + amount * (preset === "enforcer" ? 0.88 : 0.58) + edgeAmount * 0.18;
  const saturation = 1 - amount * (preset === "executive" ? 0.2 : 0.38);
  const brightness = 1 - amount * 0.02;
  const warmth = preset === "executive" ? 6 : -4;
  const curveStrength = 0.22 + amount * 0.36 + edgeAmount * 0.18;

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

    const tone = (r + g + b) / 3;
    const curve = ((tone - 128) / 128) * curveStrength;
    const lift = curve * Math.abs(curve) * 128;
    r += lift;
    g += lift;
    b += lift;

    data[i] = Math.max(0, Math.min(255, r * brightness + warmth * amount));
    data[i + 1] = Math.max(0, Math.min(255, g * brightness + 2 * amount));
    data[i + 2] = Math.max(0, Math.min(255, b * brightness - warmth * amount));
  }

  ctx.putImageData(imageData, 0, 0);
};

const addClarity = (amount) => {
  if (!amount) return;

  const blurred = document.createElement("canvas");
  blurred.width = canvas.width;
  blurred.height = canvas.height;
  const blurredCtx = blurred.getContext("2d");
  blurredCtx.filter = `blur(${Math.max(2, Math.round(5 * amount))}px)`;
  blurredCtx.drawImage(canvas, 0, 0);

  const source = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const soft = blurredCtx.getImageData(0, 0, canvas.width, canvas.height);
  const src = source.data;
  const blur = soft.data;
  const strength = Math.min(1.1, amount * 1.4);

  for (let i = 0; i < src.length; i += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      const detail = src[i + channel] - blur[i + channel];
      src[i + channel] = Math.max(0, Math.min(255, src[i + channel] + detail * strength));
    }
  }

  ctx.putImageData(source, 0, 0);
};

const sharpen = (amount) => {
  if (!amount) return;

  const width = canvas.width;
  const height = canvas.height;
  const source = ctx.getImageData(0, 0, width, height);
  const output = ctx.createImageData(width, height);
  const src = source.data;
  const dst = output.data;
  const strength = Math.min(0.32, amount * 0.42);

  dst.set(src);

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const center = src[i + channel] * (1 + 4 * strength);
        const neighbors =
          src[i - 4 + channel] +
          src[i + 4 + channel] +
          src[i - width * 4 + channel] +
          src[i + width * 4 + channel];
        dst[i + channel] = Math.max(0, Math.min(255, center - neighbors * strength));
      }
      dst[i + 3] = src[i + 3];
    }
  }

  ctx.putImageData(output, 0, 0);
};

const render = () => {
  updateCopy();
  if (!sourceImage) return;

  const dim = fitDimensions(sourceImage);
  canvas.width = dim.width;
  canvas.height = dim.height;

  const amount = Number(intensity.value) / 100;
  const edgeAmount = Number(edgePower.value) / 100;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(sourceImage, dim.sx, dim.sy, dim.sw, dim.sh, 0, 0, dim.width, dim.height);

  applyPixels(amount, edgeAmount);
  addClarity(edgeAmount * amount);
  sharpen(edgeAmount * amount);
  if (!identitySafe.checked) {
    ctx.filter = `contrast(${1 + amount * 0.1})`;
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = "none";
  }
  drawPortraitLighting(amount, edgeAmount);
};

const updateCopy = () => {
  const value = Number(intensity.value);
  intensityValue.value = value;
  edgeValue.value = Number(edgePower.value);
  const presetBonus = preset === "enforcer" ? 11 : preset === "executive" ? 6 : 0;
  const safePenalty = identitySafe.checked ? 0 : 5;
  const edgeBonus = Number(edgePower.value) * 0.08;
  const score = Math.max(8, Math.min(96, Math.round(value * 0.78 + edgeBonus + presetBonus - safePenalty + 19)));
  avoidanceScore.textContent = `${score}%`;
  meterFill.style.width = `${score}%`;
};

input.addEventListener("change", (event) => loadFile(event.target.files[0]));
intensity.addEventListener("input", render);
edgePower.addEventListener("input", render);
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

updateCopy();
