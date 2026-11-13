# Facewall

Turns a wall-mounted iPad into a watch-face clock with Home Assistant controls one swipe away.

## Getting the iPad set up

1. Start the app, then on the iPad open **Safari** and go to `http://homeassistant.local:8099`
   (or `http://<your-HA-IP>:8099`).
2. Tap **Share → Add to Home Screen**, then open Facewall from the new icon. It runs full screen with no browser bars.
3. On the iPad: **Settings → Display & Brightness → Auto-Lock → Never** (keep it on a charger).
   For a locked-down wall panel, turn on **Guided Access** (Settings → Accessibility).

You can also open Facewall from the Home Assistant sidebar. That goes through your normal Home Assistant login.

## Using it

| Do this | To |
| --- | --- |
| **Hold** the clock | Open the face picker. Swipe to browse, tap the middle one to use it. |
| **Customize** (in the picker) | Change colours/styles, choose what tapping the face does, add info in the corners (e.g. outside temperature). |
| **+** at the end of the picker | Open the Face Gallery and add another face. |
| **Tap** the clock | Run the face's tap action, e.g. toggle a light. |
| **Swipe left** | Your pages, e.g. Home → Living Room → Kitchen. After a minute untouched it goes back to the clock (you can change this). |
| **Hold** a light tile | Brightness, colour and white temperature. |
| Water heater **15 / 30 / 45 / 60** | Turn it on for that many minutes. The app turns it off again, even if the iPad is asleep. |
| ▦ on the Home page (**Edit layout**) | Drag a tile's corner handle to make it wider or taller. Sizes snap to whole columns and rows. ‹ › move a tile, × removes it. Set **Columns** and **Rows** at the bottom to choose how fine the grid is. |
| ⚙︎ on the Home page | Choose tiles, set exact sizes (tap the **1 × 1** badge), add a timer to any switch, grid size, 24-hour time, night dimming. |

Tiles can be 1–8 columns wide and 1–4 rows tall. Bigger tiles get bigger text and icons, and small ones hide extras that won't fit.

Settings are stored in the app, so every iPad or browser showing Facewall stays in sync.

## Room pages and several iPads

- **Pages:** ⚙︎ → *Pages*. Add a **blank page**, or **add a room from an area**: it starts with that Home Assistant area's lights, climate, locks, switches, covers and temperature/humidity sensors. Rename, reorder or delete pages there. Each page has its own tiles, tile sizes and grid.
- **Each iPad has its own settings:** ⚙︎ → *This screen*. Name the iPad (e.g. *Kitchen iPad*) and pick which page it **opens on**. Hold the clock on that iPad to give it **its own clock face**.
- To make those per-iPad settings permanent even if Safari's data is cleared, add the address shown under *This screen* (it ends in `?screen=your-name`) to the iPad's Home Screen.

## Faces

Classic, Numerals, Hourglow, Roman, Digital, Flip, and **Lamp**, a pendant bulb that glows in the real colour and brightness of a light you choose. Tap it to switch the light.

## Port 8099 and security

Port 8099 lets the wall iPad use Facewall **without logging in**, so anyone on your home network can open it and control the devices it shows.
If you'd rather not allow that, clear the port under the app's **Network** settings and use the sidebar instead.
