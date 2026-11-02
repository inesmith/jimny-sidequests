/**
 * Jimny Side Quests — curated metadata for venues already discovered by Google Places.
 *
 * IMPORTANT:
 * - This file does NOT add markers, search for places, or override the travel radius.
 * - Match a Google Places venue using findCuratedDestination(place.displayName?.text).
 * - Show its `trails` INSIDE that venue's existing card/details panel.
 * - Research values below were transcribed from user-provided screenshots and have
 *   NOT been independently verified with venue operators.
 * - Do not present researched prices, access rules or opening hours as guaranteed current.
 */

export type TrailDifficulty = "Easy" | "Medium" | "Hard" | "Unrated";

export type CuratedTrail = {
  id: string;
  name: string;
  /** Actual driving route length, NOT distance from the user's location. */
  distanceKm?: number;
  distanceLabel?: string;
  duration?: string;
  difficulty: TrailDifficulty;
  grade?: string;
  terrain: string[];
  description?: string;
  notes?: string[];
};

export type CuratedDestination = {
  id: string;
  name: string;
  /** Names Google Places might use for the same venue. */
  aliases: string[];
  locationDescription: string;
  summary: string;
  /** Displayed when the venue contains trails with different difficulty levels. */
  difficulty: TrailDifficulty;
  terrain: string[];
  /** Optional local image; add require(...) later once photos are in assets. */
  image?: number;
  website?: string;
  phone?: string;
  email?: string;
  /** Research-based admission prices; check before publication. */
  priceNote?: string;
  amenities?: string[];
  visitorNotes?: string[];
  trails: CuratedTrail[];
  researchStatus: "user-supplied-unverified";
};

export const curatedDestinations: CuratedDestination[] = [
  {
    id: "hennops", name: "Hennops Offroad Trail",
    aliases: ["Hennops Offroad Trail", "Hennops 4x4", "Hennops Off Road", "Hennops Offroad"],
    locationDescription: "R511, near Hartbeespoort, Gauteng",
    summary: "Off-road venue with rocky climbs, muddy obstacles and optional bypass routes.",
    difficulty: "Unrated", terrain: ["Mud", "Rock", "Steep climbs", "Dongas"],
    website: "https://hennops.co.za", phone: "082 825 9205", email: "info@hennops.co.za",
    priceNote: "Website screenshot showed R250 per vehicle including two people, plus R50 per additional adult; confirm current prices.",
    visitorNotes: ["Recovery services reportedly not provided."],
    trails: [{id: "hennops-zonkie", name: "Zonkie Trail", distanceKm: 9, duration: "About 2 hours", difficulty: "Unrated", terrain: ["Mud", "Rock", "Climbs", "Dongas"], description: "A mixed off-road route with bypasses around difficult obstacles."}],
    researchStatus: "user-supplied-unverified",
  },
  {
    id: "khwela", name: "Khwela 4x4 Adventures & Dynamic Driving",
    aliases: ["Khwela", "Khwela 4x4", "Khwela 4x4 Adventures", "Khwela 4x4 Adventures and Dynamic Driving"],
    locationDescription: "Training at De Wildt near Brits",
    summary: "Instructor-led 4x4 training provider; course duration is not a trail driving time.",
    difficulty: "Unrated", terrain: [], website: "https://khwela4x4.com",
    priceNote: "Reported one-on-one training R3,000 plus De Wildt entrance R400 per vehicle; confirm rates.",
    visitorNotes: ["Bring your own 4x4; training venue and access should be confirmed before booking."],
    trails: [{id: "khwela-training", name: "One-on-One 4x4 Training", distanceKm: 5, duration: "4-5 hours (course)", difficulty: "Unrated", terrain: ["Mixed"], description: "Approximately one hour of theory followed by practical off-road exercises at De Wildt."}],
    researchStatus: "user-supplied-unverified",
  },
  {
    id: "wolwekloof", name: "Wolwekloof 4x4 Club",
    aliases: ["Wolwekloof", "Wolwekloof 4x4", "Wolwe Kloof 4x4 Club"],
    locationDescription: "Donkerhoek, near Cullinan and Rayton, Gauteng",
    summary: "Rocky off-road mountain trails and obstacles with camping and other outdoor activities.",
    difficulty: "Unrated", terrain: ["Granite", "Rock", "Sand"], phone: "072 898 1609",
    amenities: ["Camping", "Hiking", "Enduro activities"],
    visitorNotes: ["Google research summary reported a Grade 3–5 range; not confirmed by operator."],
    trails: [{id: "wolwekloof-main", name: "Wolwekloof 4x4 Trail", distanceKm: 15, duration: "2-4 hours", difficulty: "Unrated", grade: "Reported Grade 3–5", terrain: ["Granite rock", "Rocky climbs", "Sand"]}],
    researchStatus: "user-supplied-unverified",
  },
  {
    id: "john-rock", name: "John Rock 4x4 Track and Camp Ground",
    aliases: ["John Rock", "John Rock 4x4", "John Rock 4x4 Track", "John Rock 4x4 Track and Camp Ground"],
    locationDescription: "Plot 315, Arabis Road, Pretoria",
    summary: "Off-road obstacles, muddy tracks and a rocky mountain pass with camping facilities.",
    difficulty: "Unrated", terrain: ["Rock", "Mud", "Ruts", "Water crossings"],
    phone: "061 424 0880", email: "johnny@johnrock.co.za",
    amenities: ["Camping", "Hiking", "Braai facilities"],
    visitorNotes: ["Reported Grade 3–5 and 5–8 km total distance; verify with operator."],
    trails: [
      {id: "john-rock-obstacles", name: "Man-Made Obstacles", duration: "30–45 minutes", difficulty: "Unrated", terrain: ["Tyre tracks", "Log bridge", "Flex ramp"]},
      {id: "john-rock-slote", name: "Die Slote", duration: "1–1.5 hours", difficulty: "Unrated", terrain: ["Mud", "Ditches", "Cross-axle ruts"]},
      {id: "john-rock-mountain", name: "Mountain Pass", duration: "1–1.5 hours", difficulty: "Unrated", terrain: ["Steep rock climbs", "Mountain terrain"]},
    ], researchStatus: "user-supplied-unverified",
  },
  {
    id: "de-wildt", name: "De Wildt 4x4 Nature Park and Resort",
    aliases: ["De Wildt 4x4", "De Wildt 4x4 Nature Park", "De Wildt 4x4 Nature Park and Resort", "De Wildt 4x4 Resort", "De Wildt Nature Park"],
    locationDescription: "Near Brits, Magaliesberg",
    summary: "Self-drive 4x4 park with a standard green route and an extreme red route.",
    difficulty: "Unrated", terrain: ["Bushveld", "Rock", "Mud"],
    website: "https://dewildt4x4.co.za", phone: "083 268 8185",
    priceNote: "Website screenshot: R400 per vehicle including two people; R150 per additional person. Confirm rates.",
    amenities: ["Camping", "Cabins", "Hiking", "Fishing"],
    visitorNotes: ["Reported daily hours 07:30–17:30.", "Routes are self-drive, without a guide."],
    trails: [
      {id: "dewildt-green", name: "Green 4x4 Route", distanceKm: 10, duration: "2-3 hours", difficulty: "Unrated", terrain: ["Bushveld", "Rock"], description: "Standard 4x4 route."},
      {id: "dewildt-red", name: "Red Extreme Route", distanceKm: 7.8, duration: "3-4 hours", difficulty: "Hard", terrain: ["Technical rock", "Obstacles"], description: "For experienced drivers and suitably modified vehicles."},
      {id: "dewildt-sedan", name: "Car / Sedan Route", distanceKm: 4.8, duration: "30-45 minutes", difficulty: "Easy", terrain: ["Dirt roads"], description: "Separate route for ordinary vehicles."},
    ], researchStatus: "user-supplied-unverified",
  },
  {
    id: "afro-offroad", name: "Afro Offroad",
    aliases: ["Afro Offroad", "Afro Off Road", "Afro Offroad Training"],
    locationDescription: "Driefontein Farm, Muldersdrift",
    summary: "Professional instructor-led off-road training, not a general self-drive trail.",
    difficulty: "Unrated", terrain: ["Rock", "Gravel", "Inclines", "Water"],
    website: "https://afrooffroad.co.za", phone: "+27795047120",
    priceNote: "Advanced course website screenshot: R1,800 driver, R1,000 co-driver, R250 passenger; confirm rates.",
    visitorNotes: ["Advanced training reportedly runs every second Sunday; booking required."],
    trails: [
      {id: "afro-familiarisation", name: "Off-Road Familiarisation Course", duration: "3 hours", difficulty: "Easy", terrain: ["Mixed off-road obstacles"]},
      {id: "afro-advanced", name: "Advanced Off-Road Driver Training", duration: "Full day (course)", difficulty: "Hard", terrain: ["Rock", "Gravel", "Inclines", "Water"], description: "Instructor-led training with own vehicle."},
      {id: "afro-recovery", name: "Recovery & Winching Training", duration: "3-5 hours", difficulty: "Unrated", terrain: [], description: "Specialist training course, not a separate trail."},
    ], researchStatus: "user-supplied-unverified",
  },
  {
    id: "rebel", name: "Rebel 4x4 Track & Grounds",
    aliases: ["Rebel 4x4", "Rebel 4x4 Track", "Rebel 4x4 Track and Grounds"],
    locationDescription: "Muldersdrift / Krugersdorp, Gauteng",
    summary: "Technical obstacle and competition venue; casual driving access needs confirmation.",
    difficulty: "Hard", terrain: ["Mud", "Rock", "Steep inclines"],
    priceNote: "Reported event-specific rates: R350 competitor, R40 adult spectator, R20 child spectator; not general admission prices.",
    trails: [{id: "rebel-obstacles", name: "4x4 Obstacle Course", distanceKm: 4, duration: "2-3 hours", difficulty: "Hard", terrain: ["Mud", "Rock", "Axle-twisting obstacles"], description: "Primarily an off-road competition and event course."}],
    researchStatus: "user-supplied-unverified",
  },
  {
    id: "rebellie", name: "Rebellie 4x4 Trail",
    aliases: ["Rebellie", "Rebellie 4x4", "Rebellie 4x4 Trail"],
    locationDescription: "Near Clarens, Free State",
    summary: "Technical sandstone mountain 4x4 routes with scenic viewpoints.",
    difficulty: "Hard", terrain: ["Sandstone", "Rock", "Mountain", "River crossings"],
    priceNote: "Reported R450 per vehicle for day visitors; confirm current rate.",
    trails: [{id: "rebellie-network", name: "Rebellie Mountain Trail Network", distanceKm: 32, duration: "4–6 hours", difficulty: "Hard", grade: "Reported Grade 3–5", terrain: ["Sandstone", "Rock", "Mountain", "River crossings"]}],
    researchStatus: "user-supplied-unverified",
  },
  {
    id: "hobby-park", name: "Hobby Park",
    aliases: ["Hobby Park", "Hobby Park 4x4", "Hobby Park Krugersdorp"],
    locationDescription: "Paardeplaats, Krugersdorp",
    summary: "Two distinct off-road routes: a technical obstacle trail and a scenic green trail.",
    difficulty: "Unrated", terrain: ["Rock", "Mud", "Dirt roads"], website: "https://hobbypark.co.za",
    priceNote: "Reported R250 per vehicle including driver and three passengers; R50 per additional visitor. Confirm rates.",
    amenities: ["Braai areas", "Restaurant", "Hiking", "Mountain biking"],
    visitorNotes: ["Reported Wednesday–Sunday 07:00–17:00; confirm hours."],
    trails: [
      {id: "hobby-action", name: "Action 4x4 Trail", distanceKm: 3.6, duration: "Estimated 1.5–2.5 hours", difficulty: "Hard", terrain: ["Rock", "Mud", "Obstacles"], description: "17 obstacles; low-range 4x4 required. Escape routes around difficult sections."},
      {id: "hobby-green", name: "Green 4x4 Trail", distanceKm: 6, duration: "Estimated 1 hour", difficulty: "Easy", terrain: ["Mountain dirt roads"], description: "Scenic trail with three viewpoints, suitable for some 2x4 vehicles."},
    ], researchStatus: "user-supplied-unverified",
  },
  {
    id: "kungwini", name: "4x4 Kungwini",
    aliases: ["4x4 Kungwini", "Kungwini 4x4", "Kungwini", "4 x 4 Kungwini"],
    locationDescription: "Marloo Farm, near Bronkhorstspruit Dam",
    summary: "Training obstacle track and longer scenic eco-trail.",
    difficulty: "Unrated", terrain: ["Sand", "Gullies", "Rock"],
    priceNote: "Reported R450 per vehicle day pass; confirm current rate.",
    amenities: ["Camping", "Braai", "Fishing", "Birdwatching"],
    trails: [
      {id: "kungwini-training", name: "Academy & Training Track", distanceLabel: "1.4–2 km", duration: "1–2 hours", difficulty: "Unrated", terrain: ["Sand pits", "Gullies", "Steep angles"]},
      {id: "kungwini-ruins", name: "Ruins Eco-Trail", distanceKm: 8, duration: "About 2 hours", difficulty: "Unrated", grade: "Reported Grade 2–4", terrain: ["Rocky climbs", "Mountain terrain"], description: "Scenic trail with stone ruins and views of the dam."},
    ], researchStatus: "user-supplied-unverified",
  },
  {
    id: "sandturion",
    name: "Sandturion Off-Road Events & Family Adventure Park",
    aliases: ["Sandturion", "Sandturion Off Road", "Sandturion Adventure Park"],
    locationDescription: "Midrand / near Sandton, Gauteng",
    summary: "Off-road events, 4x4 activities, enduro sport and family adventures.",
    difficulty: "Unrated",
    terrain: [],
    website: "https://sandturion.com",
    phone: "+27826018761",
    email: "peter@trinityfuels.co.za",
    amenities: ["Family adventure activities", "Off-road events"],
    visitorNotes: [
      "Reported hours: Monday closed; Tuesday–Thursday 09:00–17:00; Friday–Saturday 07:00–21:00; Sunday 08:00–17:00.",
      "Historic article prices are not treated as current admission prices.",
    ],
    trails: [
      {
        id: "sandturion-4x4-area",
        name: "Sandturion 4x4 Area",
        difficulty: "Unrated",
        terrain: ["Rock"],
        duration: "1-3 hours",
        distanceKm: 8,
        description: "Off-road driving area; route length, duration and grading still need confirmation.",
      },
    ],
    researchStatus: "user-supplied-unverified",
  },
  {
    id: "sable-magalies",
    name: "Sable Magalies 4x4 / Sable Ranch",
    aliases: ["Sable Magalies 4x4", "Sable Ranch", "Sable Magalies", "Sable 4x4"],
    locationDescription: "Near Hekpoort, Magaliesberg, Gauteng",
    summary: "Two contrasting 4x4 experiences: a constructed obstacle course and a rugged mountain ascent.",
    difficulty: "Hard",
    terrain: ["Rock", "Mud", "Side slopes", "Loose shale"],
    priceNote: "Reported R400 per vehicle for access to both tracks; confirm current rate.",
    amenities: ["Picnic and braai areas", "Hiking", "Food and refreshments", "Accommodation nearby"],
    visitorNotes: ["Historically reported as cash-only at the gate; confirm payment methods."],
    trails: [
      {
        id: "sable-obstacle-track",
        name: "Man-Made Obstacle Track",
        duration: "1–2 hours",
        difficulty: "Medium",
        terrain: ["Axle twisters", "Mud holes", "Side slopes", "Ditches"],
        description: "Training area with approximately 15 technical obstacles.",
        notes: ["Reported suitable for standard 4x4s and some diff-lock-equipped 4x2s."],
      },
      {
        id: "sable-mountain-ascent",
        name: "Mountain Ascent Trail",
        duration: "3–5 hours including obstacle track",
        difficulty: "Hard",
        terrain: ["Rock crawling", "Steep gradients", "Loose shale"],
        description: "Technical natural mountain route with a scenic viewpoint near the summit.",
        notes: ["Intended for experienced drivers."],
      },
    ],
    researchStatus: "user-supplied-unverified",
  },
  {
    id: "at-se-gat",
    name: "At Se Gat 4x4 Trails",
    aliases: ["At Se Gat", "At Se Gat 4x4", "Asegat", "Ase Gat", "Atse Gat"],
    locationDescription: "Krokodilpoort, near Brits, North West",
    summary: "Off-road playground with mountain, rock, sandpit and Crocodile River sections.",
    difficulty: "Hard",
    terrain: ["Sand", "Rock", "Mud", "River crossings"],
    priceNote: "Reported day entry R300–R350 per vehicle; event rates and camping extra. Confirm current prices.",
    amenities: ["Braai and picnic spots", "Rustic camping", "Self-catering chalet"],
    visitorNotes: [
      "River crossings change with water levels; confirm conditions before visiting.",
      "Low-range 4x4 and good ground clearance recommended for more demanding sections.",
      "Reported property rules prohibit pets, quad bikes and motorcycles; confirm directly.",
    ],
    trails: [
      {
        id: "at-se-gat-network",
        name: "Mountain, Rock & Sandpit Trail Network",
        duration: "3–5 hours exploring",
        difficulty: "Hard",
        grade: "Reported Grade 2–4+ across sections",
        terrain: ["Mountain climbs", "Rock", "Sandpits", "Mud"],
        description: "A network of different driving zones rather than one fixed-length route.",
      },
      {
        id: "at-se-gat-river",
        name: "Crocodile River Crossings",
        difficulty: "Hard",
        terrain: ["Water crossings", "Riverbanks", "Mud"],
        description: "Variable-depth crossings whose difficulty depends on seasonal river conditions.",
        notes: ["Never assume a river crossing is safe; check current conditions on site."],
      },
    ],
    researchStatus: "user-supplied-unverified",
  },
  {
    id: "moegatle",
    name: "Moegatle 4x4 Trails",
    aliases: ["Moegatle", "Moegatle 4x4", "Moegatle 4x4 Trails"],
    locationDescription: "North of Brits, North West",
    summary: "Highly technical full-day off-road destination known for severe rock obstacles.",
    difficulty: "Hard",
    terrain: ["Rock crawling", "Deep sand", "Mud", "Riverbeds"],
    priceNote: "Reported R350–R450 per vehicle for day access; verify before visiting.",
    amenities: ["Camping", "Cabins", "Braai areas", "Lodge facilities"],
    visitorNotes: [
      "Booking ahead reportedly required.",
      "Low range, high ground clearance and differential locks recommended for technical sections.",
    ],
    trails: [
      {
        id: "moegatle-main",
        name: "Moegatle Main 4x4 Trail",
        distanceKm: 34,
        duration: "6–8 hours",
        difficulty: "Hard",
        grade: "Reported Grade 4–5",
        terrain: ["Rock", "Deep sand", "Mud", "Riverbeds"],
        description: "Demanding full-day route with optional bypasses around some severe obstacles.",
      },
      {
        id: "moegatle-koos-se-klim",
        name: "Koos se Klim (Obstacle)",
        difficulty: "Hard",
        terrain: ["Steep granite rock"],
        description: "Named steep granite slab obstacle on the main route; not a separate full-length trail.",
        notes: ["Reported 43-degree slab; do not attempt without suitable vehicle and experience."],
      },
    ],
    researchStatus: "user-supplied-unverified",
  },
  {
    id: "heidelburg-adventure-park",
name: "Heidelburg 4 x 4 Club",
aliases: [
  "Heidelburg 4 x 4 Club",
  "Heidelberg 4 x 4 Club",
  "Heidelburg 4x4 Club",
  "Heidelberg 4x4 Club",
  "Heidelburg 4 x 4 / Enduro Adventure Park",
  "Heidelberg 4x4 Enduro",
  "Heidelberg Enduro Adventure Park",
  "Heidelberg 4x4 Adventure Park",
],locationDescription: "R549 Heidelberg–Vaal Dam road, Gauteng",
    summary: "Multi-use off-road park with a network of routes for different skill levels.",
    difficulty: "Hard",
    terrain: ["Rock", "Mud", "Sand", "Water crossings"],
    priceNote: "Reported R250 per 4x4 plus R50 per passenger; confirm current admission.",
    amenities: ["Basic camping", "Rustic accommodation", "Enduro and quad-bike facilities"],
    visitorNotes: [
      "Reported hours 06:00–18:00 daily; confirm before visiting.",
      "Stay on marked trails to avoid the neighbouring protected nature reserve.",
    ],
    trails: [
      {
        id: "heidelburg-green-routes",
        name: "Beginner / Green Routes",
        difficulty: "Easy",
        grade: "Reported Grade 2 sections",
        terrain: ["Mixed dirt", "Mild obstacles"],
        description: "Easier marked options within the wider park network.",
      },
      {
        id: "heidelburg-technical-routes",
        name: "Technical Ridge & Obstacle Routes",
        duration: "3–6 hours exploring the park",
        difficulty: "Hard",
        grade: "Reported up to Grade 5",
        terrain: ["Rocky climbs", "Steep gradients", "Mud", "Sand", "Water crossings"],
        description: "More challenging routes and obstacles for experienced drivers and suitable vehicles.",
      },
    ],
    researchStatus: "user-supplied-unverified",
  },
  {
    id: "berakah",
    name: "Berakah Eco Trails",
    aliases: ["Berakah", "Berakah Adventures", "Berakah 4x4", "Berakah Eco Trails", "Berakah 4x4 Eco Trail"],
    locationDescription: "Near Parys, Free State; Vredefort Dome area",
    summary: "Self-guided 4x4 route through eight changing landscapes in the Vredefort Dome region.",
    difficulty: "Hard",
    terrain: ["Bushveld", "Sand", "Mud", "Riverbeds", "Rocky mountain climbs"],
    priceNote: "Reported R330 per 4x4 vehicle; confirm current rate.",
    amenities: ["Swimming pool", "Braai facilities", "Camping", "Rustic chalets"],
    visitorNotes: ["Low range and good clearance required for upper mountain sections."],
    trails: [
      {
        id: "berakah-main",
        name: "Berakah 4x4 Eco Trail",
        distanceLabel: "14–15 km",
        duration: "4–6 hours",
        difficulty: "Hard",
        grade: "Reported Grade 2–4",
        terrain: ["Savannah", "Bushveld", "Mud", "Sand", "Seasonal riverbeds", "Rock"],
        description: "Eight-section self-guided route, finishing with technical rocky mountain terrain.",
      },
    ],
    researchStatus: "user-supplied-unverified",
  },
  {
    id: "three-provinces",
    name: "3 Provinces 4x4 Adventures",
    aliases: ["3 Provinces 4x4", "3 Provinces 4x4 Adventures", "Three Provinces 4x4", "3provinsies4x4"],
    locationDescription: "Waterval Farm near Volksrust, Mpumalanga",
    summary: "Mountain 4x4 adventure with a long main loop and several shorter technical trails.",
    difficulty: "Hard",
    terrain: ["Rock", "Mud", "Stream crossings", "Steep climbs"],
    priceNote: "Reported R320 main trail pass per vehicle; R280 general non-trail entry. Verify rates.",
    amenities: ["Rustic off-grid camping", "Cabins and chalets"],
    visitorNotes: [
      "Wet weather can make the clay tracks exceptionally slippery.",
      "Access to accommodation may require a 4x4 in wet conditions.",
    ],
    trails: [
      {
        id: "three-provinces-main",
        name: "Main 4x4 Trail",
        distanceKm: 34,
        duration: "4–6 hours in dry conditions",
        difficulty: "Hard",
        grade: "Reported Grade 3–4; optional Grade 5 obstacles",
        terrain: ["Riverbeds", "Mud", "Streams", "Rock"],
        description: "Main continuous 4x4 loop through mountainous terrain.",
      },
      {
        id: "three-provinces-tierkloof",
        name: "Tierkloof Trail",
        distanceKm: 8,
        duration: "About 2 hours",
        difficulty: "Unrated",
        terrain: ["Mountain terrain"],
      },
      {
        id: "three-provinces-bobbejaankrans",
        name: "Bobbejaankrans Trail",
        distanceKm: 5,
        duration: "About 1.5 hours",
        difficulty: "Unrated",
        terrain: ["Mountain terrain"],
      },
      {
        id: "three-provinces-walletjiestraat",
        name: "Walletjiestraat",
        distanceKm: 1,
        duration: "About 30 minutes",
        difficulty: "Hard",
        terrain: ["Technical obstacles"],
        description: "Short technical challenge.",
      },
    ],
    researchStatus: "user-supplied-unverified",
  },
  {
    id: "kgalagadi",
    name: "Kgalagadi Transfrontier Park",
    aliases: ["Kgalagadi", "Kgalagadi Transfrontier Park", "Kgalagadi National Park"],
    locationDescription: "Northern Cape, South Africa / Botswana",
    summary: "Remote Kalahari wilderness destination; the Nossob Eco Trail is a separate guided multi-day route inside the park.",
    difficulty: "Hard",
    terrain: ["Deep desert sand", "Dunes", "Dry riverbeds"],
    priceNote: "Nossob Eco Trail reported at R3,762.25 per vehicle plus conservation fees; verify current SANParks tariff.",
    amenities: ["Wilderness camping", "Wildlife viewing", "Designated self-drive roads"],
    visitorNotes: [
      "Nossob Eco Trail requires advance booking through SANParks; ordinary park self-drive roads are a different experience.",
      "Reported guided group size 2–5 guest vehicles.",
      "Reported restrictions include no trailers and no children under 12 on the Eco Trail; verify directly.",
    ],
    trails: [
      {
        id: "kgalagadi-nossob-eco",
        name: "Nossob 4x4 Eco Trail",
        distanceKm: 214,
        duration: "4 days / 3 nights",
        difficulty: "Hard",
        terrain: ["Deep sand", "Dunes", "Dry riverbeds"],
        description: "Ranger-guided wilderness convoy with three remote overnight camps.",
        notes: ["High-clearance low-range 4x4 and full self-sufficiency required."],
      },
      {
        id: "kgalagadi-self-drive",
        name: "Designated Park Self-Drive Roads",
        difficulty: "Unrated",
        terrain: ["Sand", "Gravel", "Dry riverbeds"],
        description: "Regular designated park routes; not the 214 km guided Nossob Eco Trail.",
      },
    ],
    researchStatus: "user-supplied-unverified",
  },
];

/** Normalize small differences in Google Places venue naming. */
const normalizeDestinationName = (name: string): string =>
  name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");

/**
 * Returns curated data for a Google Places result, if known.
 * Use the actual Google Places name (not a trail name) as input.
 */
export function findCuratedDestination(
  googlePlaceName: string | null | undefined,
): CuratedDestination | undefined {
  if (!googlePlaceName) return undefined;
  const normalized = normalizeDestinationName(googlePlaceName);
  if (!normalized) return undefined;

  return curatedDestinations.find((destination) =>
    [destination.name, ...destination.aliases].some((candidate) => {
      const alias = normalizeDestinationName(candidate);
      return alias.length >= 7 && (alias === normalized ||
        (alias.length >= 11 && normalized.startsWith(alias)) ||
        (normalized.length >= 11 && alias.startsWith(normalized)));
    }),
  );
}

/** Optional helper when a venue's stable Google Place ID is available later. */
export function getCuratedDestinationById(
  id: string,
): CuratedDestination | undefined {
  return curatedDestinations.find((destination) => destination.id === id);
}
