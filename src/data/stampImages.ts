// Local PNG artwork for the twelve Adventure Passport stamps.
export const stampImages = {
  dirt: require("../../assets/stamps/the_dirt_badge.png"),
  convoy: require("../../assets/stamps/the_convoy_badge.png"),
  camping: require("../../assets/stamps/the_camping_badge.png"),
  twin: require("../../assets/stamps/the_twin_badge.png"),
  explorer: require("../../assets/stamps/the_explorer_badge.png"),
  sunset: require("../../assets/stamps/the_sunset_badge.png"),
  sunrise: require("../../assets/stamps/the_sunrise_badge.png"),
  meetAndGreet: require("../../assets/stamps/the_meet_and_greet_badge.png"),
  convoyLeader: require("../../assets/stamps/the_convoy_leader_badge.png"),
  parkingBuddy: require("../../assets/stamps/the_parking_buddy_badge.png"),
  wildlifeSpotter: require("../../assets/stamps/the_wildlife_spotter_badge.png"),
  friendlyWave: require("../../assets/stamps/the_friendly_wave_badge.png"),
} as const;

export type StampImageKey = keyof typeof stampImages;

// Match artwork to existing quest stamp titles, without changing quest IDs or Firebase data.
export function getStampImage(name: string): number | undefined {
  const text = name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (text.includes("convoy") && text.includes("leader")) return stampImages.convoyLeader;
  if (text.includes("meet") && text.includes("greet")) return stampImages.meetAndGreet;
  if (text.includes("parking") && text.includes("buddy")) return stampImages.parkingBuddy;
  if (text.includes("wildlife") || text.includes("spotter")) return stampImages.wildlifeSpotter;
  if (text.includes("friendly") && text.includes("wave")) return stampImages.friendlyWave;
  if (text.includes("sunrise")) return stampImages.sunrise;
  if (text.includes("sunset")) return stampImages.sunset;
  if (text.includes("camp") || text.includes("sleep under") || text.includes("stars")) return stampImages.camping;
  if (text.includes("twin") || text.includes("twins")) return stampImages.twin;
  if (text.includes("explor")) return stampImages.explorer;
  if (text.includes("convoy")) return stampImages.convoy;
  if (text.includes("dirt") || text.includes("mud")) return stampImages.dirt;
  if (text.includes("wave")) return stampImages.friendlyWave;
  return undefined;
}
