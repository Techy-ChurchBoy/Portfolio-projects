// Murtala Muhammed International Airport (LOS), Lagos.
//
// Stylised replica. Runway designators and lengths, plus the list of terminals, follow public
// sources (see README). Spacing and building footprints are approximate and art-directed.
//
// World units: 1 unit = 2 m. +z is south, +x is east, -z is north.
// The hero terminal sits at the origin and is the one the scroll journey flies into.

export const UNIT_M = 2;

export const LOS = {
  code: 'LOS',
  name: 'Murtala Muhammed International Airport',
  city: 'Lagos',

  // Runways run north to south. 18R/36L is the longer one, on the west side.
  runways: [
    { id: ['18R', '36L'], lengthM: 3900, x: -680, z: -420 },
    { id: ['18L', '36R'], lengthM: 2743, x: -420, z: -420 },
  ],

  // Taxiways as polylines of [x, z] points.
  taxiways: [
    { width: 16, points: [[-300, 120], [-300, -980]] }, // parallel taxiway along the aprons
    { width: 14, points: [[-300, 40], [-420, 40]] },
    { width: 14, points: [[-300, -330], [-420, -330]] },
    { width: 14, points: [[-300, -700], [-420, -700]] },
    { width: 14, points: [[-420, 300], [-680, 300]] }, // end link between the two runways
    { width: 14, points: [[-420, -300], [-420, 300]] },
  ],

  terminals: [
    { key: 'intl', hero: true, name: 'International Terminal', note: 'Opened 1979', x: 0, z: 0, w: 220, d: 180, h: 70 },
    { name: 'New International Terminal', note: 'Commissioned 2022', x: 0, z: -310, w: 280, d: 190, h: 58, color: 0x9fb8e8 },
    { name: 'Domestic Terminal', note: 'Old domestic', x: 20, z: -650, w: 190, d: 120, h: 34, color: 0xb7c3dc },
    { name: 'MMA2', note: 'Domestic, 2007', x: 40, z: -860, w: 210, d: 110, h: 36, color: 0xc7d2e6 },
  ],

  tower: { x: 180, z: -150, height: 92 },

  // Rectangle the city generator keeps clear of.
  bounds: { minX: -1050, maxX: 360, minZ: -1500, maxZ: 700 },

  // Parked aircraft on the hero apron: [x, z].
  stands: [[-215, -55], [-215, 5], [-215, 65]],

  // Scroll-driven camera path for the page sections.
  shots: {
    aerial: { pos: [-640, 420, 560], tgt: [-330, 0, -330], fov: 56 },
    entrance: { pos: [0, 34, 330], tgt: [0, 24, 0], fov: 56 },
    inside: { pos: [0, 9, 62], tgt: [0, 20, -92], fov: 64 },
    board: { pos: [0, 8, 26], tgt: [0, 22, -92], fov: 60 },
    pull: { pos: [0, 18, 120], tgt: [0, 30, -60], fov: 68 },
  },

  // Departure board rows for the hero terminal: [time, from, to, city, status].
  departures: [
    ['14:10', 'LOS', 'LHR', 'LONDON', 'BOARDING'],
    ['16:45', 'LOS', 'DXB', 'DUBAI', 'ON TIME'],
    ['19:20', 'LOS', 'JNB', 'JOHANNESBURG', 'CHECK-IN'],
    ['21:05', 'LOS', 'ACC', 'ACCRA', 'DELAYED'],
    ['23:50', 'LOS', 'JFK', 'NEW YORK', 'ON TIME'],
  ],
};
