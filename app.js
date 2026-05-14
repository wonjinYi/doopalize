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
const menacePower = document.querySelector("#menacePower");
const menaceValue = document.querySelector("#menaceValue");
const faceX = document.querySelector("#faceX");
const faceY = document.querySelector("#faceY");
const faceScale = document.querySelector("#faceScale");
const resetFace = document.querySelector("#resetFace");
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

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const sampleBilinear = (src, width, height, x, y, channel) => {
  const x0 = clamp(Math.floor(x), 0, width - 1);
  const y0 = clamp(Math.floor(y), 0, height - 1);
  const x1 = clamp(x0 + 1, 0, width - 1);
  const y1 = clamp(y0 + 1, 0, height - 1);
  const tx = x - x0;
  const ty = y - y0;
  const i00 = (y0 * width + x0) * 4 + channel;
  const i10 = (y0 * width + x1) * 4 + channel;
  const i01 = (y1 * width + x0) * 4 + channel;
  const i11 = (y1 * width + x1) * 4 + channel;
  const top = src[i00] * (1 - tx) + src[i10] * tx;
  const bottom = src[i01] * (1 - tx) + src[i11] * tx;
  return top * (1 - ty) + bottom * ty;
};

const smoothMask = (value) => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

const ovalMask = (nx, ny, widthScale = 1, heightScale = 1) => {
  const distance = (nx * nx) / (widthScale * widthScale) + (ny * ny) / (heightScale * heightScale);
  return smoothMask(1 - distance);
};

const transformFaceShape = (amount, menaceAmount) => {
  if (!amount || !menaceAmount) return;

  const width = canvas.width;
  const height = canvas.height;
  const source = ctx.getImageData(0, 0, width, height);
  const output = ctx.createImageData(width, height);
  const src = source.data;
  const dst = output.data;
  const cx = width * (Number(faceX.value) / 100);
  const cy = height * (Number(faceY.value) / 100);
  const radius = Math.min(width, height) * (Number(faceScale.value) / 100);
  const power = amount * menaceAmount;
  const presetFactor = preset === "enforcer" ? 1.2 : preset === "executive" ? 0.96 : 0.86;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = (x - cx) / radius;
      const ny = (y - cy) / radius;
      const face = ovalMask(nx, ny - 0.12, 0.82, 1.22);
      let dx = 0;
      let dy = 0;

      const eyeBand = Math.exp(-((ny + 0.16) ** 2) / 0.026) * smoothMask(1 - Math.abs(nx) / 0.72);
      dy += eyeBand * radius * 0.035 * power * presetFactor;
      dx += Math.sign(nx) * eyeBand * radius * 0.018 * power;

      const browMass = Math.exp(-((ny + 0.3) ** 2) / 0.032) * smoothMask(1 - Math.abs(nx) / 0.78);
      dy -= browMass * radius * 0.026 * power;

      const jawBand = smoothMask((ny - 0.08) / 0.62) * smoothMask(1 - Math.abs(nx) / 0.86) * face;
      dx -= Math.sign(nx) * jawBand * radius * 0.07 * power * presetFactor;
      dy -= jawBand * radius * 0.018 * power;

      const cheekCut = Math.exp(-((ny - 0.1) ** 2) / 0.12) * smoothMask((Math.abs(nx) - 0.22) / 0.46) * face;
      dx += Math.sign(nx) * cheekCut * radius * 0.035 * power;

      const chinWeight = Math.exp(-((ny - 0.62) ** 2) / 0.055) * smoothMask(1 - Math.abs(nx) / 0.48);
      dy -= chinWeight * radius * 0.045 * power * presetFactor;

      const sourceX = clamp(x + dx, 0, width - 1);
      const sourceY = clamp(y + dy, 0, height - 1);
      const index = (y * width + x) * 4;
      dst[index] = sampleBilinear(src, width, height, sourceX, sourceY, 0);
      dst[index + 1] = sampleBilinear(src, width, height, sourceX, sourceY, 1);
      dst[index + 2] = sampleBilinear(src, width, height, sourceX, sourceY, 2);
      dst[index + 3] = src[index + 3];
    }
  }

  ctx.putImageData(output, 0, 0);
};

const burnSoftEllipse = (cx, cy, rx, ry, opacity, mode = "multiply") => {
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
  gradient.addColorStop(0, `rgba(0,0,0,${opacity})`);
  gradient.addColorStop(0.72, `rgba(0,0,0,${opacity * 0.28})`);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalCompositeOperation = mode;
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
};

const drawMenaceShadows = (amount, menaceAmount) => {
  const width = canvas.width;
  const height = canvas.height;
  const cx = width * (Number(faceX.value) / 100);
  const cy = height * (Number(faceY.value) / 100);
  const radius = Math.min(width, height) * (Number(faceScale.value) / 100);
  const power = amount * menaceAmount;

  burnSoftEllipse(cx - radius * 0.23, cy - radius * 0.12, radius * 0.2, radius * 0.09, 0.11 * power);
  burnSoftEllipse(cx + radius * 0.23, cy - radius * 0.12, radius * 0.2, radius * 0.09, 0.11 * power);
  burnSoftEllipse(cx, cy + radius * 0.32, radius * 0.34, radius * 0.2, 0.06 * power);
};

const drawPortraitLighting = (amount, menaceAmount) => {
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
  vignette.addColorStop(0, "rgba(255,255,255,0)");
  vignette.addColorStop(0.52, "rgba(0,0,0,0)");
  vignette.addColorStop(1, `rgba(0,0,0,${0.2 * amount * backgroundFactor})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  const upperShadow = ctx.createLinearGradient(0, height * 0.18, 0, height * 0.48);
  upperShadow.addColorStop(0, `rgba(0,0,0,${0.08 * amount})`);
  upperShadow.addColorStop(0.48, `rgba(0,0,0,${(0.035 + menaceAmount * 0.035) * amount})`);
  upperShadow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = upperShadow;
  ctx.fillRect(0, 0, width, height);

  const sideBurn = ctx.createLinearGradient(0, 0, width, 0);
  sideBurn.addColorStop(0, `rgba(0,0,0,${0.12 * amount * backgroundFactor})`);
  sideBurn.addColorStop(0.28, "rgba(0,0,0,0)");
  sideBurn.addColorStop(0.72, "rgba(0,0,0,0)");
  sideBurn.addColorStop(1, `rgba(0,0,0,${0.12 * amount * backgroundFactor})`);
  ctx.fillStyle = sideBurn;
  ctx.fillRect(0, 0, width, height);

  ctx.globalCompositeOperation = "source-over";
};

const applyPixels = (amount, menaceAmount) => {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const contrast = 1 + amount * 0.1 + menaceAmount * 0.06;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    r = (r - 128) * contrast + 128;
    g = (g - 128) * contrast + 128;
    b = (b - 128) * contrast + 128;

    data[i] = clamp(r, 0, 255);
    data[i + 1] = clamp(g, 0, 255);
    data[i + 2] = clamp(b, 0, 255);
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
  const menaceAmount = Number(menacePower.value) / 100;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(sourceImage, dim.sx, dim.sy, dim.sw, dim.sh, 0, 0, dim.width, dim.height);

  transformFaceShape(amount, menaceAmount);
  applyPixels(amount, menaceAmount);
  addClarity(menaceAmount * amount);
  sharpen(menaceAmount * amount);
  if (!identitySafe.checked) {
    ctx.filter = `contrast(${1 + amount * 0.1})`;
    ctx.drawImage(canvas, 0, 0);
    ctx.filter = "none";
  }
  drawMenaceShadows(amount, menaceAmount);
  drawPortraitLighting(amount, menaceAmount);
};

const updateCopy = () => {
  const value = Number(intensity.value);
  intensityValue.value = value;
  menaceValue.value = Number(menacePower.value);
  const presetBonus = preset === "enforcer" ? 11 : preset === "executive" ? 6 : 0;
  const safePenalty = identitySafe.checked ? 0 : 5;
  const menaceBonus = Number(menacePower.value) * 0.1;
  const score = Math.max(8, Math.min(98, Math.round(value * 0.78 + menaceBonus + presetBonus - safePenalty + 19)));
  avoidanceScore.textContent = `${score}%`;
  meterFill.style.width = `${score}%`;
};

input.addEventListener("change", (event) => loadFile(event.target.files[0]));
intensity.addEventListener("input", render);
menacePower.addEventListener("input", render);
identitySafe.addEventListener("change", render);
backgroundMute.addEventListener("change", render);
badgeCrop.addEventListener("change", render);
faceX.addEventListener("input", render);
faceY.addEventListener("input", render);
faceScale.addEventListener("input", render);
resetFace.addEventListener("click", () => {
  faceX.value = 50;
  faceY.value = 43;
  faceScale.value = 42;
  render();
});

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
