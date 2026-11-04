import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

import { auth, db } from "../firebase/firebase";
import { allQuests } from "../data/quests";
import { getStampImage } from "../data/stampImages";
import type { Quest } from "./HomeScreen";
import {
  colors,
  fonts,
  spacing,
} from "../theme/theme";

type MyAdventuresScreenProps = {
  onExplore: () => void;
  onBack: () => void;
  onPassport: () => void;
  onProfile: () => void;
  onHibernate?: () => void;
  onUpcomingExperiences: () => void;
  onQuestPress?: (quest: Quest) => void;
};

type QuestRecord = {
  questId?: string;
  status?: string;
  completedAt?: Timestamp | null;
};

type PassportData = {
  stamps?: unknown[];
  stampCount?: number;
};

type JimnyFriend = {
  id: string;
  name: string;
  profilePhotoURL: string | null;
};

type CompletedQuest = {
  quest: Quest;
  completedAt: Timestamp | null;
};

export default function MyAdventuresScreen({
  onExplore,
  onBack,
  onPassport,
  onProfile,
  onHibernate,
  onUpcomingExperiences,
  onQuestPress,
}: MyAdventuresScreenProps) {
  const [
    completedQuests,
    setCompletedQuests,
  ] = useState<CompletedQuest[]>([]);

  const [profilePhotoURL, setProfilePhotoURL] = useState<string | null>(null);
  const [friends, setFriends] = useState<JimnyFriend[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [friendsError, setFriendsError] = useState("");

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
    return () => { active = false; unsubscribe(); };
  }, []);

  const [stampCount, setStampCount] =
    useState(0);

  const [isLoading, setIsLoading] =
    useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  /*
   * LOAD ADVENTURE DATA
   */
  useEffect(() => {
    const loadAdventures = async () => {
      const user = auth.currentUser;

      if (!user) {
        setErrorMessage(
          "Please log in to view your adventures."
        );

        setIsLoading(false);

        return;
      }

      try {
        const [
          questSnapshot,
          passportSnapshot,
        ] = await Promise.all([
          getDocs(
            collection(
              db,
              "users",
              user.uid,
              "quests"
            )
          ),

          getDoc(
            doc(
              db,
              "passports",
              user.uid
            )
          ),
        ]);

        /*
         * COMPLETED QUESTS
         */
        const completedRecords =
          new Map<string, QuestRecord>();

        questSnapshot.forEach(
          (questDocument) => {
            const data =
              questDocument.data() as QuestRecord;

            if (
              data.status ===
              "completed"
            ) {
              completedRecords.set(
                data.questId ||
                  questDocument.id,
                data
              );
            }
          }
        );

        const completed =
          allQuests
            .filter((quest) =>
              completedRecords.has(
                quest.id
              )
            )
            .map((quest) => {
              const record =
                completedRecords.get(
                  quest.id
                );

              return {
                quest,
                completedAt:
                  record?.completedAt instanceof
                  Timestamp
                    ? record.completedAt
                    : null,
              };
            });

        setCompletedQuests(
          completed
        );

        /*
         * PASSPORT STAMPS
         */
        if (
          passportSnapshot.exists()
        ) {
          const passportData =
            passportSnapshot.data() as PassportData;

          const count =
            passportData.stampCount ??
            passportData.stamps
              ?.length ??
            0;

          setStampCount(count);
        } else {
          setStampCount(0);
        }
      } catch (error) {
        console.error(
          "Unable to load adventures:",
          error
        );

        setErrorMessage(
          "We couldn't load your adventures."
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadAdventures();
  }, []);

  // Mutual waves are friendships, regardless of nearby discovery visibility.
  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (active) {
          setFriends([]);
          setFriendsLoading(false);
        }
        return;
      }
      if (active) {
        setFriendsLoading(true);
        setFriendsError("");
      }
      try {
        const [sent, received] = await Promise.all([
          getDocs(query(collection(db, "waves"), where("senderId", "==", user.uid))),
          getDocs(query(collection(db, "waves"), where("recipientId", "==", user.uid))),
        ]);
        const friendIds = new Set<string>();
        for (const waveDoc of [...sent.docs, ...received.docs]) {
          const wave = waveDoc.data();
          if (wave.status !== "friends") continue;
          const otherId = wave.senderId === user.uid ? wave.recipientId : wave.senderId;
          if (typeof otherId === "string" && otherId !== user.uid) friendIds.add(otherId);
        }
        const loadedFriends = await Promise.all([...friendIds].map(async (id) => {
          const userSnap = await getDoc(doc(db, "users", id));
          const profile = userSnap.data();
          return {
            id,
            name: typeof profile?.fullName === "string" && profile.fullName.trim()
              ? profile.fullName : "Jimny Owner",
            profilePhotoURL: typeof profile?.profilePhotoURL === "string"
              ? profile.profilePhotoURL : null,
          } satisfies JimnyFriend;
        }));
        if (active) setFriends(loadedFriends.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (error) {
        console.error("Unable to load Jimny friends:", error);
        if (active) setFriendsError("Couldn't load your friends. Please try again later.");
      } finally {
        if (active) setFriendsLoading(false);
      }
    });
    return () => { active = false; unsubscribe(); };
  }, []);

  /*
   * CALCULATIONS
   */
  const totalQuestCount =
    allQuests.length;

  const completedQuestCount =
    completedQuests.length;

  const questsToGo =
    Math.max(
      totalQuestCount -
        completedQuestCount,
      0
    );

  const completionPercentage =
    totalQuestCount > 0
      ? Math.round(
          (completedQuestCount /
            totalQuestCount) *
            100
        )
      : 0;

  /*
   * LOADING
   */
  if (isLoading) {
    return (
      <SafeAreaView
        style={styles.safeArea}
        edges={[
          "top",
          "bottom",
        ]}
      >
        <View
          style={
            styles.loadingContainer
          }
        >
          <ActivityIndicator
            color={colors.green}
          />

          <Text
            style={styles.loadingText}
          >
            Loading your adventures...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /*
   * ERROR
   */
  if (errorMessage) {
    return (
      <SafeAreaView
        style={styles.safeArea}
        edges={[
          "top",
          "bottom",
        ]}
      >
        <View
          style={
            styles.errorContainer
          }
        >
          <MaterialIcons
            name="explore"
            size={48}
            color={colors.green}
          />

          <Text
            style={styles.errorTitle}
          >
            Adventures unavailable
          </Text>

          <Text
            style={styles.errorBody}
          >
            {errorMessage}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={[
        "top",
        "bottom",
      ]}
    >
      <View style={styles.screen}>
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={onBack}
            hitSlop={10}
          >
            <MaterialIcons
              name="arrow-back"
              size={22}
              color={colors.text}
            />

            <Text
              style={styles.backText}
            >
              Back
            </Text>
          </Pressable>

          <Text
            style={styles.headerTitle}
          >
            My Adventures
          </Text>

          <Pressable
            style={styles.headerMenu}
            hitSlop={10}
          >
            <MaterialIcons
              name="more-horiz"
              size={26}
              color={colors.text}
            />
          </Pressable>
        </View>

        {/* CONTENT */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={
            styles.scrollContent
          }
          showsVerticalScrollIndicator={
            false
          }
          bounces={false}
        >
          <View style={styles.content}>
            {/* TOP STATS */}
            <View
              style={styles.statsRow}
            >
              <StatCard
                value={String(
                  stampCount
                )}
                label="STAMPS"
              />

              <StatCard
                value={`${completedQuestCount} / ${totalQuestCount}`}
                label="QUESTS"
              />

              <StatCard
                value={String(
                  questsToGo
                )}
                label="TO GO"
              />
            </View>

            {/* OVERALL COMPLETION */}
            <View
              style={
                styles.completionCard
              }
            >
              <View
                style={
                  styles.completionTitleRow
                }
              >
                <Text
                  style={
                    styles.completionTitle
                  }
                >
                  Overall Completion
                </Text>

                <Text
                  style={
                    styles.completionPercentage
                  }
                >
                  {
                    completionPercentage
                  }
                  %
                </Text>
              </View>

              <View
                style={
                  styles.progressTrack
                }
              >
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${completionPercentage}%`,
                    },
                  ]}
                />
              </View>

              <Text
                style={
                  styles.completionBody
                }
              >
                Complete more side quests to
                earn physical stamps.
              </Text>
            </View>

            {/* COMPLETED SIDE QUESTS */}
            <View style={styles.section}>
              <Text
                style={
                  styles.sectionTitle
                }
              >
                COMPLETED SIDE QUESTS
              </Text>

              {completedQuests.length >
              0 ? (
                <View
                  style={
                    styles.questList
                  }
                >
                  {completedQuests.map(
                    ({
                      quest,
                      completedAt,
                    }) => (
                      <CompletedQuestCard
                        key={
                          quest.id
                        }
                        quest={quest}
                        completedAt={
                          completedAt
                        }
                        onPress={() =>
                          onQuestPress?.(
                            quest
                          )
                        }
                      />
                    )
                  )}
                </View>
              ) : (
                <View
                  style={
                    styles.emptyCard
                  }
                >
                  <MaterialIcons
                    name="flag"
                    size={28}
                    color={
                      colors.green
                    }
                  />

                  <Text
                    style={
                      styles.emptyTitle
                    }
                  >
                    Your first stamp is waiting
                  </Text>

                  <Text
                    style={
                      styles.emptyBody
                    }
                  >
                    Complete a Side Quest and it
                    will appear here.
                  </Text>
                </View>
              )}
            </View>

            {/* MY FRIENDS */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>MY FRIENDS</Text>
              {friendsLoading ? (
                <ActivityIndicator color={colors.green} />
              ) : friendsError ? (
                <Text style={styles.emptyBody}>{friendsError}</Text>
              ) : friends.length > 0 ? (
                <View style={styles.questList}>
                  {friends.map((friend) => (
                    <View key={friend.id} style={styles.friendCard}>
                      <View style={styles.friendAvatar}>
                        {friend.profilePhotoURL ? (
                          <Image source={{ uri: friend.profilePhotoURL }} style={styles.friendPhoto} />
                        ) : (
                          <MaterialIcons name="person" size={28} color={colors.textSecondary} />
                        )}
                      </View>
                      <View style={styles.friendInfo}>
                        <Text style={styles.friendName} numberOfLines={1}>{friend.name}</Text>
                        <Text style={styles.friendSubtitle}>Jimny friend</Text>
                      </View>
                      <MaterialIcons name="people" size={21} color={colors.green} marginRight={8} />
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <MaterialIcons name="people-outline" size={28} color={colors.green} />
                  <Text style={styles.emptyTitle}>Your Jimny crew starts here!</Text>
                  <Text style={styles.emptyBody}>
                    Wave at another Jimny owner. When they wave back, they'll appear here.
                  </Text>
                </View>
              )}
            </View>

            {/* UPCOMING EXPERIENCES */}
            <Pressable
              style={({ pressed }) => [
                styles.upcomingButton,
                pressed &&
                  styles.pressed,
              ]}
              onPress={
                onUpcomingExperiences
              }
            >
              <View
                style={
                  styles.upcomingButtonContent
                }
              >
                <MaterialIcons
                  name="event"
                  size={22}
                  color={
                    colors.green
                  }
                />

                <Text
                  style={
                    styles.upcomingButtonText
                  }
                >
                  VIEW UPCOMING EXPERIENCES
                </Text>
              </View>

              <MaterialIcons
                name="arrow-forward"
                size={22}
                color={colors.green}
              />
            </Pressable>
          </View>

          {/* FOOTER PATTERN */}
          <Image
            source={require("../../assets/images/footer-pattern.png")}
            style={
              styles.footerPattern
            }
            resizeMode="stretch"
          />

          {/* NEXT QUEST CTA */}
          <View
            style={styles.ctaSection}
          >
            <Pressable
              style={({ pressed }) => [
                styles.nextQuestButton,
                pressed &&
                  styles.pressed,
              ]}
              onPress={onExplore}
            >
              <Text
                style={
                  styles.nextQuestButtonText
                }
              >
                FIND MY NEXT SIDE QUEST
              </Text>
            </Pressable>
          </View>
        </ScrollView>

        {/* BOTTOM NAVIGATION */}
        <View style={styles.bottomNav}>
          <Pressable style={styles.navItem} onPress={onExplore}>
            <Image source={require("../../assets/nav-icons/explore.png")} style={styles.navImage} resizeMode="contain" />
            <Text style={styles.navText}>Explore</Text>
          </Pressable>
          <Pressable style={styles.navItem} onPress={onHibernate}>
            <Image source={require("../../assets/nav-icons/hibernate.png")} style={styles.navImageHibernate} resizeMode="contain" />
            <Text style={styles.navText}>Hibernate</Text>
          </Pressable>
          <Pressable style={styles.navItem} onPress={onPassport}>
            <Image source={require("../../assets/nav-icons/passport.png")} style={styles.navImagePassport} resizeMode="contain" />
            <Text style={styles.navText}>Passport</Text>
          </Pressable>
          <Pressable style={[styles.navItem, styles.navItemSelected]} onPress={onProfile}>
            <View style={[styles.navProfileCircle, styles.navProfileSelected]}>
              {profilePhotoURL ? (
                <Image source={{ uri: profilePhotoURL }} style={styles.navProfileImage} resizeMode="cover" />
              ) : (
                <MaterialIcons name="person" size={22} color={colors.green} />
              )}
            </View>
            <Text style={[styles.navText, styles.navTextSelected]}>My Profile</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

/*
 * STAT CARD
 */
function StatCard({
  value,
  label,
}: {
  value: string;
  label: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text
        style={styles.statValue}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value}
      </Text>

      <Text
        style={styles.statLabel}
      >
        {label}
      </Text>
    </View>
  );
}

/*
 * COMPLETED QUEST
 */
function CompletedQuestCard({
  quest,
  completedAt,
  onPress,
}: {
  quest: Quest;
  completedAt:
    | Timestamp
    | null;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.completedQuestCard,
        pressed &&
          styles.pressed,
      ]}
      onPress={onPress}
    >
      <View
        style={[
          styles.completedStamp,
          (getStampImage(quest.stampTitle || quest.title) ?? getStampImage(quest.title)) && styles.completedStampWithArtwork,
        ]}
      >
        {getStampImage(quest.stampTitle || quest.title) ?? getStampImage(quest.title) ? (
          <Image
            source={(getStampImage(quest.stampTitle || quest.title) ?? getStampImage(quest.title))!}
            style={styles.completedStampArtwork}
            resizeMode="contain"
          />
        ) : (
          <MaterialIcons name="workspace-premium" size={31} color={colors.text} />
        )}
      </View>

      <View
        style={
          styles.completedQuestContent
        }
      >
        <Text
          style={
            styles.completedQuestTitle
          }
          numberOfLines={1}
        >
          {quest.title}
        </Text>

        <Text
          style={
            styles.completedQuestDate
          }
          numberOfLines={1}
        >
          Completed on{" "}
          {formatCompletedDate(
            completedAt
          )}
        </Text>
      </View>

      <View
        style={styles.categoryTag}
      >
        <Text
          style={
            styles.categoryTagText
          }
          numberOfLines={1}
        >
          {quest.category}
        </Text>
      </View>
    </Pressable>
  );
}

/*
 * COMPLETED DATE
 */
function formatCompletedDate(
  timestamp:
    | Timestamp
    | null
) {
  if (!timestamp) {
    return "";
  }

  try {
    return timestamp
      .toDate()
      .toLocaleDateString(
        "en-ZA",
        {
          day: "numeric",
          month: "short",
          year: "numeric",
        }
      );
  } catch {
    return "";
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor:
      colors.background,
  },

  screen: {
    flex: 1,
    backgroundColor:
      colors.background,
  },

  /*
   * HEADER
   */
  header: {
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal:
      spacing.screen,
    borderBottomWidth:
      StyleSheet.hairlineWidth,
    borderBottomColor:
      colors.divider,
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
    fontFamily:
      fonts.extraBold,
    fontSize: 16,
    lineHeight: 23,
    color: colors.red,
  },

  headerMenu: {
    width: 105,
    height: 44,
    alignItems: "flex-end",
    justifyContent: "center",
  },

  /*
   * SCROLL
   */
  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: 0,
  },

  content: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal:
      spacing.screen,
    paddingTop: 20,
  },

  /*
   * LOADING / ERROR
   */
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  loadingText: {
    fontFamily:
      fonts.regular,
    fontSize: 12,
    color:
      colors.textSecondary,
  },

  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },

  errorTitle: {
    marginTop: 12,
    fontFamily:
      fonts.extraBold,
    fontSize: 19,
    color: colors.text,
  },

  errorBody: {
    marginTop: 7,
    textAlign: "center",
    fontFamily:
      fonts.regular,
    fontSize: 13,
    color:
      colors.textSecondary,
  },

  /*
   * STATS
   */
  statsRow: {
    width: "100%",
    flexDirection: "row",
    gap: 14,
  },

  statCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 80,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    borderRadius: 4,
    backgroundColor:
      colors.green,
  },

  statValue: {
    width: "100%",
    textAlign: "center",
    fontFamily:
      fonts.extraBold,
    fontSize: 25,
    color: colors.white,
  },

  statLabel: {
    marginTop: 4,
    textAlign: "center",
    fontFamily:
      fonts.semiBold,
    fontSize: 10,
    color: colors.white,
  },

  /*
   * COMPLETION
   */
  completionCard: {
    width: "100%",
    marginTop: 34,
    marginBottom: 25,
    paddingHorizontal: 17,
    paddingTop: 17,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: "#9AA6B5",
    borderRadius: 4,
    backgroundColor:
      colors.background,
  },

  completionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    marginBottom: 10,
  },

  completionTitle: {
    fontFamily:
      fonts.extraBold,
    fontSize: 16,
    color: colors.text,
  },

  completionPercentage: {
    fontFamily:
      fonts.extraBold,
    fontSize: 16,
    color: colors.text,
  },

  progressTrack: {
    width: "100%",
    height: 11,
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor:
      "#D9D7CE",
  },

  progressFill: {
    height: "100%",
    borderRadius: 8,
    backgroundColor:
      colors.orange,
  },

  completionBody: {
    marginTop: 11,
    fontFamily:
      fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color:
      colors.textSecondary,
  },

  /*
   * SECTIONS
   */
  section: {
    width: "100%",
    marginBottom: 24,
  },

  sectionTitle: {
    marginBottom: 12,
    fontFamily:
      fonts.extraBold,
    fontSize: 12,
    lineHeight: 17,
    color: colors.red,
  },

  questList: {
    width: "100%",
    gap: 12,
  },

  /*
   * COMPLETED QUEST
   */
  completedQuestCard: {
    width: "100%",
    minHeight: 75,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1.2,
    borderColor:
      colors.green,
    borderRadius: 4,
    backgroundColor:
      colors.background,
  },

  completedStamp: {
    width: 48,
    height: 48,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.2,
    borderColor: colors.text,
    borderRadius: 24,
    backgroundColor:
      "#F4F5F7",
  },

  completedStampWithArtwork: {
    borderWidth: 0,
    backgroundColor: "transparent",
  },

  completedStampArtwork: {
    width: "100%",
    height: "100%",
  },

  completedQuestContent: {
    flex: 1,
    minWidth: 0,
    marginLeft: 13,
    marginRight: 8,
  },

  completedQuestTitle: {
    fontFamily:
      fonts.extraBold,
    fontSize: 13,
    lineHeight: 18,
    color: colors.text,
  },

  completedQuestDate: {
    marginTop: 3,
    fontFamily:
      fonts.regular,
    fontSize: 11,
    lineHeight: 15,
    color:
      colors.textSecondary,
  },

  /*
   * CATEGORY
   */
  categoryTag: {
    flexShrink: 0,
    maxWidth: 100,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 2,
    backgroundColor:
      colors.green,
  },

  categoryTagText: {
    fontFamily:
      fonts.regular,
    fontSize: 10,
    color: colors.white,
  },

  /* MY FRIENDS */
  friendCard: {
    width: "100%", minHeight: 70, flexDirection: "row", alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1.2,
    borderColor: colors.green, borderRadius: 4, backgroundColor: colors.background,
  },
  friendAvatar: {
    width: 46, height: 46, borderRadius: 23, borderWidth: 1.5,
    borderColor: colors.green, alignItems: "center", justifyContent: "center",
    overflow: "hidden", backgroundColor: "#F4F5F7",
  },
  friendPhoto: { width: "100%", height: "100%" },
  friendInfo: { flex: 1, minWidth: 0, marginLeft: 12 },
  friendName: { fontFamily: fonts.extraBold, fontSize: 13, color: colors.text },
  friendSubtitle: { marginTop: 3, fontFamily: fonts.regular, fontSize: 11, color: colors.textSecondary },

  /*
   * EMPTY STATES
   */
  emptyCard: {
    width: "100%",
    minHeight: 110,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    borderWidth: 1,
    borderColor:
      colors.divider,
    borderRadius: 4,
  },

  emptyTitle: {
    marginTop: 8,
    fontFamily:
      fonts.extraBold,
    fontSize: 14,
    color: colors.text,
  },

  emptyBody: {
    marginTop: 4,
    textAlign: "center",
    fontFamily:
      fonts.regular,
    fontSize: 11,
    color:
      colors.textSecondary,
  },

  allCompleteCard: {
    width: "100%",
    minHeight: 110,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    borderWidth: 1.5,
    borderColor:
      colors.green,
    borderRadius: 4,
  },

  allCompleteTitle: {
    marginTop: 8,
    fontFamily:
      fonts.extraBold,
    fontSize: 14,
    color: colors.text,
  },

  allCompleteBody: {
    marginTop: 4,
    textAlign: "center",
    fontFamily:
      fonts.regular,
    fontSize: 11,
    color:
      colors.textSecondary,
  },

  /*
   * UPCOMING EXPERIENCES
   */
  upcomingButton: {
    width: "100%",
    minHeight: 54,
    marginBottom: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor:
      colors.green,
    borderRadius: 4,
    backgroundColor:
      colors.background,
  },

  upcomingButtonContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  upcomingButtonText: {
    flex: 1,
    marginLeft: 10,
    fontFamily:
      fonts.extraBold,
    fontSize: 12,
    color: colors.green,
  },

  /*
   * FOOTER PATTERN
   */
  footerPattern: {
    width: "100%",
    height: 27,
  },

  /*
   * CTA
   */
  ctaSection: {
    width: "100%",
    paddingHorizontal:
      spacing.screen,
    paddingTop: 14,
    paddingBottom: 18,
    backgroundColor:
      colors.background,
  },

  nextQuestButton: {
    width: "100%",
    maxWidth: 472,
    minHeight: 54,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    backgroundColor:
      colors.green,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 3,
  },

  nextQuestButtonText: {
    fontFamily:
      fonts.extraBold,
    fontSize: 14,
    color: colors.white,
  },

  /*
   * BOTTOM NAV
   */
  bottomNav: {
    minHeight: 86,
    flexDirection: "row",
    alignItems: "stretch",
    borderTopWidth:
      StyleSheet.hairlineWidth,
    borderTopColor:
      colors.divider,
    backgroundColor:
      colors.background,
    paddingHorizontal: 15,
    paddingTop: 8,
    paddingBottom: 5,
  },

  navItem: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderRadius: 3,
  },

  navImage: { width: 27, height: 27, tintColor: colors.text },
  navImageHibernate: { width: 30, height: 27, tintColor: colors.text },
  navImagePassport: { width: 26, height: 27, tintColor: colors.text },
  navProfileCircle: {
    width: 29, height: 29, borderRadius: 15,
    borderWidth: 1.5, borderColor: colors.text,
    alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  navProfileSelected: { borderColor: colors.green, borderWidth: 2 },
  navProfileImage: { width: "100%", height: "100%" },
  navItemSelected: {
    borderTopWidth: 2,
    borderTopColor: colors.green,
  },

  navText: {
    fontFamily:
      fonts.medium,
    fontSize: 10,
    color: colors.text,
    textAlign: "center",
  },

  navTextSelected: {
    fontFamily:
      fonts.extraBold,
    color: colors.green,
  },

  pressed: {
    opacity: 0.82,
  },
});