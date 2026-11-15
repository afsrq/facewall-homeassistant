# Changelog

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
