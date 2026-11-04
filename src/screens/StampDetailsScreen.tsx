import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import BottomNav from "../components/BottomNav";
import { getStampImage } from "../data/stampImages";
import { allQuests } from "../data/quests";
import {
  doc,
  getDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";

import type { SavedPassportStamp } from "./QuestCompletionScreen";

import {
  auth,
  db,
} from "../firebase/firebase";

import {
  colors,
  fonts,
} from "../theme/theme";

type StampDetailsScreenProps = {
  stamp: SavedPassportStamp;
  allowMemoryEditing?: boolean;

  /*
   * IMPORTANT:
   * Back always returns to My Passport.
   */
  onBack: () => void;

  onExplore: () => void;
  onAdventures: () => void;
  onPassport: () => void;
  onProfile?: () => void;

  /*
   * Lets App.tsx keep the selected
   * stamp in sync after saving a memory.
   */
  onStampUpdated?: (
    stamp: SavedPassportStamp
  ) => void;
};

/*
 * COMPLETION DATE
 */
function formatCompletedDate(
  timestamp: Timestamp | null
) {
  if (!timestamp) {
    return "—";
  }

  try {
    return timestamp
      .toDate()
      .toLocaleDateString(
        "en-ZA",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }
      )
      .toUpperCase();
  } catch {
    return "—";
  }
}

/*
 * DRIVE START TIME
 */
function formatStartTime(
  timestamp: Timestamp | null
) {
  if (!timestamp) {
    return "—";
  }

  try {
    return timestamp
      .toDate()
      .toLocaleTimeString(
        [],
        {
          hour: "2-digit",
          minute: "2-digit",
        }
      );
  } catch {
    return "—";
  }
}

/*
 * DRIVE DURATION
 *
 * Uses the time between START DRIVE
 * and END DRIVE.
 */
function formatDriveDuration(
  startedAt: Timestamp | null,
  stoppedAt: Timestamp | null
) {
  if (
    !startedAt ||
    !stoppedAt
  ) {
    return "—";
  }

  try {
    const milliseconds =
      stoppedAt
        .toDate()
        .getTime() -
      startedAt
        .toDate()
        .getTime();

    const totalSeconds =
      Math.max(
        0,
        Math.floor(
          milliseconds / 1000
        )
      );

    const hours =
      Math.floor(
        totalSeconds / 3600
      );

    const minutes =
      Math.floor(
        (totalSeconds % 3600) /
          60
      );

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    if (minutes > 0) {
      return `${minutes}m`;
    }

    return "< 1m";
  } catch {
    return "—";
  }
}

export default function StampDetailsScreen({
  stamp,
  allowMemoryEditing = false,
  onBack,
  onExplore,
  onAdventures,
  onPassport,
  onProfile,
  onStampUpdated,
}: StampDetailsScreenProps) {
  const [
    adventureMemory,
    setAdventureMemory,
  ] = useState(
    stamp.adventureMemory ?? ""
  );

  const [
    savedAdventureMemory,
    setSavedAdventureMemory,
  ] = useState(
    stamp.adventureMemory ?? ""
  );

  const [
    isEditingMemory,
    setIsEditingMemory,
  ] = useState(
    allowMemoryEditing && !stamp.adventureMemory
  );

  const [
    isSavingMemory,
    setIsSavingMemory,
  ] = useState(false);

  const quest = allQuests.find((item) => item.id === stamp.questId);
  const stampArtwork = getStampImage(stamp.title || stamp.name) ?? getStampImage(stamp.name) ?? (quest ? getStampImage(quest.stampTitle || quest.title) : undefined);
  const locationLabel = stamp.selectedTrail?.trim() || (quest as any)?.location || (quest as any)?.locationName || (quest as any)?.area || "Not recorded";

  const completedDate =
    formatCompletedDate(
      stamp.earnedAt
    );

  const startTime =
    formatStartTime(
      stamp.driveStartedAt
    );

  const driveDuration =
    formatDriveDuration(
      stamp.driveStartedAt,
      stamp.driveStoppedAt
    );

  /*
   * SAVE ADVENTURE MEMORY
   *
   * The memory is saved back into the
   * matching stamp inside:
   *
   * passports/{uid}
   */
  const saveAdventureMemory =
    async () => {
      const user =
        auth.currentUser;

      if (
        !user ||
        isSavingMemory
      ) {
        return;
      }

      const trimmedMemory =
        adventureMemory.trim();

      if (!trimmedMemory) {
        Alert.alert(
          "Add a memory",
          "Write a short memory from your adventure before saving."
        );

        return;
      }

      setIsSavingMemory(true);

      try {
        const passportRef =
          doc(
            db,
            "passports",
            user.uid
          );

        const passportSnapshot =
          await getDoc(
            passportRef
          );

        if (
          !passportSnapshot.exists()
        ) {
          Alert.alert(
            "Passport not found",
            "We couldn't find your Adventure Passport."
          );

          return;
        }

        const passportData =
          passportSnapshot.data();

        const stamps =
          Array.isArray(
            passportData.stamps
          )
            ? passportData.stamps
            : [];

        const updatedStamps =
          stamps.map(
            (savedStamp: any) => {
              const matches =
                savedStamp?.id ===
                  stamp.id ||
                savedStamp?.questId ===
                  stamp.questId;

              if (!matches) {
                return savedStamp;
              }

              return {
                ...savedStamp,
                adventureMemory:
                  trimmedMemory,
              };
            }
          );

        await updateDoc(
          passportRef,
          {
            stamps:
              updatedStamps,
            updatedAt:
              Timestamp.now(),
          }
        );

        const updatedStamp: SavedPassportStamp =
          {
            ...stamp,
            adventureMemory:
              trimmedMemory,
          };

        setAdventureMemory(
          trimmedMemory
        );

        setSavedAdventureMemory(
          trimmedMemory
        );

        setIsEditingMemory(
          false
        );

        onStampUpdated?.(
          updatedStamp
        );
      } catch (error) {
        console.error(
          "Unable to save adventure memory:",
          error
        );

        Alert.alert(
          "Something went wrong",
          "We couldn't save your Adventure Memory. Please try again."
        );
      } finally {
        setIsSavingMemory(
          false
        );
      }
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
        {/* HEADER */}
        <View
          style={styles.header}
        >
          <Pressable
            style={
              styles.headerSide
            }
            onPress={onBack}
            hitSlop={10}
          >
            <MaterialIcons
              name="arrow-back"
              size={22}
              color={
                colors.text
              }
            />

            <Text
              style={
                styles.backText
              }
            >
              Back
            </Text>
          </Pressable>

          <Text
            style={
              styles.headerTitle
            }
          >
            Stamp Details
          </Text>
          <View style={[styles.headerSide, styles.headerRight]} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={
            styles.scrollContent
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={
            false
          }
        >
          <View
            style={styles.content}
          >
            <View style={styles.heroCard}>
              <Text style={styles.heroEyebrow}>ADVENTURE PASSPORT · STAMP COLLECTED</Text>
              <View style={styles.stampPlaceholder}>
                {stampArtwork ? (
                  <Image source={stampArtwork} style={styles.stampArtwork} resizeMode="contain" />
                ) : (
                  <Text style={styles.heroEyebrow}>STAMP COLLECTED</Text>
                )}
              </View>
              <Text style={styles.questTitle}>{stamp.title || stamp.name}</Text>
              <Text style={styles.completedText}>A little adventure worth remembering.</Text>
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoCard}>

                <Text style={styles.infoLabel}>COMPLETED</Text>
                <Text style={styles.infoValue}>{completedDate}</Text>
              </View>
              <View style={styles.infoCard}>

                <Text style={styles.infoLabel}>LOCATION</Text>
                <Text style={styles.infoValue}>{locationLabel}</Text>
              </View>
            </View>

            {quest?.description ? (
              <View style={styles.storyCard}>
                <View style={styles.sectionTitleRow}>

                  <Text style={styles.sectionTitle}>THE SIDE QUEST</Text>
                </View>
                <Text style={styles.storyTitle}>{quest.title}</Text>
                <Text style={styles.storyText}>{quest.description}</Text>
              </View>
            ) : null}

            <View style={styles.storyCard}>
              <View style={styles.sectionTitleRow}>

                <Text style={styles.sectionTitle}>MY ADVENTURE MEMORY</Text>
              </View>
              {allowMemoryEditing && isEditingMemory ? (
                <>
                  <TextInput
                    style={styles.memoryInput}
                    value={adventureMemory}
                    onChangeText={setAdventureMemory}
                    placeholder="What made this adventure special?"
                    placeholderTextColor="#9CA3AF"
                    multiline
                    textAlignVertical="top"
                    maxLength={500}
                  />
                  <View style={styles.memoryActions}>
                    {savedAdventureMemory ? (
                      <Pressable onPress={() => { setAdventureMemory(savedAdventureMemory); setIsEditingMemory(false); }} hitSlop={8}>
                        <Text style={styles.cancelMemoryText}>Cancel</Text>
                      </Pressable>
                    ) : <View />}
                    <Pressable
                      style={[styles.saveMemoryButton, isSavingMemory && styles.saveMemoryButtonDisabled]}
                      onPress={saveAdventureMemory}
                      disabled={isSavingMemory}
                    >
                      <Text style={styles.saveMemoryButtonText}>{isSavingMemory ? "SAVING..." : "SAVE MEMORY"}</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <Text style={savedAdventureMemory ? styles.memoryText : styles.emptyMemoryText}>
                    {savedAdventureMemory || "No memory was added for this adventure."}
                  </Text>
                  {allowMemoryEditing ? (
                    <Pressable onPress={() => setIsEditingMemory(true)} hitSlop={8}>
                      <Text style={styles.editMemoryText}>{savedAdventureMemory ? "Edit memory" : "Add your memory"}</Text>
                    </Pressable>
                  ) : null}
                </>
              )}
            </View>

            <View style={styles.photoSection}>
              <View style={styles.sectionTitleRow}>

                <Text style={styles.sectionTitle}>ADVENTURE PHOTO</Text>
              </View>
              {stamp.proofPhotoURL ? (
                <Image source={{ uri: stamp.proofPhotoURL }} style={styles.proofPhoto} resizeMode="cover" />
              ) : (
                <View style={styles.photoPlaceholder}>

                  <Text style={styles.photoPlaceholderText}>No photo was added</Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        {/* ================================= */}
        {/* BOTTOM NAVIGATION */}
        {/* ================================= */}

        <BottomNav selected="passport" onExplore={onExplore} onHibernate={onAdventures} onPassport={onPassport} onProfile={onProfile} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
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
      paddingHorizontal: 18,

      borderBottomWidth:
        StyleSheet.hairlineWidth,

      borderBottomColor:
        colors.divider,

      backgroundColor:
        colors.background,
    },

    headerSide: {
      width: 90,
      flexDirection: "row",
      alignItems: "center",
    },

    headerRight: {
      justifyContent:
        "flex-end",
    },

    backText: {
      marginLeft: 5,
      fontFamily:
        fonts.regular,
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

    /*
     * SCROLL
     */

    scroll: {
      flex: 1,
    },

    scrollContent: {
      paddingBottom: 34,
    },

    content: {
      width: "100%",
      maxWidth: 520,
      alignSelf: "center",

      paddingHorizontal: 20,
      paddingTop: 30,
    },

    /*
     * STAMP
     */

    heroCard: { alignItems: "center", paddingVertical: 20, paddingHorizontal: 12, backgroundColor: colors.background, borderWidth: 2, borderColor: colors.green, borderRadius: 14 },
    heroEyebrow: { fontFamily: fonts.extraBold, fontSize: 10, letterSpacing: 1.1, color: colors.green, textAlign: "center" },
    stampArtwork: { width: "100%", height: "100%" },
    infoRow: { flexDirection: "row", gap: 10, marginTop: 16 },
    infoCard: { flex: 1, minHeight: 112, padding: 14, borderRadius: 12, backgroundColor: colors.background, borderWidth: 2, borderColor: colors.green, alignItems: "flex-start", gap: 5 },
    infoLabel: { fontFamily: fonts.extraBold, fontSize: 10, letterSpacing: 0.6, color: colors.red },
    infoValue: { fontFamily: fonts.semiBold, fontSize: 13, lineHeight: 18, color: colors.text },
    storyCard: { marginTop: 16, padding: 19, backgroundColor: colors.background, borderWidth: 2, borderColor: colors.green, borderRadius: 12 },
    sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 13 },
    sectionTitle: { fontFamily: fonts.extraBold, fontSize: 12, letterSpacing: 0.6, color: colors.red },
    storyTitle: { fontFamily: fonts.extraBold, fontSize: 17, lineHeight: 23, color: colors.text, marginBottom: 7 },
    storyText: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 23, color: colors.text },
    emptyMemoryText: { fontFamily: fonts.regularItalic, fontSize: 14, lineHeight: 22, color: colors.textSecondary },
    photoSection: { marginTop: 16, padding: 19, borderRadius: 12, backgroundColor: colors.background, borderWidth: 2, borderColor: colors.green, marginBottom: 18 },
    stampPlaceholder: {
      width: "47%",
      maxWidth: 205,
      aspectRatio: 1,

      alignSelf: "center",

      alignItems: "center",
      justifyContent:
        "center",

      borderWidth: 0,
    },

    stampPlaceholderInner: {
      width: "78%",
      aspectRatio: 1,

      alignItems: "center",
      justifyContent:
        "center",

      borderWidth: 2,
      borderStyle: "dashed",
      borderColor: colors.green,

      borderRadius: 999,
    },

    stampPlaceholderText: {
      marginTop: 5,

      fontFamily:
        fonts.extraBold,

      fontSize: 11,

      letterSpacing: 1.3,

      color: "#A6ADBA",
    },

    questTitle: {
      marginTop: 18,

      textAlign: "center",

      fontFamily:
        fonts.extraBold,

      fontSize: 24,
      lineHeight: 30,

      color: colors.text,
    },

    completedText: {
      marginTop: 4,

      textAlign: "center",

      fontFamily:
        fonts.regular,

      fontSize: 13,

      color:
        colors.textSecondary,
    },

    /*
     * SECTION HEADINGS
     */

    sectionHeading: {
      marginTop: 27,
      marginBottom: 11,

      fontFamily:
        fonts.extraBold,

      fontSize: 12,
      lineHeight: 17,

      color: colors.red,
    },

    /*
     * SNAPSHOT
     */

    snapshotCard: {
      width: "100%",
      minHeight: 83,

      flexDirection: "row",
      alignItems: "center",

      borderWidth: 1.5,
      borderColor:
        colors.divider,

      borderRadius: 4,

      backgroundColor:
        colors.background,
    },

    snapshotItem: {
      flex: 1,

      alignItems: "center",
      justifyContent:
        "center",

      paddingHorizontal: 10,
    },

    snapshotDivider: {
      width: 1,
      height: "56%",

      backgroundColor:
        colors.green,
    },

    snapshotLabel: {
      fontFamily:
        fonts.regular,

      fontSize: 12,

      color:
        colors.textSecondary,
    },

    snapshotValue: {
      marginTop: 4,

      fontFamily:
        fonts.extraBold,

      fontSize: 18,

      color: colors.text,
    },

    /*
     * MEMORY
     */

    memoryCard: {
      width: "100%",
      minHeight: 126,

      paddingHorizontal: 15,
      paddingVertical: 14,

      borderWidth: 1.5,
      borderColor:
        colors.green,

      borderRadius: 4,

      backgroundColor:
        colors.background,
    },

    memoryInput: {
      width: "100%",
      minHeight: 72,

      padding: 0,

      fontFamily:
        fonts.regular,

      fontSize: 14,
      lineHeight: 20,

      color: colors.text,
    },

    memoryText: {
      fontFamily:
        fonts.regular,

      fontSize: 14,
      lineHeight: 21,

      color: colors.text,
    },

    editMemoryText: {
      marginTop: 10,

      fontFamily:
        fonts.semiBold,

      fontSize: 12,

      textDecorationLine:
        "underline",

      color: colors.orange,
    },

    memoryActions: {
      marginTop: 11,

      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",

      gap: 12,
    },

    cancelMemoryText: {
      fontFamily:
        fonts.semiBold,

      fontSize: 12,

      textDecorationLine:
        "underline",

      color:
        colors.textSecondary,
    },

    saveMemoryButton: {
      minHeight: 37,

      paddingHorizontal: 16,

      alignItems: "center",
      justifyContent:
        "center",

      borderRadius: 3,

      backgroundColor:
        colors.green,
    },

    saveMemoryButtonDisabled: {
      opacity: 0.65,
    },

    saveMemoryButtonText: {
      fontFamily:
        fonts.extraBold,

      fontSize: 11,

      color: colors.white,
    },

    /*
     * PROOF PHOTO
     */

    proofPhoto: {
      width: "100%",
      aspectRatio: 16 / 10,

      borderRadius: 4,

      backgroundColor:
        "#E4E1D9",
    },

    photoPlaceholder: {
      width: "100%",
      aspectRatio: 16 / 10,

      alignItems: "center",
      justifyContent:
        "center",

      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: "#A6ADBA",

      borderRadius: 4,

      backgroundColor:
        "#F3F4F6",
    },

    photoPlaceholderText: {
      marginTop: 7,

      fontFamily:
        fonts.regular,

      fontSize: 12,

      color:
        colors.textSecondary,
    },

    /*
     * BOTTOM NAV
     */

    bottomNav: {
      minHeight: 86,

      flexDirection: "row",
      alignItems: "stretch",

      paddingHorizontal: 15,
      paddingTop: 8,
      paddingBottom: 5,

      borderTopWidth:
        StyleSheet.hairlineWidth,

      borderTopColor:
        colors.divider,

      backgroundColor:
        colors.background,
    },

    navItem: {
      flex: 1,
      minWidth: 0,

      alignItems: "center",
      justifyContent:
        "center",

      gap: 4,

      borderRadius: 3,
    },

    navItemSelected: {
      backgroundColor:
        colors.orange,

      shadowColor: "#000000",

      shadowOffset: {
        width: 0,
        height: 3,
      },

      shadowOpacity: 0.18,

      shadowRadius: 4,

      elevation: 4,
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
    },
  });