const els = {
  canvas: document.querySelector("#previewCanvas"),
  form: document.querySelector("#mockupForm"),
  videoInput: document.querySelector("#videoInput"),
  sourceVideo: document.querySelector("#sourceVideo"),
  videoMeta: document.querySelector("#videoMeta"),
  exportStatus: document.querySelector("#exportStatus"),
  exportProgress: document.querySelector("#exportProgress"),
  downloadLink: document.querySelector("#downloadLink"),
  exportButton: document.querySelector("#exportButton"),
  deviceSelect: document.querySelector("#deviceSelect"),
  modelSelect: document.querySelector("#modelSelect"),
  fitMode: document.querySelector("#fitMode"),
  backgroundColor: document.querySelector("#backgroundColor"),
  backgroundHex: document.querySelector("#backgroundHex"),
  backgroundImage: document.querySelector("#backgroundImage"),
  exportPreset: document.querySelector("#exportPreset"),
  resolutionScale: document.querySelector("#resolutionScale"),
  watermarkToggle: document.querySelector("#watermarkToggle"),
};

const previewContext = els.canvas.getContext("2d", { alpha: false });

const exportPresets = {
  instagramPost: { label: "Instagram Post", width: 1080, height: 1080 },
  instagramStory: { label: "Story/Reel", width: 1080, height: 1920 },
  landscape: { label: "Landscape", width: 1920, height: 1080 },
  portrait: { label: "Portrait", width: 1080, height: 1350 },
};

const deviceProfiles = {
  iphone16: {
    kind: "phone",
    label: "Apple iPhone 16 Plus",
    screen: "1290 x 2796",
    camera: "island",
    ratio: 390 / 806,
  },
  pixel9: {
    kind: "phone",
    label: "Google Pixel 9 Pro",
    screen: "1280 x 2856",
    camera: "hole",
    ratio: 390 / 842,
  },
  ipad: {
    kind: "tablet",
    label: "Apple iPad Pro",
    screen: "2064 x 2752",
    camera: "dot",
    ratio: 620 / 820,
  },
  macbook: {
    kind: "laptop",
    label: "MacBook Pro 14",
    screen: "3024 x 1964",
    camera: "notch",
    ratio: 1.55,
  },
};

const frameColors = {
  black: {
    outer: "#070707",
    mid: "#222220",
    inner: "#10100f",
    highlight: "rgba(255, 255, 255, 0.22)",
    button: "#181817",
  },
  silver: {
    outer: "#d7d4cb",
    mid: "#f1efe8",
    inner: "#171717",
    highlight: "rgba(255, 255, 255, 0.72)",
    button: "#c3c0b7",
  },
  desert: {
    outer: "#b98f70",
    mid: "#d7b18e",
    inner: "#17110e",
    highlight: "rgba(255, 255, 255, 0.52)",
    button: "#a77c5d",
  },
};

const state = {
  videoUrl: null,
  backgroundUrl: null,
  backgroundImage: null,
  drawing: false,
};

function getOptions() {
  const preset = exportPresets[els.exportPreset.value];
  const device = deviceProfiles[els.deviceSelect.value];
  const orientationInput = document.querySelector("input[name='orientation']:checked");
  return {
    preset,
    device,
    deviceKey: els.deviceSelect.value,
    model: els.modelSelect.value,
    orientation: device.kind === "laptop" ? "landscape" : orientationInput.value,
    fitMode: els.fitMode.value,
    backgroundColor: normalizeHex(els.backgroundHex.value) || els.backgroundColor.value,
    backgroundImage: state.backgroundImage,
    watermark: els.watermarkToggle.checked,
  };
}

function normalizeHex(value) {
  const candidate = value.trim();
  return /^#[0-9a-f]{6}$/i.test(candidate) ? candidate : null;
}

function syncCanvasSize() {
  const { preset } = getOptions();
  if (els.canvas.width !== preset.width || els.canvas.height !== preset.height) {
    els.canvas.width = preset.width;
    els.canvas.height = preset.height;
  }
}

function drawPreview() {
  syncCanvasSize();
  drawScene(previewContext, els.canvas, els.sourceVideo, getOptions());
}

function startPreviewLoop() {
  if (state.drawing) return;
  state.drawing = true;

  const tick = () => {
    drawPreview();
    requestAnimationFrame(tick);
  };
  tick();
}

function drawScene(ctx, canvas, video, options) {
  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground(ctx, canvas, options);

  const layout = getDeviceLayout(canvas.width, canvas.height, options);
  if (options.device.kind === "laptop") {
    drawLaptop(ctx, layout, video, options);
  } else {
    drawMobileDevice(ctx, layout, video, options);
  }

  if (options.watermark) {
    drawWatermark(ctx, canvas);
  }
  ctx.restore();
}

function drawBackground(ctx, canvas, options) {
  ctx.fillStyle = options.backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (!options.backgroundImage) return;
  ctx.save();
  ctx.globalAlpha = 0.96;
  drawImageCover(ctx, options.backgroundImage, 0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function getDeviceLayout(width, height, options) {
  const device = options.device;
  const isLandscape = options.orientation === "landscape";
  let naturalWidth;
  let naturalHeight;
  let maxWidth;
  let maxHeight;

  if (device.kind === "laptop") {
    naturalWidth = 980;
    naturalHeight = 650;
    maxWidth = width * 0.78;
    maxHeight = height * 0.58;
  } else if (device.kind === "tablet") {
    naturalWidth = isLandscape ? 840 : 620;
    naturalHeight = isLandscape ? 620 : 840;
    maxWidth = width * (isLandscape ? 0.72 : 0.58);
    maxHeight = height * (isLandscape ? 0.52 : 0.76);
  } else {
    naturalWidth = isLandscape ? 806 : 390;
    naturalHeight = isLandscape ? 390 : 806;
    maxWidth = width * (isLandscape ? 0.76 : 0.55);
    maxHeight = height * (isLandscape ? 0.46 : 0.78);
  }

  const scale = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight);
  const frameWidth = naturalWidth * scale;
  const frameHeight = naturalHeight * scale;
  const x = (width - frameWidth) / 2;
  const y = (height - frameHeight) / 2;
  return { x, y, width: frameWidth, height: frameHeight, scale };
}

function drawMobileDevice(ctx, layout, video, options) {
  const colors = frameColors[options.model] || frameColors.black;
  const isTablet = options.device.kind === "tablet";
  const isLandscape = options.orientation === "landscape";
  const radius = isTablet ? layout.width * 0.075 : layout.width * (isLandscape ? 0.075 : 0.155);
  const inset = isTablet ? layout.width * 0.045 : layout.width * 0.045;
  const screen = {
    x: layout.x + inset,
    y: layout.y + inset * (isLandscape ? 1 : 1.12),
    width: layout.width - inset * 2,
    height: layout.height - inset * (isLandscape ? 2 : 2.18),
  };
  const screenRadius = isTablet ? screen.width * 0.045 : screen.width * (isLandscape ? 0.055 : 0.12);

  drawDeviceButtons(ctx, layout, colors, isLandscape);
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.28)";
  ctx.shadowBlur = layout.width * 0.07;
  ctx.shadowOffsetY = layout.height * 0.025;
  roundedRect(ctx, layout.x, layout.y, layout.width, layout.height, radius);
  ctx.fillStyle = colors.outer;
  ctx.fill();
  ctx.restore();

  const edgeGradient = ctx.createLinearGradient(layout.x, layout.y, layout.x + layout.width, layout.y);
  edgeGradient.addColorStop(0, colors.outer);
  edgeGradient.addColorStop(0.12, colors.highlight);
  edgeGradient.addColorStop(0.5, colors.mid);
  edgeGradient.addColorStop(0.9, colors.outer);
  roundedRect(ctx, layout.x + inset * 0.18, layout.y + inset * 0.18, layout.width - inset * 0.36, layout.height - inset * 0.36, radius * 0.92);
  ctx.fillStyle = edgeGradient;
  ctx.fill();

  roundedRect(ctx, screen.x - inset * 0.22, screen.y - inset * 0.22, screen.width + inset * 0.44, screen.height + inset * 0.44, screenRadius * 1.1);
  ctx.fillStyle = colors.inner;
  ctx.fill();

  drawVideoInside(ctx, screen, screenRadius, video, options.fitMode);
  drawScreenGlass(ctx, screen, screenRadius);

  if (options.device.camera === "island") {
    drawDynamicIsland(ctx, screen, isLandscape);
  } else if (options.device.camera === "hole") {
    drawCameraHole(ctx, screen, isLandscape);
  } else {
    drawTabletCamera(ctx, layout, isLandscape);
  }
}

function drawDeviceButtons(ctx, layout, colors, isLandscape) {
  const buttonDepth = Math.max(2, layout.width * 0.008);
  const longButton = layout.height * 0.12;
  const shortButton = layout.height * 0.075;
  ctx.fillStyle = colors.button;

  if (isLandscape) {
    roundedRect(ctx, layout.x + layout.width * 0.18, layout.y - buttonDepth, longButton, buttonDepth * 2, buttonDepth);
    ctx.fill();
    roundedRect(ctx, layout.x + layout.width * 0.68, layout.y + layout.height - buttonDepth, shortButton, buttonDepth * 2, buttonDepth);
    ctx.fill();
    return;
  }

  roundedRect(ctx, layout.x - buttonDepth, layout.y + layout.height * 0.22, buttonDepth * 2, shortButton, buttonDepth);
  ctx.fill();
  roundedRect(ctx, layout.x - buttonDepth, layout.y + layout.height * 0.34, buttonDepth * 2, longButton, buttonDepth);
  ctx.fill();
  roundedRect(ctx, layout.x + layout.width - buttonDepth, layout.y + layout.height * 0.28, buttonDepth * 2, longButton, buttonDepth);
  ctx.fill();
}

function drawLaptop(ctx, layout, video, options) {
  const colors = frameColors[options.model] || frameColors.black;
  const screenFrameHeight = layout.height * 0.76;
  const screenRadius = layout.width * 0.028;
  const bezel = layout.width * 0.028;
  const screen = {
    x: layout.x + bezel,
    y: layout.y + bezel,
    width: layout.width - bezel * 2,
    height: screenFrameHeight - bezel * 1.85,
  };

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.22)";
  ctx.shadowBlur = layout.width * 0.045;
  ctx.shadowOffsetY = layout.height * 0.05;
  roundedRect(ctx, layout.x, layout.y, layout.width, screenFrameHeight, screenRadius);
  ctx.fillStyle = colors.outer;
  ctx.fill();
  ctx.restore();

  roundedRect(ctx, layout.x + 4, layout.y + 4, layout.width - 8, screenFrameHeight - 8, screenRadius * 0.82);
  ctx.fillStyle = colors.inner;
  ctx.fill();

  drawVideoInside(ctx, screen, layout.width * 0.01, video, options.fitMode);
  drawScreenGlass(ctx, screen, layout.width * 0.01);

  drawLaptopNotch(ctx, layout);
  drawLaptopBase(ctx, layout, colors, screenFrameHeight);
}

function drawLaptopBase(ctx, layout, colors, screenFrameHeight) {
  const baseY = layout.y + screenFrameHeight - layout.height * 0.006;
  const baseHeight = layout.height * 0.19;
  const lipHeight = layout.height * 0.035;
  const sideInset = layout.width * 0.085;

  ctx.beginPath();
  ctx.moveTo(layout.x + sideInset, baseY);
  ctx.lineTo(layout.x + layout.width - sideInset, baseY);
  ctx.lineTo(layout.x + layout.width, baseY + baseHeight);
  ctx.lineTo(layout.x, baseY + baseHeight);
  ctx.closePath();

  const baseGradient = ctx.createLinearGradient(0, baseY, 0, baseY + baseHeight);
  baseGradient.addColorStop(0, colors.mid);
  baseGradient.addColorStop(0.65, colors.outer);
  baseGradient.addColorStop(1, "#a9a79f");
  ctx.fillStyle = baseGradient;
  ctx.fill();

  roundedRect(ctx, layout.x + layout.width * 0.38, baseY + lipHeight, layout.width * 0.24, layout.height * 0.026, layout.height * 0.012);
  ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
  ctx.fill();
}

function drawVideoInside(ctx, rect, radius, video, fitMode) {
  ctx.save();
  roundedRect(ctx, rect.x, rect.y, rect.width, rect.height, radius);
  ctx.clip();

  if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth && video.videoHeight) {
    if (fitMode === "contain") {
      drawImageContain(ctx, video, rect.x, rect.y, rect.width, rect.height);
    } else {
      drawImageCover(ctx, video, rect.x, rect.y, rect.width, rect.height);
    }
  } else {
    drawPlaceholder(ctx, rect);
  }

  ctx.restore();
}

function drawPlaceholder(ctx, rect) {
  const gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.width, rect.y + rect.height);
  gradient.addColorStop(0, "#2c2f31");
  gradient.addColorStop(1, "#181a1c");
  ctx.fillStyle = gradient;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(1, rect.width * 0.0025);
  const step = rect.width / 6;
  for (let x = rect.x + step; x < rect.x + rect.width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, rect.y);
    ctx.lineTo(x, rect.y + rect.height);
    ctx.stroke();
  }
  for (let y = rect.y + step; y < rect.y + rect.height; y += step) {
    ctx.beginPath();
    ctx.moveTo(rect.x, y);
    ctx.lineTo(rect.x + rect.width, y);
    ctx.stroke();
  }
  ctx.restore();

  const size = Math.min(rect.width, rect.height) * 0.12;
  ctx.beginPath();
  ctx.moveTo(rect.x + rect.width / 2 - size * 0.32, rect.y + rect.height / 2 - size * 0.48);
  ctx.lineTo(rect.x + rect.width / 2 - size * 0.32, rect.y + rect.height / 2 + size * 0.48);
  ctx.lineTo(rect.x + rect.width / 2 + size * 0.52, rect.y + rect.height / 2);
  ctx.closePath();
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  ctx.fill();
}

function drawScreenGlass(ctx, rect, radius) {
  ctx.save();
  roundedRect(ctx, rect.x, rect.y, rect.width, rect.height, radius);
  ctx.clip();
  const shine = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.width * 0.82, rect.y + rect.height * 0.45);
  shine.addColorStop(0, "rgba(255, 255, 255, 0.18)");
  shine.addColorStop(0.34, "rgba(255, 255, 255, 0.03)");
  shine.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = shine;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.restore();
}

function drawDynamicIsland(ctx, screen, isLandscape) {
  const islandWidth = isLandscape ? screen.height * 0.18 : screen.width * 0.26;
  const islandHeight = isLandscape ? screen.height * 0.045 : screen.width * 0.065;
  const x = isLandscape ? screen.x + screen.width * 0.055 : screen.x + (screen.width - islandWidth) / 2;
  const y = isLandscape ? screen.y + (screen.height - islandHeight) / 2 : screen.y + screen.width * 0.03;

  roundedRect(ctx, x, y, islandWidth, islandHeight, islandHeight / 2);
  ctx.fillStyle = "#050505";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + islandWidth * 0.78, y + islandHeight / 2, islandHeight * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = "#101928";
  ctx.fill();
}

function drawCameraHole(ctx, screen, isLandscape) {
  const radius = Math.min(screen.width, screen.height) * 0.018;
  const x = isLandscape ? screen.x + screen.width * 0.05 : screen.x + screen.width / 2;
  const y = isLandscape ? screen.y + screen.height / 2 : screen.y + screen.width * 0.055;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = "#050505";
  ctx.fill();
}

function drawTabletCamera(ctx, layout, isLandscape) {
  const radius = Math.min(layout.width, layout.height) * 0.008;
  const x = isLandscape ? layout.x + layout.width * 0.035 : layout.x + layout.width / 2;
  const y = isLandscape ? layout.y + layout.height / 2 : layout.y + layout.height * 0.025;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = "#070707";
  ctx.fill();
}

function drawLaptopNotch(ctx, layout) {
  const notchWidth = layout.width * 0.085;
  const notchHeight = layout.height * 0.025;
  roundedRect(ctx, layout.x + (layout.width - notchWidth) / 2, layout.y + layout.height * 0.018, notchWidth, notchHeight, notchHeight * 0.45);
  ctx.fillStyle = "#030303";
  ctx.fill();
}

function drawWatermark(ctx, canvas) {
  const pad = Math.max(24, canvas.width * 0.032);
  ctx.save();
  ctx.font = `800 ${Math.max(18, Math.round(canvas.width * 0.022))}px Inter, system-ui, sans-serif`;
  ctx.textAlign = "right";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
  ctx.fillText("Mockup", canvas.width - pad, canvas.height - pad);
  ctx.restore();
}

function drawImageCover(ctx, image, x, y, width, height) {
  const sourceWidth = image.videoWidth || image.naturalWidth || image.width;
  const sourceHeight = image.videoHeight || image.naturalHeight || image.height;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawImageContain(ctx, image, x, y, width, height) {
  const sourceWidth = image.videoWidth || image.naturalWidth || image.width;
  const sourceHeight = image.videoHeight || image.naturalHeight || image.height;
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  ctx.fillStyle = "#101112";
  ctx.fillRect(x, y, width, height);
  ctx.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return "unknown";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function updateVideoMeta() {
  const video = els.sourceVideo;
  if (!video.videoWidth || !video.videoHeight) {
    els.videoMeta.textContent = "No video selected";
    return;
  }
  els.videoMeta.textContent = `${video.videoWidth} x ${video.videoHeight} · ${formatDuration(video.duration)}`;
}

function setStatus(message) {
  els.exportStatus.textContent = message;
}

function syncOrientationControls() {
  const isLaptop = els.deviceSelect.value === "macbook";
  const radios = document.querySelectorAll("input[name='orientation']");
  if (isLaptop) {
    document.querySelector("#landscape").checked = true;
  }
  radios.forEach((radio) => {
    radio.disabled = isLaptop;
  });
}

function selectMimeType() {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=h264,opus",
    "video/webm",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function waitForEvent(target, eventName) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      target.removeEventListener(eventName, handleEvent);
      target.removeEventListener("error", handleError);
    };
    const handleEvent = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("Media file could not be loaded."));
    };
    target.addEventListener(eventName, handleEvent, { once: true });
    target.addEventListener("error", handleError, { once: true });
  });
}

async function createExport(event) {
  event.preventDefault();
  if (!state.videoUrl) {
    setStatus("Choose a video first");
    els.videoInput.focus();
    return;
  }
  if (!window.MediaRecorder) {
    setStatus("MediaRecorder is unavailable");
    return;
  }

  const options = getOptions();
  const scale = Number(els.resolutionScale.value);
  const canvas = document.createElement("canvas");
  canvas.width = options.preset.width * scale;
  canvas.height = options.preset.height * scale;
  const ctx = canvas.getContext("2d", { alpha: false });
  const exportVideo = document.createElement("video");
  exportVideo.src = state.videoUrl;
  exportVideo.playsInline = true;
  exportVideo.preload = "auto";
  exportVideo.loop = false;
  exportVideo.muted = false;

  els.exportButton.disabled = true;
  els.downloadLink.hidden = true;
  if (els.downloadLink.dataset.objectUrl) {
    URL.revokeObjectURL(els.downloadLink.dataset.objectUrl);
    delete els.downloadLink.dataset.objectUrl;
  }
  els.exportProgress.value = 0;
  setStatus("Preparing");

  let objectUrl = null;
  let animationFrame = 0;
  let recorder;
  let outputStream;

  try {
    if (exportVideo.readyState < HTMLMediaElement.HAVE_METADATA) {
      await waitForEvent(exportVideo, "loadedmetadata");
    }

    const duration = Number.isFinite(exportVideo.duration) ? exportVideo.duration : 0;
    if (exportVideo.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      await waitForEvent(exportVideo, "loadeddata");
    }

    if (exportVideo.currentTime !== 0) {
      exportVideo.currentTime = 0;
      await waitForEvent(exportVideo, "seeked");
    }

    const mimeType = selectMimeType();
    outputStream = canvas.captureStream(30);
    const capturedSource = exportVideo.captureStream?.() || exportVideo.mozCaptureStream?.();
    capturedSource?.getAudioTracks().forEach((track) => outputStream.addTrack(track));

    const recorderOptions = {
      videoBitsPerSecond: scale > 1 ? 12_000_000 : 7_000_000,
    };
    if (mimeType) recorderOptions.mimeType = mimeType;
    recorder = new MediaRecorder(outputStream, recorderOptions);

    const chunks = [];
    recorder.addEventListener("dataavailable", (chunkEvent) => {
      if (chunkEvent.data.size > 0) chunks.push(chunkEvent.data);
    });

    const stopped = new Promise((resolve, reject) => {
      recorder.addEventListener("stop", resolve, { once: true });
      recorder.addEventListener("error", () => reject(new Error("Recording failed.")), { once: true });
    });

    const stopRecording = () => {
      if (recorder?.state === "recording") recorder.stop();
    };

    const renderFrame = () => {
      drawScene(ctx, canvas, exportVideo, options);
      els.exportProgress.value = duration ? Math.min(exportVideo.currentTime / duration, 1) : 0;

      if (exportVideo.ended || (duration && exportVideo.currentTime >= duration - 0.035)) {
        drawScene(ctx, canvas, exportVideo, options);
        stopRecording();
        return;
      }
      animationFrame = requestAnimationFrame(renderFrame);
    };

    recorder.start(250);
    setStatus("Recording");

    try {
      await exportVideo.play();
    } catch {
      exportVideo.muted = true;
      await exportVideo.play();
    }

    renderFrame();
    await stopped;

    const blob = new Blob(chunks, { type: recorder.mimeType || "video/webm" });
    objectUrl = URL.createObjectURL(blob);
    const fileStamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    els.downloadLink.href = objectUrl;
    els.downloadLink.download = `mockup-${fileStamp}.webm`;
    els.downloadLink.hidden = false;
    els.downloadLink.click();
    els.exportProgress.value = 1;
    setStatus("Export complete");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Export failed");
  } finally {
    cancelAnimationFrame(animationFrame);
    exportVideo.pause();
    outputStream?.getTracks().forEach((track) => track.stop());
    if (objectUrl) {
      els.downloadLink.dataset.objectUrl = objectUrl;
    }
    els.exportButton.disabled = false;
  }
}

els.videoInput.addEventListener("change", async () => {
  const [file] = els.videoInput.files;
  if (!file) return;

  if (state.videoUrl) URL.revokeObjectURL(state.videoUrl);
  state.videoUrl = URL.createObjectURL(file);
  els.sourceVideo.src = state.videoUrl;
  els.sourceVideo.muted = true;
  els.sourceVideo.loop = true;
  setStatus("Loading video");

  try {
    await waitForEvent(els.sourceVideo, "loadedmetadata");
    updateVideoMeta();
    await els.sourceVideo.play();
    setStatus("Ready");
  } catch (error) {
    console.error(error);
    setStatus("Video failed to load");
  }
});

els.backgroundImage.addEventListener("change", () => {
  const [file] = els.backgroundImage.files;
  if (state.backgroundUrl) URL.revokeObjectURL(state.backgroundUrl);
  state.backgroundImage = null;

  if (!file) return;
  state.backgroundUrl = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    state.backgroundImage = image;
  };
  image.src = state.backgroundUrl;
});

els.backgroundColor.addEventListener("input", () => {
  els.backgroundHex.value = els.backgroundColor.value;
});

els.backgroundHex.addEventListener("input", () => {
  const validHex = normalizeHex(els.backgroundHex.value);
  if (validHex) {
    els.backgroundColor.value = validHex;
  }
});

els.deviceSelect.addEventListener("change", () => {
  syncOrientationControls();
  const device = deviceProfiles[els.deviceSelect.value];
  const model = els.modelSelect.value;
  if (device.kind === "laptop" && model === "black") {
    els.modelSelect.value = "silver";
  }
});

els.exportPreset.addEventListener("change", syncCanvasSize);
els.form.addEventListener("input", () => {
  setStatus("Ready");
});
els.form.addEventListener("submit", createExport);

syncOrientationControls();
syncCanvasSize();
startPreviewLoop();
