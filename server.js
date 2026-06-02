import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";

const rootDir = resolve(import.meta.dirname);
const port = Number(process.env.PORT || 4173);
const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";
const ffprobePath = process.env.FFPROBE_PATH || "ffprobe";

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webm", "video/webm"],
  [".mp4", "video/mp4"],
]);

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (url.pathname === "/api/status" && req.method === "GET") {
      sendJson(res, { fastExport: true, encoder: "ffmpeg" });
      return;
    }

    if (url.pathname === "/api/export" && req.method === "POST") {
      await handleExport(req, res);
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      sendText(res, 405, "Method not allowed");
      return;
    }

    await serveStatic(url.pathname, req, res);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      sendText(res, 500, error.message || "Server error");
    } else {
      res.destroy(error);
    }
  }
});

server.listen(port, () => {
  console.log(`Mockup Exporter running at http://localhost:${port}`);
});

async function serveStatic(pathname, req, res) {
  const requestedPath = pathname === "/" ? "/index.html" : decodeURIComponent(pathname);
  const filePath = normalize(resolve(rootDir, `.${requestedPath}`));

  if (!filePath.startsWith(rootDir)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      sendText(res, 404, "Not found");
      return;
    }

    res.writeHead(200, {
      "Content-Length": fileStat.size,
      "Content-Type": mimeTypes.get(extname(filePath)) || "application/octet-stream",
    });

    if (req.method === "HEAD") {
      res.end();
      return;
    }

    await pipeline(createReadStream(filePath), res);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendText(res, 404, "Not found");
      return;
    }
    throw error;
  }
}

async function handleExport(req, res) {
  const tempDir = join(tmpdir(), `mockup-export-${randomUUID()}`);
  await mkdir(tempDir, { recursive: true });

  try {
    const form = await parseFormData(req);
    const videoFile = form.get("video");
    const frameFile = form.get("frame");
    const backgroundFile = form.get("background");
    const options = parseOptions(form.get("options"));

    if (!isFileLike(videoFile)) throw new Error("Missing video file.");
    if (!isFileLike(frameFile)) throw new Error("Missing frame overlay.");

    const inputPath = join(tempDir, `source${safeExt(videoFile.name, ".mp4")}`);
    const framePath = join(tempDir, "frame.png");
    const outputPath = join(tempDir, "mockup-export.mp4");
    let backgroundPath = null;

    await writeUploadedFile(videoFile, inputPath);
    await writeUploadedFile(frameFile, framePath);

    if (isFileLike(backgroundFile)) {
      backgroundPath = join(tempDir, `background${safeExt(backgroundFile.name, ".png")}`);
      await writeUploadedFile(backgroundFile, backgroundPath);
    }

    const duration = await probeDuration(inputPath);
    await runFfmpeg({
      backgroundPath,
      duration,
      framePath,
      inputPath,
      options,
      outputPath,
    });

    const outputStat = await stat(outputPath);
    res.writeHead(200, {
      "Content-Length": outputStat.size,
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="mockup-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.mp4"`,
    });
    await pipeline(createReadStream(outputPath), res);
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

async function parseFormData(req) {
  const request = new Request(`http://${req.headers.host || "localhost"}/api/export`, {
    body: Readable.toWeb(req),
    duplex: "half",
    headers: req.headers,
    method: req.method,
  });
  return request.formData();
}

function parseOptions(rawOptions) {
  if (typeof rawOptions !== "string") throw new Error("Missing export options.");
  const parsed = JSON.parse(rawOptions);
  const width = clampInteger(parsed.width, 320, 3840, "width");
  const height = clampInteger(parsed.height, 320, 3840, "height");
  const screen = {
    x: clampInteger(parsed.screen?.x, 0, width, "screen.x"),
    y: clampInteger(parsed.screen?.y, 0, height, "screen.y"),
    width: clampInteger(parsed.screen?.width, 16, width, "screen.width"),
    height: clampInteger(parsed.screen?.height, 16, height, "screen.height"),
  };

  if (screen.x + screen.width > width || screen.y + screen.height > height) {
    throw new Error("Screen rectangle is outside the export canvas.");
  }

  return {
    backgroundColor: normalizeHex(parsed.backgroundColor),
    fitMode: parsed.fitMode === "contain" ? "contain" : "cover",
    height,
    screen,
    width,
  };
}

function clampInteger(value, min, max, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`Invalid ${label}.`);
  return Math.max(min, Math.min(max, Math.round(number)));
}

function normalizeHex(value) {
  const fallback = "768768";
  if (typeof value !== "string") return fallback;
  const normalized = value.replace("#", "").trim();
  return /^[0-9a-f]{6}$/i.test(normalized) ? normalized : fallback;
}

function isFileLike(value) {
  return value && typeof value.arrayBuffer === "function" && typeof value.name === "string";
}

function safeExt(filename, fallback) {
  const ext = extname(filename || "").toLowerCase();
  return /^[a-z0-9.]{1,8}$/.test(ext) ? ext : fallback;
}

async function writeUploadedFile(file, destination) {
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(destination, buffer);
}

async function probeDuration(inputPath) {
  try {
    const output = await runCommand(ffprobePath, [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      inputPath,
    ]);
    const duration = Number.parseFloat(output.stdout.trim());
    return Number.isFinite(duration) && duration > 0 ? duration : null;
  } catch {
    return null;
  }
}

async function runFfmpeg({ backgroundPath, duration, framePath, inputPath, options, outputPath }) {
  const { height, screen, width } = options;
  const durationArgs = duration ? ["-t", String(duration)] : [];
  const args = ["-hide_banner", "-y", "-i", inputPath];

  if (backgroundPath) {
    args.push("-loop", "1", ...durationArgs, "-i", backgroundPath);
  } else {
    args.push("-f", "lavfi", ...durationArgs, "-i", `color=c=0x${options.backgroundColor}:s=${width}x${height}:r=30`);
  }

  args.push("-loop", "1", ...durationArgs, "-i", framePath);

  const backgroundFilter = backgroundPath
    ? `[1:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,format=rgba[bg]`
    : "[1:v]format=rgba[bg]";
  const videoFilter =
    options.fitMode === "contain"
      ? `[0:v]scale=${screen.width}:${screen.height}:force_original_aspect_ratio=decrease,pad=${screen.width}:${screen.height}:(ow-iw)/2:(oh-ih)/2:color=0x101112,setsar=1,format=rgba[screen]`
      : `[0:v]scale=${screen.width}:${screen.height}:force_original_aspect_ratio=increase,crop=${screen.width}:${screen.height},setsar=1,format=rgba[screen]`;
  const filterGraph = [
    backgroundFilter,
    videoFilter,
    `[bg][screen]overlay=${screen.x}:${screen.y}:shortest=1[base]`,
    `[2:v]scale=${width}:${height},format=rgba[frame]`,
    "[base][frame]overlay=0:0:shortest=1,format=yuv420p[v]",
  ].join(";");

  args.push(
    "-filter_complex",
    filterGraph,
    "-map",
    "[v]",
    "-map",
    "0:a?",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    width > 1920 || height > 1920 ? "20" : "21",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-movflags",
    "+faststart",
    "-shortest",
    outputPath,
  );

  await runCommand(ffmpegPath, args);
}

function runCommand(command, args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
      } else {
        reject(new Error(stderr.trim() || `${command} exited with code ${code}`));
      }
    });
  });
}

function sendJson(res, data) {
  const body = JSON.stringify(data);
  res.writeHead(200, {
    "Content-Length": Buffer.byteLength(body),
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(body);
}

function sendText(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Length": Buffer.byteLength(body),
    "Content-Type": "text/plain; charset=utf-8",
  });
  res.end(body);
}
