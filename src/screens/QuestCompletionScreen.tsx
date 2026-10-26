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

import type { Quest } from "./HomeScreen";
import type { QuestProgress } from "./QuestTrackerScreen";

import {
  auth,
  db,
} from "../firebase/firebase";

import {
  colors,
  fonts,
} from "../theme/theme";

export type SavedPassportStamp = {
  id: string;
  questId: string;
  name: string;
  title: string;

  earnedAt: Timestamp;

  driveStartedAt: Timestamp | null;
  driveStoppedAt: Timestamp | null;

  proofPhotoURL: string | null;

  selectedTrail: string | null;

  adventureMemory: string;
};

type QuestCompletionScreenProps = {
  quest: Quest;
  progress: QuestProgress;

  onExplore: () => void;
  onAdventures: () => void;
  onPassport: () => void;
  onProfile: () => void;

  onStampAdded: (
    stamp: SavedPassportStamp
  ) => void;
};

export default function QuestCompletionScreen({
  quest,
  progress,
  onExplore,
  onAdventures,
  onPassport,
  onProfile,
  onStampAdded,
}: QuestCompletionScreenProps) {
  const [isAddingToPassport, setIsAddingToPassport] =
    useState(false);

  /*
   * ADD COMPLETED QUEST TO PASSPORT
   */
  const addToPassport = async () => {
    const user = auth.currentUser;

    if (!user || isAddingToPassport) {
      return;
    }

    setIsAddingToPassport(true);

    try {
      const passportRef = doc(
        db,
        "passports",
        user.uid
      );

      const passportSnapshot =
        await getDoc(passportRef);

      if (!passportSnapshot.exists()) {
        Alert.alert(
          "Passport not found",
          "Please create your Adventure Passport before adding this stamp."
        );

        return;
      }

      const passportData =
        passportSnapshot.data();

      const existingStamps = Array.isArray(
        passportData.stamps
      )
        ? passportData.stamps
        : [];

      /*
       * Use the quest ID as the stamp ID.
       *
       * For Get It Dirty this should be:
       * get-it-dirty
       */
      const stampId = quest.id;

      const earnedAt =
        progress.completedAt ??
        Timestamp.now();

      const newStamp: SavedPassportStamp = {
        id: stampId,
        questId: quest.id,

        name: quest.title,
        title: quest.stampTitle,

        earnedAt,

        driveStartedAt:
          progress.driveStartedAt,

        driveStoppedAt:
          progress.driveStoppedAt,

        proofPhotoURL:
          progress.proofPhotoURL,

        selectedTrail:
          progress.selectedTrail,

        adventureMemory: "",
      };

      /*
       * Prevent duplicate stamps.
       *
       * If this quest is already in the passport,
       * update its saved data instead of adding
       * another copy.
       */
      const existingStampIndex =
        existingStamps.findIndex(
          (stamp: any) =>
            stamp?.id === stampId ||
            stamp?.questId === quest.id
        );

      let updatedStamps;

      if (existingStampIndex >= 0) {
        updatedStamps = [
          ...existingStamps,
        ];

        const existingStamp =
          updatedStamps[
            existingStampIndex
          ] ?? {};

        updatedStamps[
          existingStampIndex
        ] = {
          ...existingStamp,
          ...newStamp,

          /*
           * Preserve an Adventure Memory if
           * the user has already written one.
           */
          adventureMemory:
            typeof existingStamp.adventureMemory ===
              "string"
              ? existingStamp.adventureMemory
              : "",
        };
      } else {
        updatedStamps = [
          ...existingStamps,
          newStamp,
        ];
      }

      /*
       * First adventure date:
       * keep the existing one if it already exists.
       */
      const firstAdventureAt =
        passportData.firstAdventureAt instanceof
        Timestamp
          ? passportData.firstAdventureAt
          : earnedAt;

      /*
       * Last adventure date:
       * this newly completed quest becomes
       * the latest adventure.
       */
      const lastAdventureAt =
        earnedAt;

      await updateDoc(
        passportRef,
        {
          stamps: updatedStamps,

          stampCount:
            updatedStamps.length,

          firstAdventureAt,

          lastAdventureAt,

          updatedAt:
            Timestamp.now(),
        }
      );

      /*
       * Send the final saved stamp forward.
       * This will open Stamp Details from App.tsx.
       */
      const finalSavedStamp =
        updatedStamps.find(
          (stamp: any) =>
            stamp?.id === stampId ||
            stamp?.questId === quest.id
        ) as SavedPassportStamp;

      onStampAdded(
        finalSavedStamp
      );
    } catch (error) {
      console.error(
        "Unable to add stamp to passport:",
        error
      );

      Alert.alert(
        "Something went wrong",
        "We couldn't add your stamp to your Adventure Passport. Please try again."
      );
    } finally {
      setIsAddingToPassport(false);
    }
  };

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top", "bottom"]}
    >
      <View style={styles.screen}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={
            styles.scrollContent
          }
          showsVerticalScrollIndicator={
            false
          }
        >
          <View style={styles.content}>
            <Text
              style={
                styles.congratulations
              }
            >
              CONGRATULATIONS
            </Text>

            <Text style={styles.title}>
              Side Quest Complete!
            </Text>

            {/* BADGE PLACEHOLDER */}
            <View
              style={
                styles.badgePlaceholder
              }
            >
              <View
                style={
                  styles.badgeCircle
                }
              >
                <MaterialIcons
                  name="workspace-premium"
                  size={64}
                  color="#A6ADBA"
                />

                <Text
                  style={
                    styles.badgePlaceholderText
                  }
                >
                  BADGE
                </Text>
              </View>
            </View>

            <Text
              style={styles.earnedTitle}
            >
              You earned the{" "}
              {quest.stampTitle} stamp!
            </Text>

            <Text
              style={styles.description}
            >
              The stamp has been authorized and
              is ready to be locked into your
              physical-style booklet.
            </Text>
          </View>

          <View
            style={styles.flexSpacer}
          />

          {/* RED FLAG / SCALLOP PATTERN */}
          <Image
            source={require("../../assets/images/footer-pattern.png")}
            style={styles.footerPattern}
            resizeMode="stretch"
          />

          <View style={styles.actions}>
            <Pressable
              style={[
                styles.passportButton,
                isAddingToPassport &&
                  styles.passportButtonDisabled,
              ]}
              onPress={addToPassport}
              disabled={
                isAddingToPassport
              }
            >
              {isAddingToPassport ? (
                <ActivityIndicator
                  size="small"
                  color={colors.white}
                />
              ) : (
                <Text
                  style={
                    styles.passportButtonText
                  }
                >
                  ADD TO PASSPORT
                </Text>
              )}
            </Pressable>

            <Pressable hitSlop={10}>
              <Text
                style={styles.shareText}
              >
                Share Achievement
              </Text>
            </Pressable>
          </View>
        </ScrollView>

        {/* BOTTOM NAVIGATION */}
        <BottomNav selected="hibernate" onExplore={onExplore} onHibernate={onAdventures} onPassport={onPassport} onProfile={onProfile} />
      </View>
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

    scroll: {
      flex: 1,
    },

    scrollContent: {
      flexGrow: 1,
    },

    content: {
      width: "100%",
      maxWidth: 520,
      alignSelf: "center",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingTop: 54,
    },

    congratulations: {
      fontFamily:
        fonts.extraBold,
      fontSize: 16,
      lineHeight: 21,
      textAlign: "center",
      color: colors.orange,
    },

    title: {
      marginTop: 14,
      fontFamily:
        fonts.extraBold,
      fontSize: 35,
      lineHeight: 42,
      textAlign: "center",
      color: colors.text,
    },

    badgePlaceholder: {
      width: "72%",
      maxWidth: 295,
      aspectRatio: 1,
      marginTop: 36,
      alignItems: "center",
      justifyContent:
        "center",

      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor: "#A6ADBA",
    },

    badgeCircle: {
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

    badgePlaceholderText: {
      marginTop: 8,
      fontFamily:
        fonts.extraBold,
      fontSize: 13,
      letterSpacing: 1.5,
      color: "#A6ADBA",
    },

    earnedTitle: {
      marginTop: 32,
      paddingHorizontal: 8,
      fontFamily:
        fonts.extraBold,
      fontSize: 20,
      lineHeight: 26,
      textAlign: "center",
      color: colors.text,
    },

    description: {
      maxWidth: 390,
      marginTop: 10,
      paddingHorizontal: 6,
      fontFamily:
        fonts.regular,
      fontSize: 17,
      lineHeight: 24,
      textAlign: "center",
      color:
        colors.textSecondary,
    },

    flexSpacer: {
      flex: 1,
      minHeight: 90,
    },

    footerPattern: {
      width: "100%",
      height: 31,
    },

    actions: {
      width: "100%",
      maxWidth: 520,
      alignSelf: "center",
      alignItems: "center",
      paddingHorizontal: 24,
      paddingTop: 26,
      paddingBottom: 18,
    },

    passportButton: {
      width: "100%",
      minHeight: 62,
      alignItems: "center",
      justifyContent:
        "center",
      borderRadius: 4,
      backgroundColor:
        colors.green,

      shadowColor: "#000000",

      shadowOffset: {
        width: 0,
        height: 4,
      },

      shadowOpacity: 0.18,
      shadowRadius: 5,
      elevation: 4,
    },

    passportButtonDisabled: {
      opacity: 0.7,
    },

    passportButtonText: {
      fontFamily:
        fonts.extraBold,
      fontSize: 17,
      lineHeight: 22,
      color: colors.white,
    },

    shareText: {
      marginTop: 15,
      fontFamily:
        fonts.semiBold,
      fontSize: 16,
      lineHeight: 21,
      textDecorationLine:
        "underline",
      color: colors.text,
    },

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
      fontSize: 11,
      textAlign: "center",
      color: colors.text,
    },

    navTextSelected: {
      fontFamily:
        fonts.extraBold,
    },
  });