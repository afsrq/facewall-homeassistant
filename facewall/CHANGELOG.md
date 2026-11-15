# Changelog

## 1.28.0
- **Time as text on the hands-only faces** (Classic, Numerals, Roman, Gradient, Starburst, Atomic, Confetti): customize a face → Time as text. Put it in any corner, above or below the dial (the dial shrinks to make room), and pick the font, size, weight, colour, date underneath and AM/PM. In a corner it shrinks to fit beside the dial, and an info complication in the same corner moves out of its way.

## 1.27.0
- **Photo frame** (Settings → Photo frame, per iPad): after a while on the clock, show a slideshow from a folder in Home Assistant's media (e.g. upload to Media → My media → photos) with a slow pan and zoom and the time, date and temperature in the corner. Choose how long each photo stays, shuffle or by name, fill the screen or show the whole photo. Tap to go back.
- The app now has read-only access to Home Assistant's media and share folders (for the photo frame).

## 1.26.0
- **Living backgrounds**: subtle animated weather behind the tiles that matches outside: rain (with the odd lightning flash in storms), snow, drifting clouds, fog, wind streaks, stars on clear nights and a warm glow when it's sunny. Settings → Appearance → Weather in the background.
- **Seasonal touches**: spring blossoms, autumn leaves and December snow when the weather is calm. Each can be turned off, and **How much** sets the density.

## 1.25.0
- **Six more house styles** in the Architectural theme group, each with its own colours, background pattern and title font: **Craftsman** (oak, olive, ochre and brick with Prairie-style squares), **Spanish Revival** (stucco, terracotta and cobalt tile), **Scandinavian** (airy whites and sage with a soft dot grid), **Art Deco** (navy and gold fans), **Japandi** (greige, wood and wave scales) and **Farmhouse** (white shiplap, black and sage).

## 1.24.0
- **Vacuum tile** (Add tiles → Vacuums): status (cleaning, docked, going home, needs help), battery, and Clean / Pause, Dock and Find; the robot wanders while it cleans.
- **Alarm panel** (Add tiles → Alarm): Arm Home / Away / Night and Disarm, with a keypad when your alarm needs a code. While armed, every screen gets a thin red edge; when triggered, the edges pulse red and the tile turns red.
- **Air quality ring** (sensor → Style → Ring): CO₂, PM2.5, PM10, AQI, VOC, NO₂, ozone and CO as a ring that's green (good), amber (fair) or red (poor).

## 1.23.0
- **Thermostat dial** (climate tile → Style → Dial): drag around the ring to set the temperature; the ring takes the mode's colour (blue cooling, orange heating, green auto), a dot shows the room temperature, and tapping the mode cycles through modes.
- **Garage door** (cover tile → Style → Garage door): an animated door that rolls up as it opens and shows the position while moving. Tap twice to open or close.
- **Person tile** (Add tiles → People): their photo from Home Assistant (or initials) with a green ring when they're home, otherwise Away or the zone they're in.

## 1.22.0
- **Three mid-century faces** (original designs in the spirit of the era), each with walnut, teal, cream, mustard or charcoal dials:
  - **Starburst**: brass rays of alternating lengths radiating from the dial (long & short, even, or with dots).
  - **Atomic**: atomic stars for the hours, an orbit of minute dots, a boomerang seconds hand and boomerangs drifting in the background.
  - **Confetti**: a different shape for every hour (circles, squares, triangles, lozenges, rings) in mustard, teal, orange and coral.

## 1.21.0
- **Modular face**: a big time with four live panels for your Home Assistant info: weather, the next calendar event, a sensor, what's playing…
- **Word clock face**: "It is a quarter to three", lit on a grid of letters, with minute dots; choose the colour, a black, walnut, slate or paper background, and the font.
- **Complications in all four corners** of every face (Customize → Top-left / Top-right / Bottom-left / Bottom-right info), and smarter values: weather shows temperature and conditions, a calendar shows its next event, a media player shows the song.

## 1.20.0
- **Calendar tile**: your Home Assistant calendars as an agenda for today, 3 days or 7 days, with times, places, all-day events and a "Now" tag; past events fade. Add more calendars to the same tile (each gets its own colour). Tap it for the next two weeks.

## 1.19.0
- **Graph tiles**: give any number sensor the *Graph* style (tile Options → Style) to see it over the last 6 hours, 24 hours, 2 days or 7 days, with the current value and the low and high. It keeps drawing live as the value changes. Energy meters (kWh) also show how much since midnight, so a power or energy sensor makes a simple energy tile.

## 1.18.0
- **Show a tile only when it matters** (tile Options → Show the tile): always, only while it's on/open/playing, or depending on another device (on/off, equals, above, below). Hidden tiles free their space; while editing the layout they show faded.
- **Badges** (tile Options → Badge): how long it's been on or open (turns orange after the time you pick, e.g. a door left open), how many lights are on in a light group or the tile's room, or any sensor's value (battery, temperature…).

## 1.17.0
- **Scenes row** (⚙︎ → Tiles on page → Scenes row → Add): one tile with a row of one-tap buttons for scenes, scripts and buttons, each in its own colour (or the theme's). Choose and order the buttons in its Options. Square tiles stack the buttons in two columns.

## 1.16.0
- **Duplicate a tile** with everything about it (size, style, icon, name, colours) from its Options, or **copy it to another page**.
- **Copy a page** (⚙︎ → Pages → copy button): a ready-made starting point for the next room.
- **Backup and restore** (⚙︎ → Backup): download every page, tile, theme, header, screen and doorbell setting plus your uploaded icons as one file, and restore it later.

## 1.15.0
- **Screen off and wake on motion** (⚙︎ → This screen): the screen goes black after 5 min – 1 hour with nobody touching it or moving in the room, and a Home Assistant motion or presence sensor wakes it (it also stays on while the sensor sees someone). Tap to wake; choose whether it wakes to the clock, this iPad's page, or where it was. The doorbell wakes it too.
- **Night theme per iPad** (⚙︎ → Appearance): switch to another theme (e.g. Walnut or Desert Dusk) at sunset and back at sunrise, or at set times.
- **Burn-in protection** (on by default): everything moves by a few pixels every few minutes, so nothing stays in one spot on a screen that's on all day.

## 1.14.0
- **Camera tile**: a snapshot that refreshes every 10 seconds while it's on screen; tap for the live view.
- **Doorbell pop-up** (⚙︎ → Doorbell pop-up): when your doorbell button, event or sensor rings, every iPad wakes, leaves the clock and shows the camera full screen with **Unlock the door** (tap twice) and **Dismiss**. It closes by itself after the time you choose; turn it off per iPad. *Try it* shows the pop-up without anyone ringing.
- Camera pictures and live video come through Facewall's server, so the iPads don't need to log in to Home Assistant.

## 1.13.0
- **Media player tile** (speakers, TVs, Spotify, AirPlay…): album art fills the tile, with title, artist, previous / play-pause / next, volume and a progress line. It adapts to its size: a small tile keeps just the art and play button. Tap it for the full player: big artwork, progress with times, controls, volume and mute, source and power.
- Album art comes through Facewall's server, so it works on the iPads without logging in to Home Assistant.
- Softer breeze-block pattern on the Palm Springs theme.

## 1.12.0
- **Architectural themes**, matched to the style of the house, each with its own colours, a subtle background pattern and a title font: **Mid-century** (cream, mustard and teal), **Walnut** (dark wood), **Atomic** (mint and orange) with atomic starbursts and boomerangs in Futura; **Palm Springs** (blush, flamingo and turquoise), **Desert Pool** (turquoise and sunny yellow) and **Desert Dusk** (plum and pink) with a breeze-block pattern in Avenir Next. A title font you choose in the page header still wins.

## 1.11.0
- **Page header**: choose what the line under the title shows and in what order: greeting (with your name, or your own words), date format, weather now, today's high and low, feels like, chance of rain, wind, humidity, next sunrise/sunset, weather warnings, sensors and your own text. Hold the title on any page to change it.
- **Weather warnings**: orange tags for thunderstorms, hail, heavy rain, extreme weather and very strong wind, plus any alert sensor (NWS Alerts, Meteoalarm, Met Office…) while it has an active warning.
- Fonts, size, weight and colour (solid or gradient) for the line; font, size and weight for the title; header height. The header grows when its text needs more room.
- The header's weather gets its forecast even when no page has a weather tile.

## 1.10.0
- **More icons**: Phosphor (MIT, 6 styles incl. duotone), Material Symbols (Apache 2.0; rounded, standard and sharp, filled or outline) and Tabler (MIT, outline and filled) are now built in, each with its own tab and style buttons. Sets load only when a tile or the picker uses them.
- **Search online**: search 200,000+ open-source icons from Iconify. The icon you pick is saved in Facewall, so the iPads don't need the internet afterwards. Icons from the built-in sets are used directly.
- Your own icons can now be line icons (stroke) and can use masks or gradients; animated icons are kept in their final state.

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
