import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Alert,
  Linking,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import MapView, {
  Marker,
  Circle,
  type Region,
} from "react-native-maps";
import * as Location from "expo-location";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";

import { colors, fonts } from "../theme/theme";
import BottomNav from "../components/BottomNav";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase/firebase";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase/firebase";

type PlaceSuggestion = { placeId: string; description: string };

const PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ?? "";

type HibernateTab =
  | "popular"
  | "jimnys";

type HibernateMode =
  | "adventures"
  | "quest";

type TrailDifficulty =
  | "Easy"
  | "Medium"
  | "Hard"
  | "Unrated";

type TrailResearchResult = {
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

const getTrailResearch = httpsCallable<{placeId: string}, TrailResearchResult>(functions, "getTrailResearch");

type Trail = {
  id: string;
  name: string;
  trailDistance: number;
  duration: string;
  terrain: string;
  difficulty: TrailDifficulty;
  latitude: number;
  longitude: number;
};

type NearbyJimny = {
  id: string;
  name: string;
  jimnyName: string;
  model: string;
  year: string;
  latitudeOffset: number;
  longitudeOffset: number;
};

type HibernateScreenProps = {
  mode?: HibernateMode;

  onBack?: () => void;

  onTrailSelected?: (
    trailName: string
  ) => Promise<void> | void;

  onExplore: () => void;
  onAdventures: () => void;
  onPassport: () => void;
  onProfile: () => void;
};

// Google Places Text Search (New) returns destinations, not full trail geometry.
// A place appearing in Google Maps does not verify public access or 4x4 suitability.
type GoogleTrailPlace = {
  id?: string;
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
  formattedAddress?: string;
  types?: string[];
  primaryType?: string;
};

// Filter obvious retailers and known false positives, but don't require
// "4x4" in the name: genuine trails can have names such as "De Wildt".
const EXCLUDED_PLACE_NAMES = /\b(?:4\s*[x×]\s*4\s*mega\s*world|big\s*red\s*barn|accessories|spares|fitment|workshop|dealership|tyres|products|industries|tours|adventures|club|quad|office|biking|mbt|hiking|tires|parts\s*shop|equipment\s*shop)\b/i;
const EXCLUDED_NON_TRAILS =/\b(?:acrobranch|caravan|caravans|camping\s+equipment|adventure\s+direct|zipline|zip\s*line|tree\s*top|treetop|paintball|quad\s*bike\s*rental)\b/i;
const RETAIL_NAME = /\b(?:shop|store|outlet|showroom|supplies|accessories|fitment|dealership|spares)\b/i;
const STRONG_TRAIL_NAME = /\b(?:4\s*[x×]\s*4|4wd|off[ -]?road|trail|trails|route|routes|adventure\s*park|obstacle|rock\s*crawl)\b/i;


function isLikelyOffroadDestination(place: GoogleTrailPlace): boolean {
  const name = place.displayName?.text ?? "";
  if (EXCLUDED_PLACE_NAMES.test(name) || RETAIL_NAME.test(name)) return false;
  const types = new Set([place.primaryType, ...(place.types ?? [])]);
  // Google can categorise legitimate trails as parks or tourist attractions.
  // Reject a retailer only if its name doesn't strongly suggest a route.
  const isRetail = ["store", "car_repair", "car_dealer", "shopping_mall",
    "hardware_store", "car_wash"].some((type) => types.has(type));
  return !isRetail || STRONG_TRAIL_NAME.test(name);
}

const TRAIL_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const TRAIL_SEARCH_TERMS = ["4x4 trail", "off road park", "4x4 route"];
// Keep searches bounded to avoid unexpected Google Places charges.
const MAX_SEARCH_REQUESTS = 6;
const TRAIL_SEARCH_TIMEOUT_MS = 9000;

// Search the user's centre first, then a few surrounding areas. These are
// sampled results, NOT a complete inventory of every trail in a large circle.
function searchCentres(latitude: number, longitude: number, radiusKm: number) {
  const centres = [{ latitude, longitude }];
  if (radiusKm <= 50) return centres;
  const distanceKm = Math.min(radiusKm * 0.65, 850);
  const longitudeScale = Math.max(0.2, Math.abs(Math.cos(degreesToRadians(latitude))));
  for (const bearing of [0, 90, 180, 270]) {
    const angle = degreesToRadians(bearing);
    centres.push({
      latitude: Math.max(-89, Math.min(89, latitude + (Math.cos(angle) * distanceKm) / 111.2)),
      longitude: longitude + (Math.sin(angle) * distanceKm) / (111.2 * longitudeScale),
    });
  }
  return centres;
}

const NEARBY_JIMNYS: NearbyJimny[] = [
  {
    id: "sarah",
    name: "Sarah M.",
    jimnyName: "Muddy",
    model: "JC",
    year: "2024",
    latitudeOffset: 0.012,
    longitudeOffset: -0.012,
  },
  {
    id: "james",
    name: "James K.",
    jimnyName: "Beast",
    model: "GLX",
    year: "2020",
    latitudeOffset: -0.016,
    longitudeOffset: -0.009,
  },
  {
    id: "thandi",
    name: "Thandi N.",
    jimnyName: "Sunny",
    model: "GA",
    year: "2023",
    latitudeOffset: 0.006,
    longitudeOffset: 0.018,
  },
  {
    id: "david",
    name: "David R.",
    jimnyName: "Rocky",
    model: "GLX",
    year: "2022",
    latitudeOffset: -0.012,
    longitudeOffset: 0.017,
  },
];

function degreesToRadians(
  degrees: number
) {
  return (degrees * Math.PI) / 180;
}

function calculateDistanceKm(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number
) {
  const earthRadiusKm = 6371;

  const latitudeDifference =
    degreesToRadians(
      latitude2 - latitude1
    );

  const longitudeDifference =
    degreesToRadians(
      longitude2 - longitude1
    );

  const a =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(
      degreesToRadians(latitude1)
    ) *
      Math.cos(
        degreesToRadians(latitude2)
      ) *
      Math.sin(
        longitudeDifference / 2
      ) **
        2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return earthRadiusKm * c;
}

export default function HibernateScreen({
  mode = "quest",
  onBack,
  onTrailSelected,
  onExplore,
  onAdventures,
  onPassport,
  onProfile,
}: HibernateScreenProps) {
  const [profilePhotoURL, setProfilePhotoURL] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (active) setProfilePhotoURL(null);
        return;
      }
      if (active) setProfilePhotoURL(user.photoURL ?? null);
      try {
        const snapshot = await getDoc(doc(db, "users", user.uid));
        const photo = snapshot.data()?.profilePhotoURL;
        if (active && typeof photo === "string" && photo) {
          setProfilePhotoURL(photo);
        }
      } catch (error) {
        console.warn("Could not load navigation profile photo:", error);
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const mapRef =
    useRef<MapView | null>(null);

  const [activeTab, setActiveTab] =
    useState<HibernateTab>("popular");

  const [userLocation, setUserLocation] =
    useState<{
      latitude: number;
      longitude: number;
    } | null>(null);

  const [locationError, setLocationError] =
    useState("");

  const [isLoadingLocation, setIsLoadingLocation] =
    useState(true);

  const [travelRadius, setTravelRadius] =
    useState(10);

  const [discoveredTrails, setDiscoveredTrails] = useState<Trail[]>([]);
  const [isLoadingTrails, setIsLoadingTrails] = useState(false);
  const [trailSearchError, setTrailSearchError] = useState("");
  const trailSearchRequest = useRef(0);

  const [sliderWidth, setSliderWidth] =
    useState(0);

  const [expandedTrail, setExpandedTrail] =
    useState<string | null>(null);
  const [trailDetails, setTrailDetails] = useState<Record<string, TrailResearchResult>>({});
  const [trailDetailsLoading, setTrailDetailsLoading] = useState<string | null>(null);
  const [trailDetailsErrors, setTrailDetailsErrors] = useState<Record<string, string>>({});

  const toggleTrailDetails = async (trail: Trail, retry = false) => {
    if (!retry && expandedTrail === trail.id) {
      setExpandedTrail(null);
      return;
    }
    setExpandedTrail(trail.id);
    if (trailDetails[trail.id] || trailDetailsLoading === trail.id) return;
    setTrailDetailsLoading(trail.id);
    setTrailDetailsErrors((previous) => ({...previous, [trail.id]: ""}));
    try {
      const response = await getTrailResearch({placeId: trail.id});
      setTrailDetails((previous) => ({...previous, [trail.id]: response.data}));
    } catch (error) {
      console.warn("Unable to load trail details:", error);
      setTrailDetailsErrors((previous) => ({
        ...previous,
        [trail.id]: "Couldn't load destination details. Please try again.",
      }));
    } finally {
      setTrailDetailsLoading((current) => current === trail.id ? null : current);
    }
  };

  const openDestinationLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Unable to open link", "Please try again later.");
    }
  };

  const [isSelectingTrail, setIsSelectingTrail] =
    useState(false);

  const [wavedOwners, setWavedOwners] =
    useState<string[]>([]);

  const [meetLocation, setMeetLocation] =
    useState("");

  const [meetDate, setMeetDate] = useState<Date | null>(null);
  const [datePickerMode, setDatePickerMode] = useState<"date" | "time" | null>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const placeRequestId = useRef(0);


  const [meetMessage, setMeetMessage] =
    useState("");

  useEffect(() => {
    const query = meetLocation.trim();
    const requestId = ++placeRequestId.current;
    if (selectedPlaceId || query.length < 3 || !PLACES_API_KEY) {
      setSuggestions([]);
      setLoadingSuggestions(false);
      return;
    }
    const timer = setTimeout(async () => {
      setLoadingSuggestions(true);
      try {
        const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": PLACES_API_KEY,
          },
          body: JSON.stringify({
            input: query,
            includedRegionCodes: ["za"],
          }),
        });
        if (!response.ok) throw new Error(`Places error: ${response.status}`);
        const result = await response.json();
        if (requestId !== placeRequestId.current) return;
        setSuggestions(
          (result.suggestions ?? [])
            .filter((item: any) => item.placePrediction?.placeId)
            .map((item: any) => ({
              placeId: item.placePrediction.placeId as string,
              description: item.placePrediction.text?.text as string ?? "",
            }))
        );
      } catch (error) {
        console.error("Location suggestions unavailable:", error);
        if (requestId === placeRequestId.current) setSuggestions([]);
      } finally {
        if (requestId === placeRequestId.current) setLoadingSuggestions(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [meetLocation, selectedPlaceId]);

  const onDateChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") setDatePickerMode(null);
    if (!selected) return;
    setMeetDate(selected);
    if (Platform.OS === "android" && datePickerMode === "date") {
      setTimeout(() => setDatePickerMode("time"), 100);
    }
  };

  const isQuestMode =
    mode === "quest";

  /*
   * LOAD LOCATION
   */
  useEffect(() => {
    const loadLocation = async () => {
      try {
        setIsLoadingLocation(true);
        setLocationError("");

        const permission =
          await Location.requestForegroundPermissionsAsync();

        if (
          permission.status !== "granted"
        ) {
          setLocationError(
            "Location access is needed to find trails near you."
          );

          return;
        }

        const location =
          await Location.getCurrentPositionAsync(
            {
              accuracy:
                Location.Accuracy.Balanced,
            }
          );

        const coordinates = {
          latitude:
            location.coords.latitude,
          longitude:
            location.coords.longitude,
        };

        setUserLocation(coordinates);
      } catch (error) {
        console.error(
          "Unable to load location:",
          error
        );

        setLocationError(
          "We couldn't find your current location."
        );
      } finally {
        setIsLoadingLocation(false);
      }
    };

    loadLocation();
  }, []);

  const mapRegion: Region | undefined =
    userLocation
      ? {
          latitude:
            userLocation.latitude,
          longitude:
            userLocation.longitude,
          latitudeDelta: 0.09,
          longitudeDelta: 0.09,
        }
      : undefined;

  // Search after dragging settles. A request limit protects the prototype's
  // Google Places billing; wide radii provide sampled, not exhaustive, results.
  useEffect(() => {
    if (!userLocation || activeTab !== "popular") return;
    const requestId = ++trailSearchRequest.current;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (!PLACES_API_KEY) {
        setTrailSearchError("Google Places API key is missing. Check your .env file.");
        setIsLoadingTrails(false);
        return;
      }
      setIsLoadingTrails(true);
      setTrailSearchError("");
      const { latitude, longitude } = userLocation;
      const centres = searchCentres(latitude, longitude, travelRadius);
      // Nearby: three keyword searches. Wider: one keyword per sampled area,
      // with a sixth search for additional coverage around the user.
      const tasks = travelRadius <= 50
        ? TRAIL_SEARCH_TERMS.map((term) => ({ term, centre: centres[0] }))
        : centres.map((centre, index) => ({
            term: TRAIL_SEARCH_TERMS[index % TRAIL_SEARCH_TERMS.length], centre,
          })).concat([{ term: "4x4 adventure park", centre: centres[0] }]);
      const found = new Map<string, Trail>();
      let successes = 0;
      let lastError = "";
      try {
        for (const { term, centre } of tasks.slice(0, MAX_SEARCH_REQUESTS)) {
          if (controller.signal.aborted || requestId !== trailSearchRequest.current) return;
          const timeout = setTimeout(() => controller.abort(), TRAIL_SEARCH_TIMEOUT_MS);
          try {
            const response = await fetch(TRAIL_SEARCH_URL, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Goog-Api-Key": PLACES_API_KEY,
                "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.formattedAddress,places.types,places.primaryType",
              },
              body: JSON.stringify({
                textQuery: term,
                languageCode: "en",
                pageSize: 20,
                locationBias: {
                  circle: {
                    center: { latitude: centre.latitude, longitude: centre.longitude },
                    radius: Math.min(50000, Math.max(1000, travelRadius * 1000)),
                  },
                },
              }),
              signal: controller.signal,
            });
            if (!response.ok) {
              const detail = await response.text();
              throw new Error(`Google Places ${response.status}: ${detail.slice(0, 240)}`);
            }
            const data: { places?: GoogleTrailPlace[] } = await response.json();
            successes++;
            for (const place of data.places ?? []) {
              const lat = place.location?.latitude;
              const lng = place.location?.longitude;
              if (!place.id || !place.displayName?.text || lat == null || lng == null) continue;
              if (!isLikelyOffroadDestination(place)) continue;
              if (calculateDistanceKm(latitude, longitude, lat, lng) > travelRadius) continue;
              found.set(place.id, {
                id: place.id,
                name: place.displayName.text,
                trailDistance: 0,
                duration: "Not listed",
                terrain: "Not verified",
                difficulty: "Unrated",
                latitude: lat,
                longitude: lng,
              });
            }
            // Show successful results progressively, rather than waiting for all searches.
            if (requestId === trailSearchRequest.current) setDiscoveredTrails([...found.values()]);
          } catch (error) {
            if (controller.signal.aborted) {
              lastError = "Search timed out. Please try again.";
              break;
            }
            lastError = error instanceof Error ? error.message : "Google Places search failed";
            console.warn("Google Places trail search:", lastError);
            // Permission / billing errors won't be fixed by retrying other search terms.
            if (/Google Places (400|401|403)/.test(lastError)) break;
          } finally {
            clearTimeout(timeout);
          }
        }
        if (requestId !== trailSearchRequest.current) return;
        if (!successes) {
          setTrailSearchError(
            /Google Places (400|401|403)/.test(lastError)
              ? "Google Places Text Search is not authorised. Check API enablement, billing and key restrictions."
              : "Couldn't load destinations right now. Check your connection and try again."
          );
          setDiscoveredTrails([]);
        } else {
          setTrailSearchError(successes < tasks.length ? "Some areas could not be searched; showing available results." : "");
        }
      } finally {
        if (requestId === trailSearchRequest.current) setIsLoadingTrails(false);
      }
    }, 850);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [userLocation?.latitude, userLocation?.longitude, travelRadius, activeTab]);

  // Update the camera whenever the radius changes, including after the map mounts.
  useEffect(() => {
    if (!userLocation || activeTab !== "popular") return;
    const latitudeDelta = Math.min(150, Math.max(0.04, travelRadius * 2.4 / 111));
    const longitudeDelta = Math.min(160, latitudeDelta / Math.max(0.25, Math.cos(degreesToRadians(userLocation.latitude))));
    const timer = setTimeout(() => {
      mapRef.current?.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta,
        longitudeDelta,
      }, 300);
    }, 100);
    return () => clearTimeout(timer);
  }, [userLocation?.latitude, userLocation?.longitude, travelRadius, activeTab]);

  const visibleTrails = useMemo(() => {
    if (!userLocation) return [];
    return discoveredTrails
      .map((trail) => ({
        ...trail,
        distanceFromUser: calculateDistanceKm(
          userLocation.latitude, userLocation.longitude,
          trail.latitude, trail.longitude
        ),
      }))
      .filter((trail) => trail.distanceFromUser <= travelRadius)
      .sort((a, b) => a.distanceFromUser - b.distanceFromUser);
  }, [discoveredTrails, userLocation, travelRadius]);

  const nearbyJimnys =
    useMemo(() => {
      if (!userLocation) {
        return [];
      }

      return NEARBY_JIMNYS.map(
        (owner) => {
          const latitude =
            userLocation.latitude +
            owner.latitudeOffset;

          const longitude =
            userLocation.longitude +
            owner.longitudeOffset;

          return {
            ...owner,
            latitude,
            longitude,
            distanceFromUser:
              calculateDistanceKm(
                userLocation.latitude,
                userLocation.longitude,
                latitude,
                longitude
              ),
          };
        }
      ).sort(
        (a, b) =>
          a.distanceFromUser -
          b.distanceFromUser
      );
    }, [userLocation]);

  const changeTab = (
    tab: HibernateTab
  ) => {
    setActiveTab(tab);

    if (
      userLocation &&
      mapRef.current
    ) {
      mapRef.current.animateToRegion(
        {
          latitude:
            userLocation.latitude,
          longitude:
            userLocation.longitude,
          latitudeDelta: 0.09,
          longitudeDelta: 0.09,
        },
        350
      );
    }
  };

  const updateRadiusFromPress = (
    locationX: number
  ) => {
    if (sliderWidth <= 0) {
      return;
    }

    const percentage = Math.min(
      1,
      Math.max(
        0,
        locationX / sliderWidth
      )
    );

    let nextRadius =
      Math.round(
        (percentage * 1000) / 10
      ) * 10;

    if (nextRadius < 10) {
      nextRadius = 10;
    }

    setTravelRadius(nextRadius);
  };

  /*
   * SELECT TRAIL
   *
   * Only available when Hibernate
   * was opened from an active quest.
   */
  const selectTrail = async (
    trail: Trail
  ) => {
    if (
      !isQuestMode ||
      !onTrailSelected ||
      isSelectingTrail
    ) {
      return;
    }

    try {
      setIsSelectingTrail(true);

      await onTrailSelected(
        trail.name
      );
    } catch (error) {
      console.error(
        "Unable to select trail:",
        error
      );

      Alert.alert(
        "Something went wrong",
        "We couldn't save this trail. Please try again."
      );
    } finally {
      setIsSelectingTrail(false);
    }
  };

  const waveAtOwner = (
    ownerId: string
  ) => {
    setWavedOwners((current) =>
      current.includes(ownerId)
        ? current
        : [...current, ownerId]
    );
  };

  const sendMeetUpInvite = () => {
    if (
      !meetLocation.trim() ||
      !meetDate || !selectedPlaceId || meetDate.getTime() <= Date.now()
    ) {
      Alert.alert(
        "Missing details",
        "Select a suggested location and a future date and time before continuing."
      );

      return;
    }

    Alert.alert(
      "Meet & Greet ready",
      "Your Meet & Greet details are ready in this prototype. No invitations have been sent."
    );

    setMeetLocation("");
    setMeetDate(null);
    setSelectedPlaceId(null);
    setSuggestions([]);
    setMeetMessage("");
  };

  const renderMap = () => {
    if (isLoadingLocation) {
      return (
        <View style={styles.mapLoading}>
          <ActivityIndicator
            color={colors.green}
          />

          <Text style={styles.mapLoadingText}>
            Finding your location...
          </Text>
        </View>
      );
    }

    if (
      locationError ||
      !userLocation ||
      !mapRegion
    ) {
      return (
        <View style={styles.mapLoading}>
          <MaterialIcons
            name="location-off"
            size={30}
            color={colors.red}
          />

          <Text style={styles.mapErrorText}>
            {locationError ||
              "Location unavailable."}
          </Text>
        </View>
      );
    }

    return (
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={mapRegion}
        onMapReady={() => {
          if (!userLocation || activeTab !== "popular") return;
          const latitudeDelta = Math.min(150, Math.max(0.04, travelRadius * 2.4 / 111));
          mapRef.current?.animateToRegion({
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            latitudeDelta,
            longitudeDelta: Math.min(160, latitudeDelta / Math.max(0.25, Math.cos(degreesToRadians(userLocation.latitude)))),
          }, 300);
        }}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
      >
        {activeTab === "popular" && userLocation && (
          <Circle
            center={userLocation}
            radius={travelRadius * 1000}
            strokeColor={colors.green}
            fillColor="rgba(44, 112, 73, 0.09)"
            strokeWidth={2}
          />
        )}
        {activeTab === "popular"
          ? visibleTrails.map(
              (trail) => (
                <Marker
                  key={trail.id}
                  coordinate={{
                    latitude:
                      trail.latitude,
                    longitude:
                      trail.longitude,
                  }}
                  title={trail.name}
                  description={`${trail.difficulty} • ${trail.terrain}`}
                  pinColor={colors.red}
                />
              )
            )
          : nearbyJimnys.map(
              (owner) => (
                <Marker
                  key={owner.id}
                  coordinate={{
                    latitude:
                      owner.latitude,
                    longitude:
                      owner.longitude,
                  }}
                  title={owner.name}
                  description={`${owner.jimnyName} • ${owner.model} ${owner.year}`}
                  pinColor={colors.red}
                />
              )
            )}
      </MapView>
    );
  };

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top", "bottom"]}
    >
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        {/* Fixed header — matches Explore */}
        <View style={styles.header}>
          {isQuestMode ? (
            <Pressable onPress={onBack} hitSlop={10} style={styles.headerIconButton}>
              <MaterialIcons name="arrow-back" size={27} color={colors.text} />
            </Pressable>
          ) : (
            <View style={styles.headerIconButton} />
          )}
          <Text style={styles.headerTitle}>Hibernate</Text>
          <View style={styles.headerIconButton} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
          alwaysBounceVertical={false}
          overScrollMode="never"
        >
          <View style={styles.content}>
            <Text
              style={styles.subtitle}
            >
              {activeTab === "popular"
                ? "Find the most popular trails near you."
                : "Find fellow Jimny owners near you."}
            </Text>

            {/* MAP */}
            <View
              style={styles.mapContainer}
            >
              {renderMap()}
            </View>

            {/* TABS */}
            <View
              style={styles.tabContainer}
            >
              <Pressable
                onPress={() =>
                  changeTab("popular")
                }
                style={[
                  styles.tab,
                  activeTab ===
                    "popular" &&
                    styles.activeTab,
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab ===
                      "popular" &&
                      styles.activeTabText,
                  ]}
                >
                  Popular Locations
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  changeTab("jimnys")
                }
                style={[
                  styles.tab,
                  activeTab ===
                    "jimnys" &&
                    styles.activeTab,
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab ===
                      "jimnys" &&
                      styles.activeTabText,
                  ]}
                >
                  Jimny’s Near You
                </Text>
              </Pressable>
            </View>

            {activeTab === "popular" ? (
              <>
                {/* TRAVEL RADIUS */}
                <View
                  style={
                    styles.radiusCard
                  }
                >
                  <View
                    style={
                      styles.radiusHeadingRow
                    }
                  >
                    <Text
                      style={
                        styles.radiusHeading
                      }
                    >
                      Travel radius
                    </Text>

                    <Text
                      style={
                        styles.radiusMeta
                      }
                    >
                      Max distance
                    </Text>
                  </View>

                  <View
                    style={
                      styles.radiusSelectedRow
                    }
                  >
                    <Text
                      style={
                        styles.radiusMeta
                      }
                    >
                      Selected distance
                    </Text>

                    <Text
                      style={
                        styles.radiusValue
                      }
                    >
                      {travelRadius.toLocaleString()}{" "}
                      km
                    </Text>
                  </View>

                  <View
                    style={
                      styles.sliderTouchArea
                    }
                    onStartShouldSetResponder={() => true}
                    onMoveShouldSetResponder={(event) =>
                      Math.abs(event.nativeEvent.pageX) >= 0
                    }
                    onResponderGrant={(event) =>
                      updateRadiusFromPress(event.nativeEvent.locationX)
                    }
                    onResponderMove={(event) =>
                      updateRadiusFromPress(event.nativeEvent.locationX)
                    }
                    onLayout={(event) =>
                      setSliderWidth(
                        event.nativeEvent
                          .layout.width
                      )
                    }
                  >
                    <View
                      style={
                        styles.sliderTrack
                      }
                    />

                    <View
                      pointerEvents="none"
                      style={[
                        styles.sliderThumb,
                        {
                          left:
                            sliderWidth > 0
                              ? Math.min(
                                  sliderWidth -
                                    20,
                                  Math.max(
                                    0,
                                    (travelRadius /
                                      1000) *
                                      sliderWidth -
                                      10
                                  )
                                )
                              : 0,
                        },
                      ]}
                    />
                  </View>

                  <View
                    style={
                      styles.sliderLabels
                    }
                  >
                    <Text
                      style={
                        styles.sliderLabel
                      }
                    >
                      0 km
                    </Text>

                    <Text
                      style={
                        styles.sliderLabel
                      }
                    >
                      1,000 km
                    </Text>
                  </View>

                  <Text
                    style={
                      styles.radiusDescription
                    }
                  >
                    Showing destinations within{" "}
                    {travelRadius.toLocaleString()}{" "}
                    km of your current
                    location.
                  </Text>
                </View>

                <Text
                  style={
                    styles.sectionHeading
                  }
                >
                  4X4 DESTINATIONS NEAR YOU
                </Text>

                <Text
                  style={
                    styles.sectionDescription
                  }
                >
                  Explore nearby 4x4 destinations and see how far they are from your current location.
                </Text>

                {!userLocation && !isLoadingLocation && (
                  <Text style={styles.searchStatusText}>Enable location access to find destinations near you.</Text>
                )}
                {isLoadingTrails && (
                  <View style={styles.searchStatus}>
                    <ActivityIndicator color={colors.green} />
                    <Text style={styles.searchStatusText}>Finding 4x4 destinations near you...</Text>
                  </View>
                )}
                {travelRadius > 50 && (
                  <Text style={styles.searchStatusText}>
                    Large-area searches show a selection of Google Maps places, not every trail within {travelRadius.toLocaleString()} km.
                  </Text>
                )}
                {!!trailSearchError && (
                  <Text style={styles.searchStatusText}>{trailSearchError}</Text>
                )}
                <Text style={styles.mapAttribution}>
                  Destinations from Google Maps. Trail access, difficulty and 4x4 suitability are not verified.
                </Text>
                <View
                  style={
                    styles.trailList
                  }
                >
                  {visibleTrails.length ===
                  0 ? (
                    <View
                      style={
                        styles.emptyCard
                      }
                    >
                      <Text
                        style={
                          styles.emptyText
                        }
                      >
                        {isLoadingTrails ? "Searching for destinations..." : "No 4x4 destinations found in this search area."}
                      </Text>
                    </View>
                  ) : (
                    visibleTrails.map(
                      (trail) => {
                        const isExpanded =
                          expandedTrail ===
                          trail.id;

                        return (
                          <View
                            key={
                              trail.id
                            }
                            style={
                              styles.trailCard
                            }
                          >
                            <View
                              style={
                                styles.trailTopRow
                              }
                            >
                              <View
                                style={
                                  styles.trailTitleArea
                                }
                              >
                                <Text
                                  style={
                                    styles.trailTitle
                                  }
                                >
                                  {
                                    trail.name
                                  }
                                </Text>

                                <Text
                                  style={
                                    styles.trailSummary
                                  }
                                >
                                  {trail.trailDistance > 0 ? `${trail.trailDistance} km` : "Distance not listed"} •{" "}
                                  {
                                    trail.duration
                                  }
                                </Text>
                              </View>

                              <View
                                style={[
                                  styles.difficultyBadge,
                                  trail.difficulty ===
                                    "Easy" &&
                                    styles.easyBadge,
                                  trail.difficulty ===
                                    "Medium" &&
                                    styles.mediumBadge,
                                  trail.difficulty ===
                                    "Hard" &&
                                    styles.hardBadge,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.difficultyText,
                                    trail.difficulty ===
                                      "Easy" &&
                                      styles.easyText,
                                    trail.difficulty ===
                                      "Medium" &&
                                      styles.mediumText,
                                    trail.difficulty ===
                                      "Hard" &&
                                      styles.hardText,
                                  ]}
                                >
                                  {
                                    trail.difficulty
                                  }
                                </Text>
                              </View>
                            </View>

                            <View
                              style={
                                styles.metricsRow
                              }
                            >
                              <MetricBox
                                label="Distance"
                                value={trail.trailDistance > 0 ? `${trail.trailDistance} km` : "Not listed"}
                              />

                              <MetricBox
                                label="Duration"
                                value={
                                  trail.duration
                                }
                              />

                              <MetricBox
                                label="Terrain"
                                value={
                                  trail.terrain
                                }
                              />
                            </View>

                            <View
                              style={
                                styles.trailBottomRow
                              }
                            >
                              <Text
                                style={
                                  styles.distanceFromUser
                                }
                              >
                                {trail.distanceFromUser.toFixed(
                                  1
                                )}{" "}
                                km from you
                              </Text>

                              <Pressable
                                onPress={() => { void toggleTrailDetails(trail); }}
                                style={
                                  styles.detailsButton
                                }
                              >
                                <Text
                                  style={
                                    styles.detailsText
                                  }
                                >
                                  {isExpanded
                                    ? "Hide details"
                                    : "View details"}
                                </Text>

                                <MaterialIcons
                                  name={
                                    isExpanded
                                      ? "keyboard-arrow-up"
                                      : "arrow-forward"
                                  }
                                  size={21}
                                  color={
                                    colors.green
                                  }
                                />
                              </Pressable>
                            </View>

                            {isExpanded && (
                              <View
                                style={
                                  styles.expandedArea
                                }
                              >
                                {trailDetailsLoading === trail.id && (
                                  <ActivityIndicator color={colors.green} style={{marginBottom: 12}} />
                                )}
                                {!!trailDetailsErrors[trail.id] && (
                                  <Pressable onPress={() => { void toggleTrailDetails(trail, true); }}>
                                    <Text style={styles.expandedText}>{trailDetailsErrors[trail.id]} Tap to retry.</Text>
                                  </Pressable>
                                )}
                                {!trailDetails[trail.id] && (
                                  <Pressable style={{marginBottom: 12}} onPress={() => {
                                    void openDestinationLink(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trail.name)}&query_place_id=${encodeURIComponent(trail.id)}`);
                                  }}>
                                    <Text style={styles.detailsText}>Open in Google Maps ↗</Text>
                                  </Pressable>
                                )}
                                {trailDetails[trail.id] && (
                                  <View style={{gap: 8, marginBottom: 14}}>
                                    <Text style={styles.expandedText}>
                                      {trailDetails[trail.id].trailLengthKm != null
                                        ? `Trail length: ${trailDetails[trail.id].trailLengthKm} km`
                                        : "Trail length: Not verified"}
                                    </Text>
                                    <Text style={styles.expandedText}>
                                      {`Duration: ${trailDetails[trail.id].estimatedDuration ?? "Not verified"}`}
                                    </Text>
                                    <Text style={styles.expandedText}>
                                      {`Terrain: ${trailDetails[trail.id].terrain.length
                                        ? trailDetails[trail.id].terrain.join(", ")
                                        : "Not verified"}`}
                                    </Text>
                                    {trailDetails[trail.id].website ? (
                                      <Pressable onPress={() => { void openDestinationLink(trailDetails[trail.id].website!); }}>
                                        <Text style={styles.detailsText}>Visit destination website ↗</Text>
                                      </Pressable>
                                    ) : (
                                      <Text style={styles.expandedText}>Destination website: Not listed</Text>
                                    )}
                                    <Pressable onPress={() => {
                                      const mapsUrl = trailDetails[trail.id].googleMapsUrl ||
                                        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(trail.name)}&query_place_id=${encodeURIComponent(trail.id)}`;
                                      void openDestinationLink(mapsUrl);
                                    }}>
                                      <Text style={styles.detailsText}>Open in Google Maps ↗</Text>
                                    </Pressable>
                                    {!!trailDetails[trail.id].sourceUrl && (
                                      <Pressable onPress={() => { void openDestinationLink(trailDetails[trail.id].sourceUrl!); }}>
                                        <Text style={styles.detailsText}>View trail information source ↗</Text>
                                      </Pressable>
                                    )}
                                  </View>
                                )}
                                {isQuestMode ? (
                                  <>
                                    <Text
                                      style={
                                        styles.expandedText
                                      }
                                    >
                                      Ready to make{" "}
                                      {
                                        trail.name
                                      }{" "}
                                      your trail for
                                      this Side Quest?
                                    </Text>

                                    <Pressable
                                      disabled={
                                        isSelectingTrail
                                      }
                                      onPress={() =>
                                        selectTrail(
                                          trail
                                        )
                                      }
                                      style={
                                        styles.selectTrailButton
                                      }
                                    >
                                      {isSelectingTrail ? (
                                        <ActivityIndicator
                                          color={
                                            colors.white
                                          }
                                        />
                                      ) : (
                                        <Text
                                          style={
                                            styles.selectTrailButtonText
                                          }
                                        >
                                          SELECT THIS
                                          TRAIL
                                        </Text>
                                      )}
                                    </Pressable>
                                  </>
                                ) : (
                                  <Text
                                    style={
                                      styles.expandedText
                                    }
                                  >
                                    {trail.name} is a Google Maps destination. Check access, opening times and 4x4 suitability before visiting.
                                  </Text>
                                )}
                              </View>
                            )}
                          </View>
                        );
                      }
                    )
                  )}
                </View>
              </>
            ) : (
              <View
                style={styles.ownerList}
              >
                {nearbyJimnys.map(
                  (owner) => {
                    const waved =
                      wavedOwners.includes(
                        owner.id
                      );

                    return (
                      <View
                        key={owner.id}
                        style={
                          styles.ownerCard
                        }
                      >
                        <View
                          style={
                            styles.avatar
                          }
                        >
                          <MaterialIcons
                            name="person"
                            size={34}
                            color={
                              colors.textSecondary
                            }
                          />
                        </View>

                        <View
                          style={
                            styles.ownerInfo
                          }
                        >
                          <Text
                            style={
                              styles.ownerName
                            }
                          >
                            {owner.name}
                          </Text>

                          <Text
                            style={
                              styles.ownerDetails
                            }
                            numberOfLines={
                              2
                            }
                          >
                            {
                              owner.jimnyName
                            }{" "}
                            • {owner.model}{" "}
                            {owner.year} •{" "}
                            {owner.distanceFromUser.toFixed(
                              1
                            )}{" "}
                            km
                          </Text>
                        </View>

                        <Pressable
                          onPress={() =>
                            waveAtOwner(
                              owner.id
                            )
                          }
                          style={[
                            styles.waveButton,
                            waved &&
                              styles.waveButtonActive,
                          ]}
                        >
                          <Text
                            style={
                              styles.waveButtonText
                            }
                          >
                            {waved
                              ? "Waved ✓"
                              : "Wave"}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  }
                )}
              </View>
            )}

            {/* MEET & GREET */}
            <View
              style={styles.meetCard}
            >
              <Text
                style={styles.meetTitle}
              >
                Start a Meet & Greet
              </Text>

              <TextInput
                value={meetLocation}
                onChangeText={(value) => {
                  setMeetLocation(value);
                  setSelectedPlaceId(null);
                }}
                placeholder="Search for a meeting location"
                placeholderTextColor="#A7ADBA"
                style={styles.input}
                autoCorrect={false}
              />
              {loadingSuggestions ? (
                <ActivityIndicator color={colors.green} style={styles.suggestionLoading} />
              ) : null}
              {suggestions.length > 0 ? (
                <View style={styles.suggestionsBox}>
                  {suggestions.map((place) => (
                    <Pressable
                      key={place.placeId}
                      style={styles.suggestionItem}
                      onPress={() => {
                        setMeetLocation(place.description);
                        setSelectedPlaceId(place.placeId);
                        setSuggestions([]);
                      }}
                    >
                      <MaterialIcons name="place" size={19} color={colors.green} />
                      <Text style={styles.suggestionText}>{place.description}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {!PLACES_API_KEY ? (
                <Text style={styles.inputHint}>
                  Add EXPO_PUBLIC_GOOGLE_PLACES_API_KEY to your .env to enable address suggestions.
                </Text>
              ) : null}

              <Pressable
                onPress={() => setDatePickerMode("date")}
                style={[styles.input, styles.dateButton]}
              >
                <Text style={[styles.dateButtonText, !meetDate && styles.placeholderText]}>
                  {meetDate
                    ? meetDate.toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })
                    : "Select date"}
                </Text>
                <MaterialIcons name="event" size={21} color={colors.green} />
              </Pressable>
              <Pressable
                onPress={() => setDatePickerMode("time")}
                style={[styles.input, styles.dateButton]}
              >
                <Text style={[styles.dateButtonText, !meetDate && styles.placeholderText]}>
                  {meetDate
                    ? meetDate.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false })
                    : "Select time"}
                </Text>
                <MaterialIcons name="schedule" size={21} color={colors.green} />
              </Pressable>
              {datePickerMode && Platform.OS === "ios" ? (
                <Modal transparent animationType="fade" visible onRequestClose={() => setDatePickerMode(null)}>
                  <View style={styles.pickerOverlay}>
                    <View style={styles.pickerPanel}>
                      <Pressable onPress={() => setDatePickerMode(null)} style={styles.pickerDone}>
                        <Text style={styles.pickerDoneText}>Done</Text>
                      </Pressable>
                      <DateTimePicker
                        value={meetDate ?? new Date()}
                        mode={datePickerMode}
                        display="spinner"
                        minimumDate={datePickerMode === "date" ? new Date() : undefined}
                        onChange={onDateChange}
                      />
                    </View>
                  </View>
                </Modal>
              ) : datePickerMode ? (
                <DateTimePicker
                  value={meetDate ?? new Date()}
                  mode={datePickerMode}
                  minimumDate={datePickerMode === "date" ? new Date() : undefined}
                  onChange={onDateChange}
                />
              ) : null}

              <TextInput
                value={meetMessage}
                onChangeText={
                  setMeetMessage
                }
                placeholder="Add invite message..."
                placeholderTextColor="#A7ADBA"
                multiline
                textAlignVertical="top"
                style={[
                  styles.input,
                  styles.messageInput,
                ]}
              />

              <Pressable
                onPress={
                  sendMeetUpInvite
                }
                style={
                  styles.sendButton
                }
              >
                <Text
                  style={
                    styles.sendButtonText
                  }
                >
                  SEND MEET-UP INVITE
                </Text>
              </Pressable>

              <Text
                style={styles.meetNote}
              >
                Prototype preview only — invitations are not sent yet.
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* BOTTOM NAV */}
        <BottomNav
          selected="hibernate"
          onExplore={onExplore}
          onHibernate={onAdventures}
          onPassport={onPassport}
          onProfile={onProfile}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type MetricBoxProps = {
  label: string;
  value: string;
};

function MetricBox({
  label,
  value,
}: MetricBoxProps) {
  return (
    <View style={styles.metricBox}>
      <Text style={styles.metricLabel}>
        {label}
      </Text>

      <Text
        style={styles.metricValue}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

  scroll: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: 26,
  },

  content: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
  },

  header: {
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },

  headerIconButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    flex: 1,
    paddingHorizontal: 10,
    fontFamily: fonts.extraBold,
    fontSize: 16,
    lineHeight: 23,
    textAlign: "center",
    color: colors.red,
  },

  subtitle: {
    marginTop: 4,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },

  mapContainer: {
    width: "100%",
    aspectRatio: 1.78,
    marginTop: 17,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: colors.green,
    borderRadius: 10,
    backgroundColor: "#E8E8E2",
  },

  map: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },

  mapLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  mapLoadingText: {
    marginTop: 9,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },

  mapErrorText: {
    marginTop: 8,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    color: colors.textSecondary,
  },

  tabContainer: {
    width: "100%",
    minHeight: 51,
    flexDirection: "row",
    marginTop: 22,
    padding: 4,
    borderWidth: 1.5,
    borderColor: colors.orange,
    borderRadius: 10,
    backgroundColor: colors.background,
  },

  tab: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    borderRadius: 8,
  },

  activeTab: {
    backgroundColor: colors.orange,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },

  tabText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    textAlign: "center",
    color: colors.textSecondary,
  },

  activeTabText: {
    fontFamily: fonts.extraBold,
    color: colors.white,
  },

  radiusCard: {
    width: "100%",
    marginTop: 28,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: colors.green,
    borderRadius: 8,
  },

  radiusHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  radiusHeading: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
    color: colors.text,
  },

  radiusMeta: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textSecondary,
  },

  radiusSelectedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 11,
  },

  radiusValue: {
    fontFamily: fonts.extraBold,
    fontSize: 17,
    color: colors.green,
  },

  sliderTouchArea: {
    width: "100%",
    height: 30,
    justifyContent: "center",
    marginTop: 5,
  },

  sliderTrack: {
    width: "100%",
    height: 5,
    borderRadius: 3,
    backgroundColor: "#DEDCD5",
  },

  sliderThumb: {
    position: "absolute",
    width: 20,
    height: 20,
    top: 5,
    borderWidth: 2,
    borderColor: colors.green,
    borderRadius: 10,
    backgroundColor: colors.background,
  },

  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  sliderLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textSecondary,
  },

  radiusDescription: {
    marginTop: 10,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },

  sectionHeading: {
    marginTop: 19,
    fontFamily: fonts.extraBold,
    fontSize: 12,
    lineHeight: 17,
    color: colors.red,
  },

  sectionDescription: {
    marginTop: 5,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 17,
    color: colors.textSecondary,
  },

  searchStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
  searchStatusText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 8,
  },
  mapAttribution: {
    marginTop: 10,
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 14,
    color: colors.textSecondary,
  },
  trailList: {
    width: "100%",
    marginTop: 15,
    gap: 13,
  },

  trailCard: {
    width: "100%",
    padding: 14,
    borderWidth: 1.5,
    borderColor: colors.green,
    borderRadius: 8,
  },

  trailTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },

  trailTitleArea: {
    flex: 1,
    minWidth: 0,
  },

  trailTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
  },

  trailSummary: {
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },

  difficultyBadge: {
    flexShrink: 0,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: 20,
  },

  easyBadge: {
    borderColor: colors.green,
    backgroundColor: "#E3F4E8",
  },

  mediumBadge: {
    borderColor: colors.orange,
    backgroundColor: "#FFF0DE",
  },

  hardBadge: {
    borderColor: colors.red,
    backgroundColor: "#FFE7E3",
  },

  difficultyText: {
    fontFamily: fonts.extraBold,
    fontSize: 11,
  },

  easyText: {
    color: colors.green,
  },

  mediumText: {
    color: "#B74C00",
  },

  hardText: {
    color: colors.red,
  },

  metricsRow: {
    width: "100%",
    flexDirection: "row",
    gap: 9,
    marginTop: 12,
  },

  metricBox: {
    flex: 1,
    minWidth: 0,
    minHeight: 55,
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: colors.green,
    borderRadius: 5,
  },

  metricLabel: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.textSecondary,
  },

  metricValue: {
    marginTop: 2,
    fontFamily: fonts.extraBold,
    fontSize: 12,
    lineHeight: 15,
    color: colors.text,
  },

  trailBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 11,
  },

  distanceFromUser: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },

  detailsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  detailsText: {
    fontFamily: fonts.extraBold,
    fontSize: 12,
    color: colors.green,
  },

  expandedArea: {
    marginTop: 13,
    paddingTop: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },

  expandedText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },

  selectTrailButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    borderRadius: 4,
    backgroundColor: colors.green,
  },

  selectTrailButtonText: {
    fontFamily: fonts.extraBold,
    fontSize: 13,
    color: colors.white,
  },

  emptyCard: {
    padding: 20,
    borderWidth: 1.5,
    borderColor: colors.green,
    borderRadius: 8,
  },

  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    textAlign: "center",
    color: colors.textSecondary,
  },

  ownerList: {
    width: "100%",
    marginTop: 27,
    gap: 12,
  },

  ownerCard: {
    width: "100%",
    minHeight: 84,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: colors.green,
    borderRadius: 8,
  },

  avatar: {
    width: 52,
    height: 52,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.red,
    borderRadius: 26,
    backgroundColor: "#EEEAE2",
  },

  ownerInfo: {
    flex: 1,
    minWidth: 0,
    marginLeft: 14,
    marginRight: 8,
  },

  ownerName: {
    fontFamily: fonts.extraBold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
  },

  ownerDetails: {
    marginTop: 3,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textSecondary,
  },

  waveButton: {
    minWidth: 76,
    minHeight: 43,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: colors.orange,
    borderRadius: 8,
    backgroundColor: colors.background,
  },

  waveButtonActive: {
    backgroundColor: colors.orange,
  },

  waveButtonText: {
    fontFamily: fonts.extraBold,
    fontSize: 12,
    color: colors.text,
  },

  meetCard: {
    width: "100%",
    marginTop: 26,
    padding: 15,
    borderWidth: 1.5,
    borderColor: colors.orange,
    borderRadius: 8,
    backgroundColor: colors.background,
  },

  meetTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
    color: colors.text,
    marginBottom: 13,
  },

  input: {
    width: "100%",
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.green,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.text,
    backgroundColor: colors.background,
  },

  inputHint: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 12,
  },

  suggestionLoading: {
    marginBottom: 10,
  },

  suggestionsBox: {
    borderWidth: 1,
    borderColor: colors.green,
    borderRadius: 6,
    marginBottom: 12,
    overflow: "hidden",
  },

  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },

  suggestionText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.text,
  },

  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  dateButtonText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.text,
  },

  placeholderText: {
    color: "#A7ADBA",
  },

  pickerOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  pickerPanel: {
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 30,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },

  pickerDone: {
    alignSelf: "flex-end",
    padding: 8,
  },

  pickerDoneText: {
    fontFamily: fonts.extraBold,
    fontSize: 14,
    color: colors.green,
  },

  messageInput: {
    minHeight: 100,
    textAlignVertical: "top",
  },

  sendButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    backgroundColor: colors.green,
    marginTop: 2,
  },

  sendButtonText: {
    fontFamily: fonts.extraBold,
    fontSize: 13,
    color: colors.white,
  },

  meetNote: {
    marginTop: 10,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textSecondary,
    textAlign: "center",
  },

  bottomNav: {
    minHeight: 86,
    flexDirection: "row",
    alignItems: "stretch",
    paddingHorizontal: 15,
    paddingTop: 8,
    paddingBottom: 5,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.background,
  },

  navItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minWidth: 0,
  },

  navItemSelected: {
    borderTopWidth: 2,
    borderTopColor: colors.green,
  },

  navImage: {
    width: 28,
    height: 28,
    tintColor: colors.text,
  },

  navProfileCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.text,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },

  navProfileImage: {
    width: "100%",
    height: "100%",
  },

  navText: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.text,
    textAlign: "center",
  },

  navTextSelected: {
    fontFamily: fonts.extraBold,
    color: colors.green,
  },
});
