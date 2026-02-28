# Mini Stellarium Web App

A browser-based, zero-dependency star-map inspired by Stellarium.

## Features

- Real-time animated sky dome with:
  - procedurally generated stars
  - simulated planet markers (Mercury, Venus, Mars, Jupiter, Saturn)
  - horizon and altitude/azimuth grid
- Observer controls:
  - latitude and longitude sliders
  - time speed slider
  - star density slider
- Interactive camera:
  - drag to pan (heading/pitch)
  - mouse wheel to zoom (field of view)
- Live status panel showing UTC time, view orientation, and local sidereal time.

## Run locally

Because this app uses plain HTML/CSS/JS, you can serve it from any static server.

```bash
python3 -m http.server 4173
```

Then open:

```text
http://localhost:4173
```
