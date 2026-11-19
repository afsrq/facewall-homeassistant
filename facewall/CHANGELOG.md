# Changelog

## 1.52.0
- **Pick a face for each iPad.** Settings → This iPad → **Clock face** chooses this iPad's face from a list (holding the clock still works too).
- **Set other iPads from here.** Under **Other screens**, each iPad has its own **Clock face** and **Opens on** pickers. A new face shows on that iPad straight away; a new start page applies the next time it opens.

## 1.51.0
- **Any colour for the dial.** Faces with a Dial or Background choice now have a **Custom** swatch that opens the colour picker: Classic, Roman, the mid-century faces, both word clocks, Family and Countdown. Text, ticks, shading and hands adjust to suit a light or dark colour.
- Word clocks: lit letters stay readable on a light background (white letters switch to ink).

## 1.50.7
- **Music page tells you why Music Assistant isn't answering.** When search can't go through Music Assistant, a note says what Home Assistant reports: no Music Assistant integration, an integration that isn't running (and why), or no search action. It has a button to add or open the integration, and the details line shows the integration's state, its actions and how many speakers are Music Assistant ones. The same details go to Facewall's log.

## 1.50.6
- **Music page search goes to Music Assistant every time.** Facewall no longer trusts Home Assistant's list of actions to decide whether Music Assistant is there (that list can be missing or out of date). It simply asks Music Assistant, trying the built-in integration and then the older HACS one, and remembers which answers.
- If Music Assistant needs its instance and Facewall doesn't have it yet (say right after a reinstall), Facewall looks it up again and retries.
- Only when no Music Assistant search answers does the page fall back to the speaker's own library, and it says so.
- Facewall's log shows what it found for Music Assistant.

## 1.50.5
- **Music page: search and browse go straight to Music Assistant**, whatever speaker is on show. Spotify, Apple Music and the rest are searched through Music Assistant, not through a speaker.
- **Choose the speaker when you play.** Tap something (or Play next, Add to queue, Start radio): if the page's speaker is a Music Assistant one it plays there; otherwise Facewall asks which Music Assistant speaker to use and switches the page to it.
- A speaker's own library is only browsed when Home Assistant has no Music Assistant actions at all.

## 1.50.4
- **Music page search fixed** ("does not support action media_player.search_media").
  - Facewall checks for Music Assistant again before falling back, so a reinstalled Music Assistant is picked up without restarting anything.
  - Music Assistant speakers search all your music (Spotify, Apple Music and the rest) through Music Assistant.
  - Other speakers (for example a WiiM through its own integration) browse their own library. If they can't search, Facewall looks through the folder on show instead of failing, and a note offers to switch to a Music Assistant speaker for all your music.

## 1.50.3
- **Music page: no more speakers that no longer exist.** Removing or reinstalling Music Assistant leaves its old speakers behind in Home Assistant as unavailable entities. Facewall now leaves those out of the speaker button, Other speakers and the automatic choice, and a page set to an old speaker goes back to whichever is playing.
- Facewall notices new speakers sooner: it re-reads Home Assistant's entity list when it sees a speaker it doesn't know (at most once a minute), instead of after five minutes.

## 1.50.2
- **Music page works with more Music Assistant setups.** Facewall now asks Home Assistant which Music Assistant actions it actually has, instead of assuming them:
  - Works with the built-in Music Assistant integration (`music_assistant`) and the older HACS one (`mass`).
  - If Home Assistant has no Music Assistant library actions, the page browses the speaker's library the standard Home Assistant way (Library › folders › playlists), and searches with Home Assistant's own media search.
  - "Couldn't reach Music Assistant" errors now come with **Try again**, and favourites no longer hide an error as "No favourites yet".
  - Move here only shows when Home Assistant can move a queue.

## 1.50.1
- **Music page fixes**: the page no longer stays empty.
  - Finds Music Assistant speakers even when Home Assistant's entity registry doesn't say which integration they come from, and tries again if they arrive a moment late.
  - A **speaker button** at the top picks the speaker for the page (or "Whichever is playing"). Other speakers can be controlled too, without the library.
  - If something goes wrong, the page says what and offers **Try again**, instead of showing nothing.
  - The play button is visible on light themes.

## 1.50.0
- **Music page**: a whole page for Music Assistant. Add it from **Settings → Pages & tiles → Music page**, then swipe to the end.
  - Big cover art, a seek bar, shuffle, repeat, volume and **Up next**.
  - Search and browse everything in Music Assistant: favourites, playlists, albums, artists, songs, radio, podcasts and audiobooks, from Spotify, Apple Music, Tidal, YouTube Music and the rest.
  - Other speakers: **Control** one, **Group** it with this one, or **Move here** to bring its music over.
  - Starts on whichever speaker is playing and remembers the one you switch to. Works in landscape and portrait.

## 1.49.0
- **Settings, reorganised into tabs** across the top, instead of one long list:
  - **Theming**: Style, Colours (theme, night theme, time-of-day colours), Tiles (transparency, blur, corners), Background (wallpaper, weather, seasonal touches) and Page header.
  - **Clock**: clock options, Rotate faces, Now playing on the clock and Night dimming.
  - **Pages & tiles**: your pages, their tiles and the grid.
  - **This iPad**: this screen's name, start page, sleep and motion, Home Assistant options, Photo frame and Doorbell pop-up.
  - **Countdowns**, and **System** (connection and backup).
- Settings opens on the tab you last used; links from elsewhere (a countdown tile, a page's settings button) open the right tab.

## 1.48.0
- **Family face**: a photo bubble for each person (from Home Assistant's People) around the time. Anyone at home glows; anyone away is faded, with where they are underneath ("Away", "Work"). A line in the middle says "Everyone's home", "Nobody's home" or "2 of 3 home". Pick which people to show, and Night, Linen, MCM teal or Sunset backgrounds.

## 1.47.0
- **Lava lamp face**: glowing goo that heats at the bottom, rises, stretches, merges and sinks again, inside a classic chrome lamp or across the whole screen. Red and orange, Purple and pink, Teal and lime, or Mustard and teal, at slow or normal speed, with the time and date.
- **Aquarium face**: fish drifting past swaying plants, with light rays from the surface and rising bubbles. Tropical or Deep sea, a few fish or lots.

## 1.46.0
- **Departure board face**: an airport split-flap board. A big flap clock sits above rows for the weather now, your next calendar events (ON TIME, BOARDING when they're within the hour, TOMORROW), sunset or sunrise, and your countdowns. Changed letters clatter through the alphabet into place. Airport yellow, Station white, Amber or Green, with an optional flap sound.

## 1.45.0
- **Weather sky face**: the whole screen becomes the sky outside. Its colour follows your real sunrise and sunset (dawn, day, golden hour, dusk, night), with the sun moving across the sky by day and the moon and twinkling stars at night. Drifting clouds, rain, snow, fog and lightning match your weather, and the time, temperature and date sit on top (bottom left or centred).

## 1.44.0
- **Sunrise & sunset face**: a 24-hour dial with noon at the top and midnight at the bottom. Today's daylight is a warm arc from your real sunrise to sunset (from Home Assistant's sun), and a glowing sun (a moon at night) moves round it. The time is in the middle with "Sunset in 1 h 48 min" or "Sunrise in…" below. Night, Paper or MCM teal colours.
- Fixed: the bottom-left and bottom-right corners of clock faces, and the sidebar's readings, didn't update live in Home Assistant.

## 1.43.0
- **Now playing on the clock** (Settings → Now playing on the clock, per iPad): while music plays, the clock face gets a slow, breathing glow around its edges in colours taken from the album art, plus a small "♪ Song · Artist" line at the bottom. Follow whichever player is playing or pick one; Soft or Strong; the song line can be turned off. It fades away when the music stops.

## 1.42.0
- **Sidebar with time and info**: pages with sections now get a full sidebar on the left: a big clock, the date, then readings such as the room's temperature (indoors) and the weather (outdoors). Below that is the section menu, where each item shows a live summary: "3 on", "1 heating", or "1 alert" in red for an open door, an unlocked lock or a triggered alarm. At the bottom are the connection status and buttons for edit, clock and settings.
- Choose what the sidebar shows (up to four readings: temperatures, weather, countdowns, any sensor, with your own labels), or switch back to the compact icon menu: Edit layout → Sections → Menu.
- Fixed: Fit to screen could be undone a moment after a page appeared, leaving the bottom row cut off.

## 1.41.0
- **On this day** in the photo frame: when you have photos taken on today's date in earlier years, the frame shows those, labelled "3 years ago today · 2023". Otherwise it shows all your photos as usual.
- **When it was taken**: optionally show each photo's month and year above the time.
- Photo dates come from the camera (EXIF), from dates in file names (IMG_20231117…, 2023-11-17…), or from the file's own time. They're worked out once and remembered, so big folders stay quick.

## 1.40.0
- **Countdowns** (Settings → Countdowns): days to Christmas, a birthday, a vacation, anything. One tap adds Christmas, New Year, Halloween, Valentine's Day, Independence Day or Birthday, or make your own with an emoji. Yearly ones roll over by themselves; add a time to count hours and minutes on the day.
  - **Tile**: Add tiles → Countdowns. A big number, the emoji and the name; it turns festive on the day.
  - **Countdown face**: full screen ("3 days to Vacation") with the time below; shows the next one coming up, or one you pick.
  - **Clock corners and page header**: pick a countdown as a face's corner info, or add it to the header ("🎄 38 days to Christmas").

## 1.39.0
- **Time-of-day colours** (Settings → Appearance): a warm tint that follows the day, like Night Shift: soft peach around sunrise, none during the day, golden at sunset, deepening to amber through the night. It follows your real sunrise and sunset from Home Assistant, and fades gradually. Choose Subtle, Normal or Strong, and whether it tints everything or only your pages.

## 1.38.0
- **Retro terminal style**: an old CRT look, with pixel letters (VT323) glowing in your theme's accent colour (green with Sage, amber with Linen, and so on), scanlines, a darkened edge and a faint flicker. Switched-on tiles light up solid.
- **Wallpapers**: mid-century patterns behind the tiles, drawn in your theme's own colours: **Starbursts**, **Boomerangs**, **Eames dots** and **Atomic** (orbits and Sputnik lamps). Choose Faint, Soft or Bold and the pattern size. Settings → Appearance → Wallpaper.
- Fixed: after a change in Settings, the style could be applied from the previous settings.

## 1.37.1
- **Bigger letters on the word clocks**, for reading from across the room:
  - New **Letter size** option (Normal, Large, Huge) on both word clocks, with heavier letters at the bigger sizes. The exact word clock now starts at Large.
  - The exact word clock needs far fewer letters: teens are built from parts (FOUR·TEEN, THIR·TEEN), and the grid packs itself to give the biggest letters the screen allows.
  - New **Words: Short** option on the exact word clock: "One twenty one afternoon" instead of "It is one twenty one in the afternoon", for even bigger letters.

## 1.37.0
- **Rotate faces** (Settings → Rotate faces, per iPad): tick the clock faces you like and the iPad takes turns showing them, at random or in turn, every 5 or 15 minutes, hourly, every 6 hours, or each time the clock comes back from your pages. Faces fade into each other.
- **Word clock: exact**: a new word clock that lights up the exact time in words, such as "It is one twenty one in the afternoon", "It is six fifty seven in the evening", "It is ten fifty eight in the morning" or "It is twelve oh five at night". The letter grid packs itself to suit the screen, upright or sideways. The original "half past ten" word clock is still there.

## 1.36.0
- **Fit to screen** (on by default): pages stretch or shrink their rows so the tiles you placed exactly fill the screen, with no overflow off the bottom in landscape and no empty gap in portrait. Rotating the iPad re-fits straight away, keeping your arrangement and proportions. Very long pages still scroll rather than squashing tiles too small. Turn it off per page in Settings → Grid to go back to a fixed number of rows.

## 1.35.0
- **Fixed the bars in the Home Assistant iPad app.** The strip behind the status bar and the strip at the bottom aren't part of the web page: the app draws them itself in colours it reads from Home Assistant's theme. Facewall now sets those colours to whatever is on screen (the clock face's own colour, the page background, or black when the screen sleeps) and tells the app to repaint, so the strips blend in and follow you as you switch faces and pages. Home Assistant's colours come back as soon as you leave Facewall. Settings → Edge to edge (on by default; it no longer needs the sidebar hidden).

## 1.34.1
- Fixed: **Add tiles** didn't list media players (Apple TV, speakers…), cameras, calendars, people, vacuums or alarm panels, so their filters said nothing matched. They're all there now.

## 1.34.0
- **Styles**, separate from themes: pick how the tiles are drawn, then pick a theme for the colours. Settings → Appearance:
  - **Apple Home**: the look so far; switched-on tiles turn bright.
  - **Material You**: Android style, with tonal tiles tinted by the theme, bigger rounded corners and icons in coloured circles. Lights fill with their own colour.
  - **Liquid glass**: frosted see-through tiles with bright edges over a colourful background made from the theme.
  - **Facewall Bold**: flat outlined tiles that fill with the theme colour when on, and bold uppercase names.
- **Tile transparency** slider (solid to 90% see-through), **Blur behind tiles** (Auto, None, Light, Strong) and **Corners** (Auto, Square, Rounded, Round), on top of any style and theme.

## 1.33.0
- **Edge to edge in the Home Assistant app**: with "Hide Home Assistant's sidebar and top bar" on, Facewall now also stretches over the strips at the top and bottom that Home Assistant keeps for the iPad's status bar and home bar (they showed Home Assistant's own blue and white). It's on by default; turn it off with Settings → Edge to edge. Pair it with the companion app's Kiosk mode "Hide status bar" for a truly full screen.

## 1.32.0
- **Sections**: a menu down the left side of a page, each section with its own tiles, so one room can have Lights, Climate and Media screens. Add them from Edit layout → **Sections**, or Settings → Tiles → Add sections.
- One-tap ready-made sections (**Lights, Climate, Media, Security, Blinds**) fill themselves from the page's room: lights, switches and scenes; thermostats (as a dial), fans and temperature, humidity and air-quality sensors; speakers and TVs (TVs as a remote). Pages not named after a room use the whole house, or pick the room.
- Rename sections, choose their icons, reorder or delete them, and rename the page's own first section (it's called "All" until you do). Edit layout, Add tiles and tile options all work on the section you're looking at.
- The weather backgrounds now update live even when the header doesn't show the weather.

## 1.31.0
- **Change a tile's entity**: every tile's settings now have an **Entity** picker. Swap the light, sensor, TV or anything else a tile shows without rebuilding it; its size, place, icon, colours and name stay. Entities of the same kind are listed first. A tile whose entity has gone missing shows it as "(missing)" so you can point it at the new one.

## 1.30.0
- **Music Assistant tile**: set a Music Assistant speaker's tile Style to **Music Assistant**. It shows what's playing with your favourite playlists, albums, artists and stations underneath; tap one to play it.
- **Music browser** (tap the tile or Browse): search everything, or browse Favourites, Playlists, Albums, Artists, Songs, Radio, Podcasts and Audiobooks with cover art. Tap to play, or ••• for Play next, Add to queue and Start radio. Shows what's up next, plus shuffle and volume.
- **Speakers**: group other Music Assistant speakers with this one, or move the music to another speaker.
- Music Assistant speakers using the normal now-playing tile get a **Browse music** button in their sheet.

## 1.29.0
- **TV remote tile**: set a media player's tile Style to **TV remote** for a round touchpad (swipe or tap the arrows, tap OK), Back, Home, play/pause, volume and power, plus an **Apps** button that opens the TV's apps and inputs. Works with Apple TV, Roku, Android TV (and Fire TV via ADB), Google TV, LG webOS, Samsung, Sony Bravia and Philips. Facewall finds the TV's matching remote on its own; you can pick a different one in the tile's settings.

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
