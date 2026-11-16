# Facewall

Turns a wall-mounted iPad into a watch-face clock with Home Assistant controls one swipe away.

## Getting the iPad set up

1. Start the app, then on the iPad open **Safari** and go to `http://homeassistant.local:8099`
   (or `http://<your-HA-IP>:8099`). 8099 is the default; if you changed the port under the app's **Network** settings (e.g. to 3333), use that number instead.
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

Tiles can be any size in steps of 0.1: from 0.2 up to the page's column count wide and 6 rows tall (e.g. 1.5 × 0.5). Bigger tiles get bigger text and icons, and small ones hide extras that won't fit.

Settings are stored in the app, so every iPad or browser showing Facewall stays in sync.

## Setting it up from a computer

Open `http://homeassistant.local:8099` in any browser. With a mouse, move it to show arrows (‹ ›) and page dots, and on the clock a toolbar with **Change face**, **Customize**, **Pages** and ⚙︎. Right-click does what a long press does. Light tiles show a ⋯ button for brightness and colour. Keyboard: ← → switch pages, Esc closes panels. Changes appear on the iPads straight away.

Tile sizes are in grid columns/rows, so set the page's **Columns** and **Rows** (not *Auto*) if you want the computer and the iPad to show exactly the same layout.

## Tile options: style, icon, name, copies

In **Edit layout** (▦) every tile has an **Options** button (or tap a tile's size badge in ⚙︎ → Tiles):
- **Style:** lights can be *Light* (tap on/off, hold for colour), *Quick switch* (tap on/off only), *Controls* (tap opens colour, dim, effects and scenes) or *Timer*. Switches can be *Switch* or *Timer*.
- **Icon:** search the built-in sets, each with its own tab: Home Assistant's icons (Material Design, 7,000+), **Phosphor** (1,500 icons in 6 styles: regular, thin, light, bold, fill, duotone), **Material Symbols** (Google; rounded, standard and sharp, filled or outline), **Tabler** (6,500, outline and filled) and Font Awesome Free (2,100+). Phosphor and Material Symbols tabs have style buttons; *Every style* shows them all. Without a custom icon, a tile uses the device's Home Assistant icon if it has one.
- **Search online:** the *Search online* tab searches Iconify's 200,000+ open-source icons (Lucide, Fluent, Carbon, Iconoir and many more). The icon you choose is saved in Facewall, under *Your icons*, so the iPads show it without internet. The set's name and licence are shown under each result. Searching needs internet on the device you're using.
- **Font Awesome Pro / your own icons:** in the icon picker choose *Your icons / Pro* → **Upload SVG** (download SVGs from fontawesome.com with your Pro account), or put SVG files in Home Assistant's `custom_icons` folder. They're named `fapro:<file name>`. Pro icons are licensed to you, so they're never included in this repo.
- **Icon position:** top left, top right or the middle of the tile. **Icon size:** 50%–300%.
- **Name position:** bottom, under the icon, or above the icon.
- **Name:** your own label, or leave it empty to use Home Assistant's name.
- **Add another copy:** put the same device on the page again, e.g. "All lights" once as a Quick switch and once as Controls.

When adding tiles, tapping a device that's already on the page adds another copy; use − to remove one.

## Tile colours

In a tile's **Options** (Edit layout → *Options*, or ⚙︎ → Tiles on page), choose its **On colour** and **Off colour**:

- **Default** keeps the normal look (a light's own colour, the theme's colours, the thermostat's mode colour).
- **Solid**: one colour from the palette, or **+** for any colour.
- **Gradient**: a ready-made one, or *Your own* with a start and end colour.

Text and icons turn dark or light to stay readable. *Use on all … tiles* copies the colours to the other tiles of the same kind on that page (e.g. every light).

## Thermostat dial, garage door, people

- **Thermostat dial**: a climate tile's Options → *Style* → **Dial**. Drag the knob around the ring to set the temperature; tap the mode label to switch mode.
- **Garage door**: a cover's Options → *Style* → **Garage door**. Tap twice to open or close it.
- **People**: Add tiles → *People*. Shows each person's photo with a green ring when home.

## Vacuum, alarm, air quality

- **Vacuum** (Add tiles → *Vacuums*): Clean / Pause, Dock and Find, with battery and status.
- **Alarm** (Add tiles → *Alarm*): arm Home, Away or Night and disarm; a keypad appears when a code is needed. Armed screens get a red edge; a triggered alarm makes it pulse.
- **Air quality**: a CO₂, PM2.5, PM10, AQI or VOC sensor's Options → *Style* → **Ring**: green, amber or red by the usual guideline levels.

## Media players

Add a speaker, TV or other media player (Add tiles → *Media*). The tile shows the album art with title, artist, play controls and volume; make it smaller for just the art and a play button. Tap it for the full player with progress, mute, source and power.

## Cameras and the doorbell

- **Camera tiles** (Add tiles → *Cameras*) show a picture that refreshes every 10 seconds while the tile is on screen. Tap one for live video.
- **Doorbell pop-up**: ⚙︎ → *Doorbell pop-up* → pick what rings (a doorbell button or binary sensor, an `event.` entity from a video doorbell, or any helper), the camera to show and, if you like, your door lock. When it rings, every iPad wakes up and shows the camera full screen with **Unlock the door** (tap twice, like the lock tile) and **Dismiss**. It closes by itself after 30 s to 5 min. Turn *Show on this iPad* off for screens that shouldn't pop up (a bedroom, say). **Try it** shows the pop-up so you can check the camera.

## Tiles that appear when needed, and badges

In a tile's Options:
- **Show the tile**: *Always*, *Only when on / open* (e.g. the garage tile only while it's open), or *Depends on…* another device: on/off, *is…* a state (e.g. `home`), or *above / below* a number. Hidden tiles free their space and come back by themselves.
- **Badge**: a small label in the corner: *Time on / open* (with *Turn orange after*), *Lights on* (in a light group, the page for "All lights off", or the tile's room), or *A sensor* (battery, temperature…).

## Copies and backups

- **Duplicate** (a tile's Options): an exact copy next to it. **Copy to another page** puts the same tile on another page.
- **Copy a page** (⚙︎ → *Pages*, the copy button): duplicates the page with all its tiles and grid.
- **Backup** (⚙︎ → *Backup*): *Download* saves everything (pages, tiles, themes, header, screens, doorbell, uploaded icons) in one file; *Restore* puts it back on every screen.

## Calendar

Add a calendar (Add tiles → *Calendars*): Google, iCloud (CalDAV), Local Calendar or any calendar in Home Assistant. Options: **Show** today, 3 days or 7 days, and **Add another calendar** to merge several into one tile, each in its own colour. Tap the tile for the next two weeks.

## Graphs and energy

Any sensor with a number (temperature, humidity, power, energy…) can show a graph: tile Options → **Style → Graph**, then **Time span** (6 h, 24 h, 2 days, 7 days). History comes from Home Assistant's recorder. For energy, use a power sensor (W) for a live usage curve, or an energy meter (kWh), which also shows *+x kWh today*.

## Scenes row

⚙︎ → *Tiles on page* → **Scenes row** → *Add* puts one tile on the page with buttons for your scenes. In its Options, add scenes, scripts or buttons, put them in order, and choose colourful buttons or the theme's colour. Make the tile wide and short for a row, or square for a 2-column grid.

## Weather

Add your weather entity (Add tiles → *Weather*). Make the tile wider for more days, or taller for a day list with temperature bars. Its **Style** chooses a *Daily* or *Hourly* forecast; tap the tile for both.

## Room pages and several iPads

- **Pages:** ⚙︎ → *Pages*. Add a **blank page**, or **add a room from an area**: it starts with that Home Assistant area's lights, climate, locks, switches, covers and temperature/humidity sensors. Rename, reorder or delete pages there. Each page has its own tiles, tile sizes and grid.
- **Each iPad has its own settings:** ⚙︎ → *This screen*. Name the iPad (e.g. *Kitchen iPad*) and pick which page it **opens on**. Hold the clock on that iPad to give it **its own clock face**.
- **Tap the clock to** jump straight to that iPad's page (or keep the face's own tap action).
- To make those per-iPad settings permanent even if Safari's data is cleared, add the address shown under *This screen* (it ends in `?screen=your-name`) to the iPad's Home Screen.

## Themes

⚙︎ → *Appearance* → *Change…*. Pick a theme on the left and the preview on the right shows how the background, cards and switched-on buttons will look. Turn on *Try it on this whole screen* to see it on the real page. Then:

- **Only this iPad**: just this screen uses it (handy for a darker bedroom iPad).
- **Apply to all screens**: the house theme; every iPad without its own choice switches right away.
- **Discard** (or close) keeps what you had.

Light colours on light tiles, the weather tile's sky and the AC's mode colours stay as they are in every theme.

## Hiding Home Assistant's sidebar and top bar

If you open Facewall from Home Assistant's sidebar (or the Home Assistant app), turn on ⚙︎ → *This screen* → **Hide Home Assistant's sidebar and top bar**. It's per iPad, so your computer keeps the normal Home Assistant layout. While it's hidden, *Home Assistant menu → Open* shows the sidebar over Facewall.

For a wall iPad you can also skip Home Assistant's page completely: open `http://homeassistant.local:8099/` in Safari and add it to the Home Screen (see *Port 8099* below).

## Architectural themes

⚙︎ → *Appearance* → *Theme* has an **Architectural** group that matches the style of the house: Mid-century, Walnut and Atomic (atomic starbursts, Futura); Palm Springs, Desert Pool and Desert Dusk (breeze blocks, Avenir Next); Craftsman, Spanish Revival, Scandinavian, Art Deco, Japandi and Farmhouse. Each brings its own background pattern and title font; more styles will follow.

## Full screen in the Home Assistant app (iPad)
1. In Facewall: Settings → turn on **Hide Home Assistant's sidebar and top bar**. **Edge to edge** (on by default) then covers the strips Home Assistant keeps for the status bar and home bar.
2. In the Home Assistant app: Settings → Companion app → **Kiosk mode** → turn on **Hide status bar** (works when the app runs full screen, not in Split View). Under **Configuration access**, move the small settings button to a top corner, where it's less in the way.
3. Optional: iPad Settings → Accessibility → **Guided Access** keeps the iPad in the app.

## Sections (menu down the left)
Give a page its own menu: open the page, tap Edit layout → **Sections** (or Settings → Tiles on the page → Add sections). Tap **Lights**, **Climate**, **Media**, **Security** or **Blinds** to add a ready-made section filled from the page's room. A page named like a Home Assistant area uses that area; otherwise pick the **Room**, or leave it as Whole house. **Blank** adds an empty one. The page's own tiles are the first item ("All"); rename it and pick an icon like any other section. In each section, Edit layout, Add tiles and tile options work just like on a page.

## Music Assistant
Needs the **Music Assistant** integration in Home Assistant (2024.12 or newer). Add a Music Assistant speaker as a tile and set its Style to **Music Assistant**. The tile shows what's playing and your favourites; star things in Music Assistant to see them there. Tap the tile (or **Browse**) to search or browse your library, play something now, play it next, add it to the queue or start a radio based on it. At the bottom you can group other speakers with this one or move the music to another room. If cover art doesn't show on the iPad, Facewall fetches it through itself.

## TV remote
Add the TV's **media player** as a tile, then edit it → Style → **TV remote**. Swipe on the round pad (or tap its arrows) to move, tap the middle for OK. Back, Home, play/pause, volume, power and **Apps** (the TV's source list) sit underneath. Facewall works out the brand from Home Assistant (Apple TV, Roku, Android TV Remote, Android TV/Fire TV over ADB, LG webOS, Samsung, Sony Bravia, Philips) and finds the remote entity on the same device. If the arrows don't work, choose the remote in the tile's settings. Hold the tile for the full now-playing sheet.

## Time as text on analog faces
Hold the clock → Customize on Classic, Numerals, Roman, Gradient, Starburst, Atomic or Confetti → **Time as text**. Choose a corner, Above or Below (the dial shrinks to make room), then the font (same list as the page header), size, weight, colour and whether to show the date underneath.

## Living backgrounds
Settings → Appearance → **Weather in the background** draws gentle rain, snow, clouds, fog, wind streaks or twinkling stars in the background, matching your weather entity (the header's, or your first one); thunderstorms add the odd soft flash. **Seasonal touches** add blossoms in April and May, falling leaves in October and November, and light snow in December and January when the weather is calm. **How much** sets the density. It only animates on the page you're looking at and stops while the screen sleeps.

## Photo frame
Settings → **Photo frame (this iPad)** → Show photos. After the time you choose on the clock with nobody touching the screen, the iPad shows a slideshow of your photos with a slow pan and zoom, and the time (plus the date and temperature, if you like) in the corner. Tap anywhere to go back to the clock. The screen-off timer, the doorbell and motion still work as usual.

**Where the photos come from:** Facewall can read Home Assistant's **media** and **share** folders (read-only). The easiest way: in Home Assistant open **Media → My media**, make a folder (e.g. `photos`) and upload pictures, then set the Folder to `media/photos`. Photos in sub-folders are included. JPEG, PNG, WebP, GIF, HEIC and AVIF work. Running Facewall outside Home Assistant? Set `PHOTOS_DIR` and use `photos/…` as the folder.

The first time after updating, Home Assistant may ask you to restart the app so it can see the media folder.

## Page header

Everything under a page's title is yours to choose: ⚙︎ → *Appearance* → *Page header* → **Change…**, or just **hold the title** on any page (right-click on a computer).

- **The line under the title**: turn pieces on or off and put them in order. Choose from: greeting (automatic *Good morning…*, with your name if you like, or your own words), date (several formats), weather now, today's high and low, feels like, chance of rain (always, or only when it's likely), wind (always, or only when it's windy), humidity, next sunrise/sunset, **weather warnings**, any sensor (e.g. *Inside 21°*), and your own text. Tap a piece for its options. Add as many sensors and texts as you like.
- **Weather warnings** appear as orange tags only while something is happening: thunderstorms, hail, heavy rain or extreme weather, very strong wind, and any **alert sensor** you add. For hurricane, storm or flood warnings, add your weather service's alert sensor from Home Assistant (for example the *NWS Alerts*, *Meteoalarm* or *Met Office* integrations).
- **Look**: font (13 fonts that come with the iPad: System, Rounded, New York, Avenir Next, Futura, Gill Sans, Optima, Didot, Baskerville, Mono, Typewriter, Script…), size, weight and colour, including a gradient, for the line; font, size and weight for the title; and whether the Home page shows the greeting or its name.
- **Header height**: how much of the screen the header gets. If the text needs more room, the header grows and the tiles make room.

These settings apply to every page and every screen. The preview at the top of the editor shows the result as you go.

## Screen care

- **Screen off after** (⚙︎ → *This screen*): the screen goes black when nobody touches it or moves in the room for the time you choose. Tap it to wake it.
- **Wake on motion**: pick a motion or presence sensor in that room; the screen wakes when someone comes in and stays on while they're there. *When it wakes* chooses the clock, this iPad's page, or where it was. A doorbell ring always wakes it.
- **Night theme** (⚙︎ → *Appearance*): give an iPad a second theme for night, switched at sunset and sunrise or at set times.
- **Burn-in protection** (⚙︎ → *Clock*): on by default; moves everything by a few pixels every few minutes.

Tip: for a wall iPad, turn off Auto-Lock (Settings → Display & Brightness) and use Guided Access, and let Facewall black out the screen instead.

## Faces

Every face can show live Home Assistant info in its four corners (hold the clock → Customize → *Top-left / Top-right / Bottom-left / Bottom-right info*): weather (temperature and conditions), a calendar (its next event), a sensor, a media player (the song) and more.


Classic, Numerals, Hourglow, Roman, **Starburst**, **Atomic** and **Confetti** (mid-century), Digital, **Modular** (big time with four live panels), **Word clock** (the time spelled out), Flip, and **Lamp**, a pendant bulb that glows in the real colour and brightness of a light you choose. Tap it to switch the light.

## Port 8099 and security

Port 8099 lets the wall iPad use Facewall **without logging in**, so anyone on your home network can open it and control the devices it shows.
If you'd rather not allow that, clear the port under the app's **Network** settings and use the sidebar instead.
