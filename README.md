# Mockup Exporter

A small static web app for placing a screen recording inside a device mockup and exporting the result as a WebM video.

## Run

```sh
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Notes

- Export is handled locally in the browser with Canvas and MediaRecorder.
- The app exports `.webm` because browsers do not reliably provide MP4 encoding without a server-side encoder such as FFmpeg.
- No uploaded video leaves the browser.
# Mockup-Video-exporter-web-app
