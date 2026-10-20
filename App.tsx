import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import {
  Inter_400Regular,
  Inter_400Regular_Italic,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/inter";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";

import LoginScreen from "./src/screens/LoginScreen";
import SignUpScreen from "./src/screens/SignUpScreen";
import LandingScreen from "./src/screens/LandingScreen";
import HomeScreen, {
  type Quest,
} from "./src/screens/HomeScreen";
import QuestDetailsScreen from "./src/screens/QuestDetailsScreen";
import QuestTrackerScreen, {
  type QuestProgress,
} from "./src/screens/QuestTrackerScreen";
import HibernateScreen from "./src/screens/HibernateScreen";
import CreatePassportScreen from "./src/screens/CreatePassportScreen";
import MyPassportScreen from "./src/screens/MyPassportScreen";

import { auth, db } from "./src/firebase/firebase";
import { colors } from "./src/theme/theme";

type Screen =
  | "login"
  | "signup"
  | "landing"
  | "home"
  | "questDetails"
  | "questTracker"
  | "hibernate"
  | "createPassport"
  | "myPassport";

export default function App() {
  const [screen, setScreen] =
    useState<Screen>("login");

  const [selectedQuest, setSelectedQuest] =
    useState<Quest | null>(null);

  const [selectedQuestProgress, setSelectedQuestProgress] =
    useState<QuestProgress | null>(null);

  const [isCheckingPassport, setIsCheckingPassport] =
    useState(false);

  const [isLoadingQuest, setIsLoadingQuest] =
    useState(false);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_400Regular_Italic,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_800ExtraBold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  const openPassport = async () => {
    const user = auth.currentUser;

    if (!user) {
      setScreen("login");
      return;
    }

    if (isCheckingPassport) {
      return;
    }

    setIsCheckingPassport(true);

    try {
      const passportRef = doc(
        db,
        "passports",
        user.uid
      );

      const passportSnapshot =
        await getDoc(passportRef);

      if (passportSnapshot.exists()) {
        setScreen("myPassport");
      } else {
        setScreen("createPassport");
      }
    } catch (error) {
      console.error(
        "Unable to check passport:",
        error
      );

      setScreen("createPassport");
    } finally {
      setIsCheckingPassport(false);
    }
  };

  const getQuestProgress = async (
    quest: Quest
  ): Promise<QuestProgress | null> => {
    const user = auth.currentUser;

    if (!user) {
      return null;
    }

    const questRef = doc(
      db,
      "users",
      user.uid,
      "quests",
      quest.id
    );

    const snapshot = await getDoc(questRef);

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();

    return {
      questId: quest.id,

      status:
        data.status === "completed"
          ? "completed"
          : "active",

      currentStep:
        typeof data.currentStep === "number"
          ? data.currentStep
          : 1,

      completedSteps: Array.isArray(
        data.completedSteps
      )
        ? data.completedSteps
        : [],

      startedAt:
        data.startedAt instanceof Timestamp
          ? data.startedAt
          : null,

      selectedTrail:
        typeof data.selectedTrail === "string"
          ? data.selectedTrail
          : null,

      driveStatus:
        data.driveStatus === "driving" ||
        data.driveStatus === "stopped"
          ? data.driveStatus
          : "ready",

      driveStartedAt:
        data.driveStartedAt instanceof Timestamp
          ? data.driveStartedAt
          : null,

      driveStoppedAt:
        data.driveStoppedAt instanceof Timestamp
          ? data.driveStoppedAt
          : null,

      proofPhotoURL:
        typeof data.proofPhotoURL === "string"
          ? data.proofPhotoURL
          : null,

      completedAt:
        data.completedAt instanceof Timestamp
          ? data.completedAt
          : null,
    };
  };

  const openQuestDetails = async (
    quest: Quest
  ) => {
    setSelectedQuest(quest);
    setSelectedQuestProgress(null);
    setScreen("questDetails");

    const user = auth.currentUser;

    if (!user) {
      return;
    }

    try {
      const progress =
        await getQuestProgress(quest);

      setSelectedQuestProgress(progress);
    } catch (error) {
      console.error(
        "Unable to load quest progress:",
        error
      );
    }
  };

  const startOrContinueQuest = async (
    quest: Quest
  ) => {
    const user = auth.currentUser;

    if (!user) {
      setScreen("login");
      return;
    }

    if (isLoadingQuest) {
      return;
    }

    setIsLoadingQuest(true);

    try {
      let progress =
        await getQuestProgress(quest);

      if (
        progress &&
        progress.status === "active"
      ) {
        setSelectedQuest(quest);
        setSelectedQuestProgress(progress);
        setScreen("questTracker");
        return;
      }

      const questRef = doc(
        db,
        "users",
        user.uid,
        "quests",
        quest.id
      );

      await setDoc(questRef, {
        questId: quest.id,
        status: "active",
        currentStep: 1,
        completedSteps: [],
        selectedTrail: null,

        driveStatus: "ready",
        driveStartedAt: null,
        driveStoppedAt: null,

        proofPhotoURL: null,
        startedAt: serverTimestamp(),
        completedAt: null,
      });

      const newSnapshot =
        await getDoc(questRef);

      const newData = newSnapshot.data();

      progress = {
        questId: quest.id,
        status: "active",
        currentStep: 1,
        completedSteps: [],
        selectedTrail: null,

        driveStatus: "ready",
        driveStartedAt: null,
        driveStoppedAt: null,

        proofPhotoURL: null,

        startedAt:
          newData?.startedAt instanceof Timestamp
            ? newData.startedAt
            : Timestamp.now(),

        completedAt: null,
      };

      setSelectedQuest(quest);
      setSelectedQuestProgress(progress);
      setScreen("questTracker");
    } catch (error) {
      console.error(
        "Unable to start quest:",
        error
      );

      Alert.alert(
        "Something went wrong",
        "We couldn't start this Side Quest. Please try again."
      );
    } finally {
      setIsLoadingQuest(false);
    }
  };

  const selectTrailForQuest = async (
    trailName: string
  ) => {
    const user = auth.currentUser;

    if (
      !user ||
      !selectedQuest ||
      !selectedQuestProgress
    ) {
      Alert.alert(
        "Quest unavailable",
        "We couldn't find your active Side Quest."
      );
      return;
    }

    try {
      const completedSteps =
        Array.from(
          new Set([
            ...selectedQuestProgress.completedSteps,
            1,
          ])
        ).sort((a, b) => a - b);

      const updatedProgress: QuestProgress = {
        ...selectedQuestProgress,
        status: "active",

        currentStep: Math.max(
          2,
          selectedQuestProgress.currentStep
        ),

        completedSteps,
        selectedTrail: trailName,

        driveStatus: "ready",
        driveStartedAt: null,
        driveStoppedAt: null,
      };

      const questRef = doc(
        db,
        "users",
        user.uid,
        "quests",
        selectedQuest.id
      );

      await updateDoc(questRef, {
        currentStep:
          updatedProgress.currentStep,

        completedSteps:
          updatedProgress.completedSteps,

        selectedTrail: trailName,

        driveStatus: "ready",
        driveStartedAt: null,
        driveStoppedAt: null,
      });

      setSelectedQuestProgress(
        updatedProgress
      );

      setScreen("questTracker");
    } catch (error) {
      console.error(
        "Unable to save selected trail:",
        error
      );

      Alert.alert(
        "Something went wrong",
        "We couldn't save your selected trail. Please try again."
      );

      throw error;
    }
  };

  const renderScreen = () => {
    if (screen === "signup") {
      return (
        <SignUpScreen
          onBack={() => setScreen("login")}
          onLogin={() => setScreen("landing")}
        />
      );
    }

    if (screen === "landing") {
      return (
        <LandingScreen
          onExploreQuests={() =>
            setScreen("home")
          }
          onViewPassport={openPassport}
        />
      );
    }

    if (screen === "home") {
      return (
        <HomeScreen
          onPassport={openPassport}
          onQuestPress={openQuestDetails}
        />
      );
    }

    if (
      screen === "questDetails" &&
      selectedQuest
    ) {
      return (
        <QuestDetailsScreen
          quest={selectedQuest}
          isActive={
            selectedQuestProgress?.status ===
            "active"
          }
          onBack={() => setScreen("home")}
          onExplore={() => setScreen("home")}
          onPassport={openPassport}
          onStart={startOrContinueQuest}
          onAdventures={() => {
            if (
              selectedQuestProgress?.status ===
              "active"
            ) {
              setScreen("questTracker");
            }
          }}
        />
      );
    }

    if (
      screen === "questTracker" &&
      selectedQuest &&
      selectedQuestProgress
    ) {
      return (
        <QuestTrackerScreen
          quest={selectedQuest}
          progress={selectedQuestProgress}
          onProgressChange={
            setSelectedQuestProgress
          }
          onBackToExplore={() =>
            setScreen("home")
          }
          onPassport={openPassport}
          onFindTrail={() =>
            setScreen("hibernate")
          }
          onAbandon={() => {
            setSelectedQuestProgress(null);
            setScreen("home");
          }}
        />
      );
    }

    if (
      screen === "hibernate" &&
      selectedQuest &&
      selectedQuestProgress
    ) {
      return (
        <HibernateScreen
          onBack={() =>
            setScreen("questTracker")
          }
          onTrailSelected={
            selectTrailForQuest
          }
          onExplore={() =>
            setScreen("home")
          }
          onAdventures={() =>
            setScreen("questTracker")
          }
          onPassport={openPassport}
        />
      );
    }

    if (screen === "createPassport") {
      return (
        <CreatePassportScreen
          onBack={() =>
            setScreen("landing")
          }
          onExplore={() =>
            setScreen("home")
          }
          onCreatePassport={() =>
            setScreen("myPassport")
          }
        />
      );
    }

    if (screen === "myPassport") {
      return (
        <MyPassportScreen
          onBack={() =>
            setScreen("landing")
          }
          onExplore={() =>
            setScreen("home")
          }
        />
      );
    }

    return (
      <LoginScreen
        onSignUp={() =>
          setScreen("signup")
        }
        onLogin={() =>
          setScreen("landing")
        }
      />
    );
  };

  if (
    isCheckingPassport ||
    isLoadingQuest
  ) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />

        <View style={styles.loading}>
          <ActivityIndicator
            color={colors.green}
          />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {renderScreen()}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
});