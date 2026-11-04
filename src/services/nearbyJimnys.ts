import {
  collection, doc, getDoc, getDocs, query, where,
  setDoc, serverTimestamp, runTransaction, Timestamp,
} from "firebase/firestore";
import { auth, db } from "../firebase/firebase";

export type NearbyOwner = {
  id: string;
  name: string;
  profilePhotoURL: string | null;
  jimnyName: string;
  model: string;
  year: string;
  latitude: number;
  longitude: number;
  distanceFromUser: number;
  friendshipStatus: "none" | "sent" | "incoming" | "friends";
};

const GRID = 0.02;
const roundCoordinate = (value: number) => Math.round(value / GRID) * GRID;
const distanceKm = (a: number, b: number, c: number, d: number) => {
  const rad = (v: number) => (v * Math.PI) / 180;
  const x = rad(c - a);
  const y = rad(d - b);
  const h = Math.sin(x / 2) ** 2 +
    Math.cos(rad(a)) * Math.cos(rad(c)) * Math.sin(y / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};
const waveId = (a: string, b: string) => [a, b].sort().join("_");

export async function setNearbyVisibility(
  enabled: boolean,
  location?: { latitude: number; longitude: number }
) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Please sign in.");
  if (enabled && !location) throw new Error("Location permission required.");
  const ref = doc(db, "nearbyPresence", uid);
  if (!enabled) {
  await setDoc(ref, {
    uid,
    enabled: false,
    updatedAt: serverTimestamp(),
  });
  return;
}
  await setDoc(ref, {
    uid, enabled: true,
    latitude: roundCoordinate(location!.latitude),
    longitude: roundCoordinate(location!.longitude),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function getNearbyOwners(
  location: { latitude: number; longitude: number }
): Promise<NearbyOwner[]> {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];
  const [presence, sent, received] = await Promise.all([
    getDocs(query(collection(db, "nearbyPresence"), where("enabled", "==", true))),
    getDocs(query(collection(db, "waves"), where("senderId", "==", uid))),
    getDocs(query(collection(db, "waves"), where("recipientId", "==", uid))),
  ]);
  const states = new Map<string, NearbyOwner["friendshipStatus"]>();
  [...sent.docs, ...received.docs].forEach((snap) => {
    const wave = snap.data();
    const otherId = wave.senderId === uid ? wave.recipientId : wave.senderId;
    states.set(otherId, wave.status === "friends" ? "friends" :
      wave.senderId === uid ? "sent" : "incoming");
  });
  const matches = presence.docs.flatMap((snap) => {
    if (snap.id === uid) return [];
    const p = snap.data();
    if (typeof p.latitude !== "number" || typeof p.longitude !== "number" ||
        !(p.updatedAt instanceof Timestamp) ||
        Date.now() - p.updatedAt.toMillis() > 24 * 60 * 60 * 1000) return [];
    const distance = distanceKm(location.latitude, location.longitude, p.latitude, p.longitude);
    if (distance > 10) return [];
    return [{ id: snap.id, latitude: p.latitude as number,
      longitude: p.longitude as number, distance }];
  });
  const owners = await Promise.all(matches.map(async (p) => {
    const [userSnap, passportSnap] = await Promise.all([
      getDoc(doc(db, "users", p.id)),
      getDoc(doc(db, "passports", p.id)),
    ]);
    const profile = userSnap.data() ?? {};
    const vehicle = passportSnap.data()?.vehicle ?? {};
    return {
      id: p.id,
      name: typeof profile.fullName === "string" ? profile.fullName : "Jimny Owner",
      profilePhotoURL: typeof profile.profilePhotoURL === "string" ? profile.profilePhotoURL : null,
      jimnyName: typeof vehicle.nickname === "string" ? vehicle.nickname : "Jimny",
      model: typeof vehicle.model === "string" ? vehicle.model : "",
      year: vehicle.year ? String(vehicle.year) : "",
      latitude: p.latitude, longitude: p.longitude,
      distanceFromUser: Math.round(p.distance),
      friendshipStatus: states.get(p.id) ?? "none",
    } satisfies NearbyOwner;
  }));
  return owners.sort((a, b) => a.distanceFromUser - b.distanceFromUser);
}

export async function sendWave(recipientId: string) {
  const senderId = auth.currentUser?.uid;

  if (!senderId || senderId === recipientId) {
    throw new Error("Invalid wave.");
  }

  const id = waveId(senderId, recipientId);
  const ref = doc(db, "waves", id);

  // Create a new Wave without first reading
  // a document that may not exist.
  await setDoc(ref, {
    senderId,
    recipientId,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Notify the recipient.
  const sender = await getDoc(
    doc(db, "users", senderId)
  );

  await setDoc(
    doc(db, "users", recipientId, "notifications", `wave_${id}`),
    {
      type: "wave",
      senderId,
      recipientId,
      waveId: id,
      title: "Someone waved at you! 👋",
      body: `${sender.data()?.fullName || "A Jimny owner"} sent you a wave.`,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
  );
}

export async function waveBack(senderId: string) {
  const recipientId = auth.currentUser?.uid;
  if (!recipientId) throw new Error("Please sign in.");
  const id = waveId(senderId, recipientId);
  await runTransaction(db, async (tx) => {
    const ref = doc(db, "waves", id);
    const snap = await tx.get(ref);
    if (!snap.exists() || snap.data().senderId !== senderId ||
        snap.data().recipientId !== recipientId || snap.data().status !== "pending") {
      throw new Error("This wave is no longer pending.");
    }
    tx.update(ref, { status: "friends", updatedAt: serverTimestamp() });
  });
  const recipient = await getDoc(doc(db, "users", recipientId));
  await setDoc(doc(db, "users", senderId, "notifications", `waveback_${id}`), {
    type: "waveAccepted", senderId: recipientId, recipientId: senderId, waveId: id,
    title: "You made a new Jimny friend! 🚙",
    body: `${recipient.data()?.fullName || "A Jimny owner"} waved back!`,
    createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
}
