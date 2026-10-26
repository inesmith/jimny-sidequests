import {initializeApp} from "firebase-admin/app";
import {getFirestore, FieldValue} from "firebase-admin/firestore";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";
import * as logger from "firebase-functions/logger";

initializeApp();

const placesApiKey = defineSecret("GOOGLE_PLACES_API_KEY");
const db = getFirestore();

type TrailResearch = {
  placeId: string;
  name: string;
  website: string | null;
  googleMapsUrl: string | null;
  trailLengthKm: number | null;
  estimatedDuration: string | null;
  terrain: string[];
  sourceUrl: string | null;
  researchStatus: "needs_research";
};

export const getTrailResearch = onCall(
  {
    region: "us-central1",
    maxInstances: 2,
    concurrency: 10,
    timeoutSeconds: 30,
    secrets: [placesApiKey],
    enforceAppCheck: false, // Enable once App Check is configured in Expo.
  },
  async (request): Promise<TrailResearch> => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Please sign in first.");
    }

    const placeId = request.data?.placeId;
    if (typeof placeId !== "string" ||
        !/^[A-Za-z0-9_-]{8,250}$/.test(placeId)) {
      throw new HttpsError("invalid-argument", "A valid Google Place ID is required.");
    }

    const ref = db.collection("trailResearch").doc(placeId);
    const cached = await ref.get();
    if (cached.exists) {
      const data = cached.data() as TrailResearch;
      return {
        placeId: data.placeId,
        name: data.name,
        website: data.website ?? null,
        googleMapsUrl: data.googleMapsUrl ?? null,
        trailLengthKm: data.trailLengthKm ?? null,
        estimatedDuration: data.estimatedDuration ?? null,
        terrain: data.terrain ?? [],
        sourceUrl: data.sourceUrl ?? null,
        researchStatus: "needs_research",
      };
    }

    const response = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      {
        headers: {
          "X-Goog-Api-Key": placesApiKey.value(),
          "X-Goog-FieldMask": "id,displayName,websiteUri,googleMapsUri",
        },
      },
    );

    if (!response.ok) {
      logger.warn("Place details lookup failed", {status: response.status});
      throw new HttpsError("unavailable", "Unable to retrieve destination details.");
    }

    const place = await response.json() as {
      id?: string;
      displayName?: {text?: string};
      websiteUri?: string;
      googleMapsUri?: string;
    };

    const result: TrailResearch = {
      placeId,
      name: place.displayName?.text ?? "Unnamed destination",
      website: place.websiteUri ?? null,
      googleMapsUrl: place.googleMapsUri ?? null,
      trailLengthKm: null,
      estimatedDuration: null,
      terrain: [],
      sourceUrl: null,
      researchStatus: "needs_research",
    };

    await ref.set({...result, createdAt: FieldValue.serverTimestamp()});
    return result;
  },
);
