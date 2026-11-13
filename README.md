# Facewall for Home Assistant

Watch faces for a wall-mounted iPad, with your Home Assistant devices one swipe away.

- **7 faces**: Classic, Numerals, Hourglow, Roman, Digital, Flip and Lamp. Each one can be customized. Hold the clock to switch faces.
- **Tap the face** to toggle a light, switch or scene. Show a sensor (e.g. outside temperature) in a corner.
- **Home page**: AC/heating with modes and temperature, water heater with 15/30/45/60-minute timers, door lock (tap twice to unlock), light tiles in each light's real colour, "All lights off", switches, covers, scenes and sensors.
- **Your layout**: give each tile its own width and height in grid columns/rows (drag to resize in Edit layout mode), and choose how many columns and rows fit on the screen.
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
Open `http://homeassistant.local:8099` in Safari, then **Share → Add to Home Screen**, and launch it from the icon.
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

## How it works

- `facewall/server/server.js`: a small Node server with no dependencies. It holds one WebSocket connection to Home Assistant, streams state changes to the iPad, runs the on-for-N-minutes timers, and saves settings in `/data`.
- `facewall/www/`: the iPad app (plain HTML/CSS/JS, no build step). If it can't reach the server, it runs in demo mode with pretend devices.
