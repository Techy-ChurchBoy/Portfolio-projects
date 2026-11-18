# Sky Walker

A scroll-driven 3D flight-deck concept built with Three.js and GSAP. The page descends from an aerial view of
Murtala Muhammed International Airport (LOS), Lagos, into the departure hall, where the booking form and
departures board live. Nothing here is a live booking service; all flight data is sample content.

## Run it

```bash
npm install
npm run dev      # local dev server
npm run build    # production build in dist/
```

Add `?lite` to the URL, or press the **Lite** button, for a plain page without 3D.

## Structure

```
src/
  main.js            boot, lite mode, lazy-loads the 3D scene
  scene3d.js         renderer, lights, scroll-driven camera (GSAP), drag-to-look
  world.js           ground, skyline, clouds, orbiting aircraft; builds the airport
  airports/
    los.js           Lagos spec: runways, taxiways, terminals, tower, camera shots, departures
    build.js         generic builder: spec -> Three.js group
    hall.js          the hero terminal (glass hall, sign, live departures board)
  ui.js, data.js     booking form, routes, services, instalment illustration
public/assets/       aircraft.glb (used), sky.glb (not used yet)
```

## Adding an airport

Copy `src/airports/los.js`, change the spec (runways, terminals, tower, shots, departures) and pass it to
`buildAirport` / `buildWorld`. World units are 1 unit = 2 m, +z south, +x east.

## How accurate is the Lagos replica?

Stylised, by design. Runway designators and lengths (18R/36L at 3,900 m, 18L/36R at 2,743 m, both north to
south) and the list of terminals (original international terminal, 2022 international terminal, old domestic
terminal, MMA2) follow public sources. Spacing between runways and terminals, building footprints and the tower
position are approximate and art-directed, not surveyed.

## Credits

- Aircraft model: "SD-800 | Sky Dog Flight Simulator" by
  [drivespace](https://sketchfab.com/drivespace), licensed
  [CC BY 4.0](http://creativecommons.org/licenses/by/4.0/).
- `sky.glb`: "SD_Sky_230315c" by [ritsuka](https://sketchfab.com/ritsuka), licensed CC BY 4.0. Currently unused.
- [Three.js](https://threejs.org) (MIT) and [GSAP](https://gsap.com) (GreenSock standard licence).
