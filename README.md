# Facewall for Home Assistant

Watch faces for a wall-mounted iPad, with your Home Assistant devices one swipe away.

- **12 faces**: Classic, Numerals, Hourglow, Roman, Starburst, Atomic, Confetti, Digital, Modular, Word clock, Flip and Lamp, with live Home Assistant info in all four corners. Each one can be customized. Hold the clock to switch faces.
- **Tap the face** to toggle a light, switch or scene. Show a sensor (e.g. outside temperature) in a corner.
- **Home page**: AC/heating with modes and temperature, water heater with 15/30/45/60-minute timers, door lock (tap twice to unlock), light tiles in each light's real colour, "All lights off", switches, covers, scenes and sensors.
- **Room pages**: swipe Clock → Home → Living Room → Kitchen…, each page with its own tiles and grid. Make a room page from a Home Assistant area in one tap.
- **Several iPads**: each one remembers its own start page and clock face.
- **Media**: album-art tiles for speakers and TVs with play controls and volume, and a full player.
- **Cameras & doorbell**: camera tiles with live view, and a full-screen doorbell pop-up on every iPad with the camera and an Unlock button.
- **Calendar, graphs & scenes**: agenda tiles from your calendars, sensor graphs (with energy today), and a scenes row.
- **Weather**: live forecast tiles that adapt to their size, with hourly and daily detail.
- **Icons & styles**: Home Assistant/Material Design icons (7,000+), Phosphor, Material Symbols, Tabler and Font Awesome Free, bundled (35,000+ in all), plus an online search of 200,000+ open-source icons that saves what you pick; add your own Font Awesome Pro icons as SVGs; custom names, and per-tile styles: a light can be a quick switch, full colour/dim/effects/scenes controls, or a timer. Add the same device as many times as you like.
- **Tile colours**: a solid colour or gradient per tile, for on and off; works on the thermostat and weather tiles too.
- **Full screen in Home Assistant**: hide Home Assistant's sidebar and top bar on the iPads you choose.
- **Page header**: pick what shows under each page's title (greeting, date, weather, high/low, wind, rain, sunrise/sunset, storm and hurricane warnings, sensors, your own text), with your choice of font, size and colour.
- **Themes**: 18 themes (dark, pastel and electric) with a live preview picker; use one for the whole house or a different one per iPad.
- **Living backgrounds**: gentle rain, snow, clouds, fog or stars behind the tiles that match the weather outside, plus seasonal blossoms, leaves and snow.
- **TV remote and Music Assistant**: a touchpad remote for Apple TV, Roku, Android/Fire TV, LG, Samsung and Sony, and a Music Assistant tile to browse, search, queue and group speakers.
- **Styles × themes**: draw the tiles like Apple Home, Material You (Android), liquid glass or Facewall Bold, in any of 30 colour themes, with adjustable transparency, blur and corners.
- **Sections**: a menu down the left of a page (Lights, Climate, Media…), each with its own tiles, filled from the room in one tap.
- **Fun faces**: sunrise & sunset dial, a live weather sky, an airport departure board, lava lamp, aquarium, family, countdowns and word clocks.
- **Photo frame**: after a while on the clock, a slideshow from your Home Assistant media folder with the time in the corner.
- **Your layout**: give each tile its own width and height in grid columns/rows (drag to resize in Edit layout mode), and choose how many columns and rows fit on the screen.
- **Screen care**: screen off when the room is empty and wake on motion, a night theme per iPad, and burn-in protection.
- Live updates, settings shared across every screen, night dimming, return-to-clock after idle.

---

## Install (Home Assistant OS)

Home Assistant calls add-ons **Apps** (since 2026.2). Pick **one** of these:

### Option A: from your own GitHub repo (easiest updates)
1. Create a new **public** GitHub repository and upload everything in this folder: `repository.yaml`, `README.md` and the `facewall/` folder.
2. In Home Assistant: **Settings → Apps → Install app → ⋮ (top right) → Repositories**, paste your repo URL, then **Add**.
3. Find **Facewall** in the list, then **Install → Start**. Turn on **Show in sidebar** if you like.

### Option B: local install, no GitHub needed
1. Install the **Samba share** app (or **Advanced SSH & Web Terminal**) if you don't have one.
2. Copy the `facewall/` folder into the **`local_apps`** share (older name: `addons`), so you end up with `local_apps/facewall/config.yaml`.
   On a Mac: Finder → Go → Connect to Server → `smb://homeassistant.local`, using the Samba app's username and password.
3. **Settings → Apps → Install app → ⋮ → Check for updates**. Facewall appears under **Local apps**.
4. **Install → Start**.

The first build takes a minute or two while it downloads Node.

### Then, on the iPad
Open `http://homeassistant.local:8099` in Safari (or the port you set in the app's Network settings), then **Share → Add to Home Screen**, and launch it from the icon.
Set **Auto-Lock → Never** and keep it on a charger. See `facewall/DOCS.md` for tips.

---

## Running without Home Assistant OS (Container / Core installs)

Facewall runs on its own if you give it a long-lived access token
(Home Assistant: your **Profile → Security → Long-lived access tokens**):

```bash
cd facewall
docker build -t facewall .
docker run -d --name facewall --restart unless-stopped -p 8099:8099 \
  -e HA_URL=http://192.168.1.10:8123 \
  -e HA_TOKEN=YOUR_LONG_LIVED_TOKEN \
  -v facewall-data:/data \
  facewall
```

Or with Node 22+ directly: `HA_URL=… HA_TOKEN=… node server/server.js`.
For the photo frame outside Home Assistant, also mount a photo folder and set `PHOTOS_DIR` (e.g. `-v ~/Pictures:/photos:ro -e PHOTOS_DIR=/photos`).

## How it works

- `facewall/server/server.js`: a small Node server with no dependencies. It holds one WebSocket connection to Home Assistant, streams state changes to the iPad, runs the on-for-N-minutes timers, and saves settings in `/data`.
- `facewall/www/`: the iPad app (plain HTML/CSS/JS, no build step). If it can't reach the server, it runs in demo mode with pretend devices.

## Icon credits

Bundled icon sets keep their own licences; the full texts are in `facewall/www/icons/`:
[Material Design Icons](https://pictogrammers.com/library/mdi/) (Apache 2.0),
[Font Awesome Free](https://fontawesome.com) (icons CC BY 4.0),
[Phosphor](https://phosphoricons.com) (MIT),
[Material Symbols](https://fonts.google.com/icons) (Apache 2.0) and
[Tabler Icons](https://tabler.io/icons) (MIT). Online search uses the free [Iconify](https://iconify.design) API.
The Retro style uses the [VT323](https://fonts.google.com/specimen/VT323) font (SIL Open Font License 1.1; licence in `facewall/www/fonts/`).
