# Mockup Exporter

A small web app for placing a screen recording inside a device mockup and exporting the result as a video.

## Run

```sh
npm start
```

Then open `http://localhost:4173`.

If that port is already in use:

```sh
npm run start:4174
```

Then open `http://localhost:4174`.

## Notes

- Fast export is handled locally with FFmpeg and downloads an `.mp4`.
- If the FFmpeg server is unavailable, the app falls back to browser-only WebM export with Canvas and MediaRecorder.
- No uploaded video leaves your machine.
