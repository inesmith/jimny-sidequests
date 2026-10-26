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
    !stamp.adventureMemory
  );

  const [
    isSavingMemory,
    setIsSavingMemory,
  ] = useState(false);

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

          <Pressable
            style={[
              styles.headerSide,
              styles.headerRight,
            ]}
            hitSlop={10}
          >
            <MaterialIcons
              name="more-horiz"
              size={26}
              color={
                colors.text
              }
            />
          </Pressable>
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
            {/* ================================= */}
            {/* STAMP */}
            {/* ================================= */}

            <View
              style={
                styles.stampPlaceholder
              }
            >
              <View
                style={
                  styles.stampPlaceholderInner
                }
              >
                <MaterialIcons
                  name="workspace-premium"
                  size={58}
                  color="#A6ADBA"
                />

                <Text
                  style={
                    styles.stampPlaceholderText
                  }
                >
                  STAMP
                </Text>
              </View>
            </View>

            <Text
              style={
                styles.questTitle
              }
            >
              {stamp.name}
            </Text>

            <Text
              style={
                styles.completedText
              }
            >
              Completed{" "}
              {completedDate}
            </Text>

            {/* ================================= */}
            {/* QUEST TRACKER SNAPSHOT */}
            {/* ================================= */}

            <Text
              style={
                styles.sectionHeading
              }
            >
              QUEST TRACKER
              SNAPSHOT
            </Text>

            <View
              style={
                styles.snapshotCard
              }
            >
              <View
                style={
                  styles.snapshotItem
                }
              >
                <Text
                  style={
                    styles.snapshotLabel
                  }
                >
                  Start time
                </Text>

                <Text
                  style={
                    styles.snapshotValue
                  }
                >
                  {startTime}
                </Text>
              </View>

              <View
                style={
                  styles.snapshotDivider
                }
              />

              <View
                style={
                  styles.snapshotItem
                }
              >
                <Text
                  style={
                    styles.snapshotLabel
                  }
                >
                  Timelaps
                </Text>

                <Text
                  style={
                    styles.snapshotValue
                  }
                >
                  {driveDuration}
                </Text>
              </View>
            </View>

            {/* ================================= */}
            {/* ADVENTURE MEMORY */}
            {/* ================================= */}

            <Text
              style={
                styles.sectionHeading
              }
            >
              MY ADVENTURE MEMORY
            </Text>

            <View
              style={
                styles.memoryCard
              }
            >
              {isEditingMemory ? (
                <>
                  <TextInput
                    style={
                      styles.memoryInput
                    }
                    value={
                      adventureMemory
                    }
                    onChangeText={
                      setAdventureMemory
                    }
                    placeholder="Write a memory from this adventure..."
                    placeholderTextColor="#9CA3AF"
                    multiline
                    textAlignVertical="top"
                    maxLength={500}
                  />

                  <View
                    style={
                      styles.memoryActions
                    }
                  >
                    {savedAdventureMemory ? (
                      <Pressable
                        onPress={() => {
                          setAdventureMemory(
                            savedAdventureMemory
                          );

                          setIsEditingMemory(
                            false
                          );
                        }}
                        hitSlop={8}
                      >
                        <Text
                          style={
                            styles.cancelMemoryText
                          }
                        >
                          Cancel
                        </Text>
                      </Pressable>
                    ) : (
                      <View />
                    )}

                    <Pressable
                      style={[
                        styles.saveMemoryButton,
                        isSavingMemory &&
                          styles.saveMemoryButtonDisabled,
                      ]}
                      onPress={
                        saveAdventureMemory
                      }
                      disabled={
                        isSavingMemory
                      }
                    >
                      <Text
                        style={
                          styles.saveMemoryButtonText
                        }
                      >
                        {isSavingMemory
                          ? "SAVING..."
                          : "SAVE MEMORY"}
                      </Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <Pressable
                  onPress={() =>
                    setIsEditingMemory(
                      true
                    )
                  }
                >
                  <Text
                    style={
                      styles.memoryText
                    }
                  >
                    {
                      savedAdventureMemory
                    }
                  </Text>

                  <Text
                    style={
                      styles.editMemoryText
                    }
                  >
                    Edit memory
                  </Text>
                </Pressable>
              )}
            </View>

            {/* ================================= */}
            {/* PHOTO PROOF */}
            {/* ================================= */}

            <Text
              style={
                styles.sectionHeading
              }
            >
              ATTACHED PHOTO PROOF
            </Text>

            {stamp.proofPhotoURL ? (
              <Image
                source={{
                  uri: stamp.proofPhotoURL,
                }}
                style={
                  styles.proofPhoto
                }
                resizeMode="cover"
              />
            ) : (
              <View
                style={
                  styles.photoPlaceholder
                }
              >
                <MaterialIcons
                  name="image"
                  size={38}
                  color="#A6ADBA"
                />

                <Text
                  style={
                    styles.photoPlaceholderText
                  }
                >
                  No proof photo
                  attached
                </Text>
              </View>
            )}
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
      height: 72,
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

      fontSize: 20,

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

    stampPlaceholder: {
      width: "47%",
      maxWidth: 205,
      aspectRatio: 1,

      alignSelf: "center",

      alignItems: "center",
      justifyContent:
        "center",

      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: "#A6ADBA",
    },

    stampPlaceholderInner: {
      width: "78%",
      aspectRatio: 1,

      alignItems: "center",
      justifyContent:
        "center",

      borderWidth: 2,
      borderStyle: "dashed",
      borderColor: "#C7CAD0",

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

      fontSize: 14,
      lineHeight: 18,

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
        colors.green,

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