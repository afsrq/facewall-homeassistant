# Changelog

## 1.9.0
- **Tile colours**: give any tile its own background for when it's on and when it's off (for locks: unlocked/locked; the thermostat: running/off; weather and sensors: one background). Pick a solid colour, a ready-made gradient, or a gradient from two colours of your own. Text and icons switch to dark or light automatically so they stay readable. *Use on all … tiles* copies the colours to the other tiles like it on the page.
- Lights that are on in plain white now stand out on light themes: they use the theme's "on" colour instead of white-on-white. Pastel themes have stronger "on" colours.
- **Hide Home Assistant's sidebar and top bar** (⚙︎ → This screen) when Facewall is opened inside Home Assistant, per iPad. *Home Assistant menu → Open* brings the sidebar back as an overlay.

## 1.8.0
- **Themes**: 18 themes for the pages, in three groups: Dark (Glass, Midnight, Carbon, Forest, Plum), Pastel (Linen, Sage, Fog, Rose clay, Lagoon, Lilac, Apricot) and Electric (Coral, Bubblegum, Ultraviolet, Lime, Mint, Ink). ⚙︎ → *Appearance* → *Change…* opens a picker with a live preview of real tiles. You can try a theme on the whole screen, then apply it to **only this iPad** or to **all screens**. The clock faces keep their own look.
- Edit layout controls stay readable on light themes.

## 1.7.0
- Free tile sizes: width and height in steps of 0.1 (e.g. 1.5 × 0.5), from 0.2 up to the page's columns / 6 rows. Sliders with − / + in Options; dragging the corner handle snaps to 0.1 (whole and half sizes are a little sticky).
- Tile Options can move a tile earlier/later; very small tiles get compact edit controls.

## 1.6.0
- **Weather tile** with live forecasts from your Home Assistant weather entity. It adapts to its size: current conditions, a daily or hourly forecast strip, or a day list with temperature bars on tall tiles. Tap it for the next 24 hours, the next days, and details (feels like, humidity, wind…).
- **Name position** per tile: bottom, under the icon, or above the icon. Works with the icon top left, top right or in the middle.
- **Tap the clock** to jump to this iPad's page (⚙︎ → This screen → *Tap the clock to*). Faces with their own tap action (like Lamp) keep it unless you choose otherwise.
- **Font Awesome**: the Free set (2,100+ icons: solid, regular, brands) is bundled. Add your own **Font Awesome Pro** (or any) icons by uploading SVGs in the icon picker, or by putting them in Home Assistant's `custom_icons` folder; use them as `fapro:name` (same naming as hass-fontawesome).
- The app now has read-only access to your Home Assistant config folder, only to read `custom_icons`.

## 1.5.0
- Icon position per tile: top left, top right, or in the middle.
- Icon size per tile: 50%–300%. Icons never grow so big that they push the tile's name out of view.

## 1.4.0
- Icons: tiles use each device's Home Assistant icon automatically, and you can pick any of 7,000+ Material Design Icons per tile (searchable). Icons are bundled, so no internet needed.
- Add the same device more than once, e.g. a group as a quick on/off switch *and* as full controls.
- Tile styles for lights: Light (tap on/off, hold for controls), Quick switch, Controls (tap opens the pop-up), Timer. Switches: Switch or Timer.
- Custom tile names.
- Light pop-up: brightness, colour presets plus any colour, white-temperature slider, effects (WLED/Hue/etc.), and that room's scenes.
- New **Options** button on every tile in Edit layout: name, style, icon, size, add a copy, remove.
- Faster loading: the server compresses files and the iPad only re-downloads what changed.

## 1.3.0
- Works with a mouse and keyboard, so you can set it up from a computer: page arrows and clickable dots, a toolbar on the clock (Change face, Customize, Pages, Settings), right-click instead of hold, a ⋯ button on light tiles, arrows/scroll wheel in the face picker.
- Keys: ← → switch pages, Esc closes the top panel, Enter picks a face in the picker.
- Moving the mouse or typing counts as activity, so it won't jump back to the clock while you edit.

## 1.2.0
- Room pages: as many pages as you like, each with its own tiles, sizes and grid. Swipe between them from the clock.
- Add a room page from a Home Assistant area: it's pre-filled with that area's devices.
- Per-iPad settings: each screen has its own name, start page and clock face. Add `?screen=name` to the address to make them permanent.
- Existing setups move to a single "Home" page automatically.

## 1.1.0
- Resizable tiles: set each tile's width (columns) and height (rows), by dragging in Edit layout mode or in Settings.
- Choose how many columns and rows make up the grid.
- Tiles scale their text and icons with their size; small tiles hide extras that don't fit.
- "All lights off" is now a normal tile you can move and resize.
- The server reconnects reliably after Home Assistant restarts.

## 1.0.0
- First release: 7 watch faces, face picker and gallery, Home page with climate, timers, locks and lights.
