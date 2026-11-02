import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase/firebase";
import { colors, fonts } from "../theme/theme";
import BottomNav from "../components/BottomNav";
import type { Experience } from "./ExperienceDetailsScreen";
import { experiences as presetExperiences } from "./UpcomingExperiencesScreen";

type Props = {
  onBack: () => void;
  onExplore: () => void;
  onAdventures: () => void;
  onPassport: () => void;
  onProfile: () => void;
  onExperiencePress: (experience: Experience) => void;
};

type Entry = { experience: Experience; kind: "accepted" | "registered"; date: Date | null };

function eventDate(value: any): Date | null {
  if (value?.toDate) return value.toDate();
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(`${value}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function fromFirestore(id: string, data: any): Experience {
  const start = eventDate(data.startsAt);
  const date = eventDate(data.eventDate) ?? start;
  const location = typeof data.location === "string" ? data.location : data.location?.formattedAddress ?? "";
  return {
    id,
    title: data.title ?? "Meet & Greet",
    category: data.category ?? data.experienceType ?? "Meet & Greet",
    date: date ? date.toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" }) : "To be confirmed",
    eventDate: data.eventDate ?? undefined,
    time: start ? start.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" }) : data.time ?? "To be confirmed",
    location,
    description: data.description ?? data.message ?? "",
    eventType: data.eventType,
    source: data.source,
    imageURL: data.imageURL ?? null,
    locationPlaceId: data.placeId ?? data.location?.placeId ?? null,
    latitude: data.latitude ?? data.location?.latitude ?? null,
    longitude: data.longitude ?? data.location?.longitude ?? null,
  };
}

export default function MyExperiencesScreen({ onBack, onExplore, onAdventures, onPassport, onProfile, onExperiencePress }: Props) {
  const [tab, setTab] = useState<"upcoming" | "history">("upcoming");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) { setLoading(false); setError("Please sign in to view your experiences."); return; }
    setLoading(true);
    setError("");
    try {
      const [registrations, community] = await Promise.all([
        getDocs(collection(db, "users", user.uid, "experienceRegistrations")),
        getDocs(collection(db, "experiences")),
      ]);
      const communityMap = new Map(community.docs.map((item) => [item.id, item.data()]));
      const found: Entry[] = [];
      for (const item of registrations.docs) {
        const data = item.data();
        const id = data.experienceId ?? item.id;
        const communityData = communityMap.get(id);
        const preset = presetExperiences.find((e) => e.id === id);
        const experience: Experience = communityData ? fromFirestore(id, communityData) : preset ?? {
          id,
          title: data.experienceTitle ?? "Experience",
          category: data.experienceCategory ?? "Experience",
          date: data.experienceDate ?? data.date ?? "To be confirmed",
          time: data.experienceTime ?? "To be confirmed",
          location: data.experienceLocation ?? "",
          description: "",
          eventDate: data.eventDate ?? undefined,
        };
        const date = eventDate(communityData?.startsAt) ?? eventDate(communityData?.eventDate) ?? eventDate(experience.eventDate) ?? eventDate(data.eventDate) ?? eventDate(experience.date);
        found.push({ experience, kind: "registered", date });
      }
      // Each member reads only their own RSVP document. Other members' RSVPs stay private.
      const meetEvents = community.docs.filter((item) => item.data().eventType === "meetAndGreet");
      const rsvps = await Promise.all(meetEvents.map(async (item) => {
        const snapshot = await getDoc(doc(db, "experiences", item.id, "rsvps", user.uid));
        return snapshot.exists() && snapshot.data().status === "accepted" ? item : null;
      }));
      for (const item of rsvps) {
        if (!item) continue;
        const data = item.data();
        const experience = fromFirestore(item.id, data);
        found.push({ experience, kind: "accepted", date: eventDate(data.startsAt) ?? eventDate(data.eventDate) });
      }
      const unique = new Map<string, Entry>();
      found.forEach((entry) => unique.set(entry.experience.id, entry));
      setEntries([...unique.values()].sort((a, b) => (a.date?.getTime() ?? Infinity) - (b.date?.getTime() ?? Infinity)));
    } catch (e) {
      console.error("Unable to load My Experiences:", e);
      setError("Couldn't load your experiences. Please try again.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const visible = entries.filter((item) => {
    if (!item.date) return tab === "upcoming";
    const day = new Date(item.date); day.setHours(0, 0, 0, 0);
    return tab === "upcoming" ? day >= today : day < today;
  });

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.side}><MaterialIcons name="arrow-back" size={25} color={colors.text} /></Pressable>
        <Text style={styles.heading}>My Experiences</Text>
        <Pressable onPress={() => void load()} hitSlop={12} style={[styles.side, { alignItems: "flex-end" }]}><MaterialIcons name="refresh" size={24} color={colors.text} /></Pressable>
      </View>
      <View style={styles.tabs}>
        {(["upcoming", "history"] as const).map((value) => (
          <Pressable key={value} onPress={() => setTab(value)} style={[styles.tab, tab === value && styles.selectedTab]}>
            <Text style={[styles.tabText, tab === value && styles.selectedTabText]}>{value === "upcoming" ? "UPCOMING" : "HISTORY"}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? <ActivityIndicator color={colors.green} style={{ marginTop: 32 }} /> : error ? <Text style={styles.muted}>{error}</Text> : visible.length === 0 ? (
          <View style={styles.empty}><MaterialIcons name="event-available" size={42} color={colors.green} /><Text style={styles.emptyTitle}>No {tab} experiences yet</Text><Text style={styles.muted}>Your registered experiences and accepted Meet & Greets will appear here.</Text></View>
        ) : visible.map(({ experience, kind }) => (
          <Pressable key={experience.id} style={styles.card} onPress={() => onExperiencePress(experience)}>
            <View style={styles.cardTop}><Text style={styles.cardTitle}>{experience.title}</Text><MaterialIcons name="chevron-right" size={24} color={colors.textSecondary} /></View>
            <Text style={styles.meta}><MaterialIcons name="event" size={14} />  {experience.date}{experience.time && experience.time !== "To be confirmed" ? ` · ${experience.time}` : ""}</Text>
            {!!experience.location && <Text style={styles.meta}><MaterialIcons name="place" size={14} />  {experience.location}</Text>}
            <Text style={styles.status}>{kind === "accepted" ? "MEET & GREET · GOING" : "EXPERIENCE · REGISTERED"}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <BottomNav selected="profile" onExplore={onExplore} onHibernate={onAdventures} onPassport={onPassport} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: { minHeight: 92, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  side: { width: 54, justifyContent: "center" },
  heading: { flex: 1, textAlign: "center", fontFamily: fonts.extraBold, fontSize: 16, color: colors.red },
  tabs: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 20 },
  tab: { flex: 1, paddingVertical: 14, alignItems: "center", borderWidth: 1.5, borderColor: colors.orange, borderRadius: 4 },
  selectedTab: { backgroundColor: colors.green, borderColor: colors.green },
  tabText: { fontFamily: fonts.extraBold, fontSize: 12, color: colors.text },
  selectedTabText: { color: colors.white },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  card: { padding: 17, borderWidth: 1.5, borderColor: colors.orange, borderRadius: 4, backgroundColor: colors.background, gap: 8 },
  cardTop: { flexDirection: "row", alignItems: "center" },
  cardTitle: { flex: 1, fontFamily: fonts.extraBold, fontSize: 16, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 19, color: colors.textSecondary },
  status: { fontFamily: fonts.extraBold, fontSize: 11, color: colors.green, marginTop: 5 },
  empty: { alignItems: "center", gap: 12, marginTop: 60, paddingHorizontal: 16 },
  emptyTitle: { fontFamily: fonts.extraBold, fontSize: 16, color: colors.text, textAlign: "center" },
  muted: { fontFamily: fonts.regular, fontSize: 13, color: colors.textSecondary, textAlign: "center" },
});
