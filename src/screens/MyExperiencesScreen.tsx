
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../firebase/firebase";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { colors, fonts, spacing } from "../theme/theme";
import type { Experience } from "./ExperienceDetailsScreen";

type Category =
  | "Created"
  | "Registered"
  | "Invited"
  | "Attended";

type Item = {
  experience: Experience;
  categories: Category[];
};

type Props = {
  onBack: () => void;
  onExperiencePress: (experience: Experience) => void;
};

const categories: Category[] = [
  "Created",
  "Registered",
  "Invited",
  "Attended",
];

function formatExperience(
  id: string,
  data: Record<string, any>
): Experience {
  const startsAt = data.startsAt?.toDate?.();

  const eventDate =
    data.eventDate ||
    (startsAt
      ? startsAt.toISOString().slice(0, 10)
      : "");

  return {
    id,
    title:
      data.title ||
      data.experienceType ||
      "Meet & Greet",
    category:
      data.experienceType ||
      data.category ||
      "Meet & Greet",
    date: eventDate || "Date to be confirmed",
    eventDate,
    time: startsAt
      ? startsAt.toLocaleTimeString("en-ZA", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : data.time || "",
    location:
      typeof data.location === "string"
        ? data.location
        : data.location?.formattedAddress ||
          "Location to be confirmed",
    description:
      data.description || data.message || "",
    eventType: data.eventType,
    source: data.source,
    imageURL:
      data.coverImageURL ||
      data.coverImageUrl ||
      data.imageURL ||
      null,
    locationPlaceId:
      data.placeId ||
      data.locationPlaceId ||
      null,
  };
}

export default function MyExperiencesScreen({
  onBack,
  onExperiencePress,
}: Props) {
  const [active, setActive] =
    useState<Category>("Created");

  const [items, setItems] =
    useState<Item[]>([]);

  const [loading, setLoading] =
    useState(false);

  const load = useCallback(async () => {
    const uid = auth.currentUser?.uid;

    if (!uid) return;

    setLoading(true);

    try {
      const [
        allExperiences,
        registrations,
        notifications,
      ] = await Promise.all([
        getDocs(collection(db, "experiences")),
        getDocs(
          collection(
            db,
            "users",
            uid,
            "experienceRegistrations"
          )
        ),
        getDocs(
          collection(
            db,
            "users",
            uid,
            "notifications"
          )
        ),
      ]);

      const map = new Map<string, Item>();

      const ensure = (
        id: string,
        data: Record<string, any>
      ) => {
        if (!map.has(id)) {
          map.set(id, {
            experience: formatExperience(id, data),
            categories: [],
          });
        }

        return map.get(id)!;
      };

      const add = (
        id: string,
        data: Record<string, any>,
        category: Category
      ) => {
        const item = ensure(id, data);

        if (!item.categories.includes(category)) {
          item.categories.push(category);
        }
      };

      const raw = new Map<
        string,
        Record<string, any>
      >();

      allExperiences.forEach((snap) =>
        raw.set(snap.id, snap.data())
      );

      const ids = Array.from(raw.keys());

      const rsvps = await Promise.all(
        ids.map((id) =>
          getDocs(
            query(
              collection(
                db,
                "experiences",
                id,
                "rsvps"
              ),
              where("userId", "==", uid)
            )
          )
            .then((snapshot) => ({
              id,
              snapshot,
            }))
            .catch(() => null)
        )
      );

      raw.forEach((data, id) => {
        if (data.createdBy === uid) {
          add(id, data, "Created");
        }
      });

      registrations.forEach((snap) => {
        const data = snap.data();

        const id =
          data.experienceId || snap.id;

        const experience = raw.get(id);

        if (!experience) return;

        if (
          data.attended === true ||
          data.attendanceStatus === "confirmed"
        ) {
          add(id, experience, "Attended");
        } else if (
          data.status !== "cancelled" &&
          data.status !== "declined"
        ) {
          add(id, experience, "Registered");
        }
      });

      rsvps.forEach((result) => {
        if (!result) return;

        const experience = raw.get(result.id);

        if (!experience) return;

        result.snapshot.forEach((snap) => {
          const status = snap.data().status;

          if (status === "accepted") {
            add(
              result.id,
              experience,
              "Registered"
            );
          }
        });
      });

      notifications.forEach((snap) => {
        const data = snap.data();

        if (
          data.type !== "invite" ||
          typeof data.experienceId !== "string"
        ) {
          return;
        }

        const experience = raw.get(
          data.experienceId
        );

        if (!experience) return;

        const item = map.get(
          data.experienceId
        );

        if (
          data.rsvpStatus === "accepted" ||
          item?.categories.includes(
            "Registered"
          )
        ) {
          return;
        }

        if (data.rsvpStatus === "declined") {
          return;
        }

        add(
          data.experienceId,
          experience,
          "Invited"
        );
      });

      setItems(
        Array.from(map.values()).sort(
          (a, b) =>
            (
              b.experience.eventDate || ""
            ).localeCompare(
              a.experience.eventDate || ""
            )
        )
      );
    } catch (error) {
      console.error(
        "Unable to load My Experiences:",
        error
      );

      Alert.alert(
        "Unable to load experiences",
        "Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = items.filter((item) =>
    item.categories.includes(active)
  );

  return (
    <SafeAreaView style={styles.root}>
      {/* HEADER */}
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          style={styles.backButton}
        >
          <MaterialIcons
            name="arrow-back-ios"
            size={18}
            color={colors.text}
          />

          <Text style={styles.backText}>
            Back
          </Text>
        </Pressable>

        <Text style={styles.headerTitle}>
          MY EXPERIENCES
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      {/* CONTENT */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={
          styles.listContent
        }
        showsVerticalScrollIndicator={false}
      >
        {/* PAGE INTRO */}
        <View style={styles.intro}>
          <Text style={styles.pageSubtitle}>
            Your adventures, your Jimny crew.
          </Text>
        </View>

        {/* FILTER BUTTONS */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabs}
          contentContainerStyle={
            styles.filterContainer
          }
        >
          {categories.map((category) => {
            const selected =
              active === category;

            return (
              <Pressable
                key={category}
                onPress={() =>
                  setActive(category)
                }
                style={({ pressed }) => [
                  styles.filterButton,
                  selected &&
                    styles.filterButtonSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    selected &&
                      styles.filterTextSelected,
                  ]}
                >
                  {category}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* EXPERIENCES */}
        {loading ? (
          <ActivityIndicator
            color={colors.green}
            size="large"
          />
        ) : visible.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              Nothing here yet 🚙
            </Text>

            <Text style={styles.emptyText}>
              Your {active.toLowerCase()} experiences
              will appear here.
            </Text>
          </View>
        ) : (
          visible.map((item) => (
            <Pressable
              key={item.experience.id}
              style={styles.card}
              onPress={() =>
                onExperiencePress(
                  item.experience
                )
              }
            >
              {item.experience.imageURL ? (
                <Image
                  source={{
                    uri: item.experience.imageURL,
                  }}
                  style={styles.banner}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.placeholder}>
                  <MaterialIcons
                    name="landscape"
                    size={32}
                    color={
                      colors.textSecondary
                    }
                  />

                  <Text
                    style={
                      styles.placeholderText
                    }
                  >
                    JIMNY SIDE QUESTS
                  </Text>
                </View>
              )}

              <View style={styles.cardContent}>
                <View
                  style={styles.cardTitleRow}
                >
                  <Text style={styles.cardTitle}>
                    {item.experience.title}
                  </Text>

                  <View
                    style={styles.categoryTag}
                  >
                    <Text
                      style={
                        styles.categoryTagText
                      }
                    >
                      {item.experience.category}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailsRow}>
                  <Text style={styles.dateText}>
                    {item.experience.date}
                  </Text>

                  {!!item.experience.time && (
                    <Text
                      style={styles.timeText}
                    >
                      {item.experience.time}
                    </Text>
                  )}
                </View>

                <View style={styles.locationRow}>
                  <MaterialIcons
                    name="place"
                    size={16}
                    color={colors.green}
                  />

                  <Text
                    style={styles.locationText}
                  >
                    {item.experience.location}
                  </Text>
                </View>

                <View style={styles.badges}>
                  {item.categories.map(
                    (category) => (
                      <View
                        key={category}
                        style={styles.badge}
                      >
                        <Text
                          style={
                            styles.badgeText
                          }
                        >
                          {category.toUpperCase()}
                        </Text>
                      </View>
                    )
                  )}
                </View>

                <Text style={styles.view}>
                  VIEW EXPERIENCE →
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // HEADER
  header: {
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.screen,
    borderBottomWidth:
      StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },

  backButton: {
    width: 105,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
  },

  backText: {
    marginLeft: 6,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
  },

  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontFamily: fonts.extraBold,
    fontSize: 16,
    lineHeight: 23,
    color: colors.red,
  },

  headerSpacer: {
    width: 105,
  },

  // CONTENT
  list: {
    flex: 1,
  },

  listContent: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 23,
    paddingBottom: 45,
  },

  intro: {
    marginBottom: 8,
  },

  pageSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },

  // FILTERS - MATCHES HOME SCREEN
  tabs: {
    flexGrow: 0,
    marginBottom: 9,
  },

  filterContainer: {
    paddingTop: 12,
    paddingBottom: 14,
    gap: 9,
  },

  filterButton: {
    minHeight: 38,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.orange,
    borderRadius: 22,
    backgroundColor: colors.background,
  },

  filterButtonSelected: {
    borderColor: colors.orange,
    backgroundColor: colors.orange,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 3,
  },

  filterText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.text,
  },

  filterTextSelected: {
    fontFamily: fonts.extraBold,
    color: colors.white,
  },

  pressed: {
    opacity: 0.8,
  },

  // EMPTY STATE
  empty: {
    alignItems: "center",
    paddingTop: 65,
  },

  emptyTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 18,
    color: colors.text,
  },

  emptyText: {
    marginTop: 10,
    fontFamily: fonts.regular,
    fontSize: 13,
    textAlign: "center",
    color: colors.textSecondary,
  },

  // EXPERIENCE CARDS
  card: {
    width: "100%",
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: colors.orange,
    borderRadius: 4,
    backgroundColor: colors.background,
    marginBottom: 25,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 3,
  },

  banner: {
    width: "100%",
    aspectRatio: 2.25,
  },

  placeholder: {
    width: "100%",
    aspectRatio: 2.25,
    backgroundColor: "#D9D9D9",
    alignItems: "center",
    justifyContent: "center",
  },

  placeholderText: {
    marginTop: 5,
    fontFamily: fonts.semiBold,
    fontSize: 9,
    color: colors.textSecondary,
  },

  cardContent: {
    paddingHorizontal: 18,
    paddingVertical: 18,
  },

  cardTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  cardTitle: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
    fontFamily: fonts.extraBold,
    fontSize: 18,
    lineHeight: 22,
    color: colors.text,
  },

  categoryTag: {
    flexShrink: 0,
    maxWidth: 130,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 2,
    backgroundColor: colors.green,
  },

  categoryTagText: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
    color: colors.white,
  },

  detailsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },

  dateText: {
    marginRight: 18,
    fontFamily: fonts.extraBold,
    fontSize: 13,
    color: colors.text,
  },

  timeText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.text,
  },

  locationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 8,
    gap: 4,
  },

  locationText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },

  // STATUS BADGES
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 14,
  },

  badge: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: colors.green,
  },

  badgeText: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
    color: colors.green,
  },

  view: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.green,
    marginTop: 16,
  },
});
