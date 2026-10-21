import {
  useEffect,
  useState,
} from "react";
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
  onAuthStateChanged,
} from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";

import EditProfileScreen from "./src/screens/EditProfileScreen";
import LoginScreen from "./src/screens/LoginScreen";
import SignUpScreen from "./src/screens/SignUpScreen";
import LandingScreen from "./src/screens/LandingScreen";

import HomeScreen, {
  type Quest,
} from "./src/screens/HomeScreen";

import NotificationsScreen, {
  type NotificationItem,
} from "./src/screens/NotificationsScreen";

import MyAdventuresScreen from "./src/screens/MyAdventuresScreen";
import UpcomingExperiencesScreen from "./src/screens/UpcomingExperiencesScreen";

import ExperienceDetailsScreen, {
  type Experience,
} from "./src/screens/ExperienceDetailsScreen";

import QuestDetailsScreen from "./src/screens/QuestDetailsScreen";

import QuestTrackerScreen, {
  type QuestProgress,
} from "./src/screens/QuestTrackerScreen";

import QuestCompletionScreen, {
  type SavedPassportStamp,
} from "./src/screens/QuestCompletionScreen";

import StampDetailsScreen from "./src/screens/StampDetailsScreen";

import HibernateScreen from "./src/screens/HibernateScreen";
import CreatePassportScreen from "./src/screens/CreatePassportScreen";
import MyPassportScreen from "./src/screens/MyPassportScreen";
import MyProfileScreen from "./src/screens/MyProfileScreen";

import useNotifications, {
  type BackendNotificationItem,
} from "./src/hooks/useNotifications";

import {
  auth,
  db,
} from "./src/firebase/firebase";

import { colors } from "./src/theme/theme";

type Screen =
  | "login"
  | "signup"
  | "landing"
  | "home"
  | "notifications"
  | "myAdventures"
  | "upcomingExperiences"
  | "experienceDetails"
  | "questDetails"
  | "questTracker"
  | "questCompletion"
  | "stampDetails"
  | "hibernate"
  | "createPassport"
  | "myPassport"
  | "myProfile"
  | "editProfile";

type UpcomingExperiencesOrigin =
  | "landing"
  | "home"
  | "myAdventures";

type ExperienceDetailsOrigin =
  | "upcomingExperiences"
  | "notifications";

export default function App() {
  const [screen, setScreen] =
    useState<Screen>("login");

  /*
   * AUTH STARTUP
   *
   * We wait for Firebase to restore
   * the persisted authentication
   * session before deciding whether
   * Login or Landing should be shown.
   */
  const [
    isCheckingAuth,
    setIsCheckingAuth,
  ] = useState(true);

  const [
    upcomingExperiencesBackScreen,
    setUpcomingExperiencesBackScreen,
  ] =
    useState<UpcomingExperiencesOrigin>(
      "home"
    );

  const [
    experienceDetailsBackScreen,
    setExperienceDetailsBackScreen,
  ] =
    useState<ExperienceDetailsOrigin>(
      "upcomingExperiences"
    );

  const [
    selectedExperience,
    setSelectedExperience,
  ] =
    useState<Experience | null>(
      null
    );

  const [
    selectedQuest,
    setSelectedQuest,
  ] =
    useState<Quest | null>(
      null
    );

  const [
    selectedQuestProgress,
    setSelectedQuestProgress,
  ] =
    useState<QuestProgress | null>(
      null
    );

  const [
    selectedPassportStamp,
    setSelectedPassportStamp,
  ] =
    useState<SavedPassportStamp | null>(
      null
    );

  const [
    isCheckingPassport,
    setIsCheckingPassport,
  ] = useState(false);

  const [
    isLoadingQuest,
    setIsLoadingQuest,
  ] = useState(false);

  const [
    isOpeningNotification,
    setIsOpeningNotification,
  ] = useState(false);

  const [fontsLoaded] =
    useFonts({
      Inter_400Regular,
      Inter_400Regular_Italic,
      Inter_500Medium,
      Inter_600SemiBold,
      Inter_800ExtraBold,
    });

  /*
   * RESTORE SAVED LOGIN
   */
  useEffect(() => {
    let hasResolvedInitialAuth =
      false;

    const unsubscribe =
      onAuthStateChanged(
        auth,
        (user) => {
          /*
           * Only use the first auth result
           * to decide the startup screen.
           *
           * This prevents later sign-out
           * events from fighting with the
           * existing profile navigation.
           */
          if (
            !hasResolvedInitialAuth
          ) {
            hasResolvedInitialAuth =
              true;

            if (user) {
              setScreen(
                "landing"
              );
            } else {
              setScreen(
                "login"
              );
            }

            setIsCheckingAuth(
              false
            );
          }
        },
        (error) => {
          console.error(
            "Unable to restore authentication session:",
            error
          );

          if (
            !hasResolvedInitialAuth
          ) {
            hasResolvedInitialAuth =
              true;

            setScreen(
              "login"
            );

            setIsCheckingAuth(
              false
            );
          }
        }
      );

    return unsubscribe;
  }, []);

  /*
   * REAL BACKEND NOTIFICATIONS
   */
  const {
    notifications,
    unreadCount:
      unreadNotificationCount,
    markNotificationAsRead,
    markAllAsRead:
      markAllNotificationsAsRead,
    getExperienceFromNotification,
  } = useNotifications();

  if (
    !fontsLoaded ||
    isCheckingAuth
  ) {
    return (
      <SafeAreaProvider>
        <StatusBar
          style="dark"
        />

        <View
          style={
            styles.loading
          }
        >
          <ActivityIndicator
            color={
              colors.green
            }
          />
        </View>
      </SafeAreaProvider>
    );
  }

  /*
   * OPEN PASSPORT
   */
  const openPassport =
    async () => {
      const user =
        auth.currentUser;

      if (!user) {
        setScreen("login");
        return;
      }

      if (isCheckingPassport) {
        return;
      }

      setIsCheckingPassport(
        true
      );

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
          passportSnapshot.exists()
        ) {
          setScreen(
            "myPassport"
          );
        } else {
          setScreen(
            "createPassport"
          );
        }
      } catch (error) {
        console.error(
          "Unable to check passport:",
          error
        );

        setScreen(
          "createPassport"
        );
      } finally {
        setIsCheckingPassport(
          false
        );
      }
    };

  /*
   * OPEN PROFILE
   */
  const openProfile = () => {
    const user =
      auth.currentUser;

    if (!user) {
      setScreen("login");
      return;
    }

    setScreen(
      "myProfile"
    );
  };

  /*
   * OPEN ADVENTURES
   */
  const openAdventures =
    () => {
      const user =
        auth.currentUser;

      if (!user) {
        setScreen(
          "login"
        );

        return;
      }

      setScreen(
        "myAdventures"
      );
    };

  /*
   * OPEN NOTIFICATIONS
   */
  const openNotifications =
    () => {
      const user =
        auth.currentUser;

      if (!user) {
        setScreen(
          "login"
        );

        return;
      }

      setScreen(
        "notifications"
      );
    };

  /*
   * NOTIFICATION ACTION
   */
  const handleNotificationPress =
    async (
      notification: NotificationItem
    ) => {
      if (
        isOpeningNotification
      ) {
        return;
      }

      const backendNotification =
        notification as BackendNotificationItem;

      try {
        setIsOpeningNotification(
          true
        );

        /*
         * Persist READ state
         * in Firestore.
         */
        await markNotificationAsRead(
          backendNotification
        );

        /*
         * EXPERIENCE / EVENT UPDATE
         */
        if (
          backendNotification.type ===
            "experience" ||
          backendNotification.type ===
            "eventUpdate"
        ) {
          const experience =
            await getExperienceFromNotification(
              backendNotification
            );

          if (!experience) {
            Alert.alert(
              "Experience unavailable",
              "We couldn't find this experience. It may have been removed."
            );

            return;
          }

          setSelectedExperience(
            experience
          );

          setExperienceDetailsBackScreen(
            "notifications"
          );

          setScreen(
            "experienceDetails"
          );

          return;
        }

        /*
         * STAMP
         *
         * Real stamp notifications
         * will be connected next.
         */
        if (
          backendNotification.type ===
          "stamp"
        ) {
          await openPassport();

          return;
        }

        /*
         * INVITE / WAVE / APP UPDATE
         *
         * These features do not have
         * dedicated destinations yet.
         */
      } catch (error) {
        console.error(
          "Unable to open notification:",
          error
        );

        Alert.alert(
          "Something went wrong",
          "We couldn't open this notification. Please try again."
        );
      } finally {
        setIsOpeningNotification(
          false
        );
      }
    };

  /*
   * OPEN UPCOMING EXPERIENCES
   */
  const openUpcomingExperiences =
    (
      from: UpcomingExperiencesOrigin
    ) => {
      const user =
        auth.currentUser;

      if (!user) {
        setScreen(
          "login"
        );

        return;
      }

      setUpcomingExperiencesBackScreen(
        from
      );

      setScreen(
        "upcomingExperiences"
      );
    };

  /*
   * OPEN EXPERIENCE DETAILS
   */
  const openExperienceDetails =
    (
      experience: Experience
    ) => {
      setSelectedExperience(
        experience
      );

      setExperienceDetailsBackScreen(
        "upcomingExperiences"
      );

      setScreen(
        "experienceDetails"
      );
    };

  /*
   * OPEN EDIT PROFILE
   */
  const openEditProfile =
    () => {
      setScreen(
        "editProfile"
      );
    };

  /*
   * GET QUEST PROGRESS
   */
  const getQuestProgress =
    async (
      quest: Quest
    ): Promise<QuestProgress | null> => {
      const user =
        auth.currentUser;

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

      const snapshot =
        await getDoc(
          questRef
        );

      if (!snapshot.exists()) {
        return null;
      }

      const data =
        snapshot.data();

      return {
        questId: quest.id,

        status:
          data.status ===
          "completed"
            ? "completed"
            : "active",

        currentStep:
          typeof data.currentStep ===
          "number"
            ? data.currentStep
            : 1,

        completedSteps:
          Array.isArray(
            data.completedSteps
          )
            ? data.completedSteps
            : [],

        startedAt:
          data.startedAt instanceof
          Timestamp
            ? data.startedAt
            : null,

        selectedTrail:
          typeof data.selectedTrail ===
          "string"
            ? data.selectedTrail
            : null,

        driveStatus:
          data.driveStatus ===
            "driving" ||
          data.driveStatus ===
            "stopped"
            ? data.driveStatus
            : "ready",

        driveStartedAt:
          data.driveStartedAt instanceof
          Timestamp
            ? data.driveStartedAt
            : null,

        driveStoppedAt:
          data.driveStoppedAt instanceof
          Timestamp
            ? data.driveStoppedAt
            : null,

        proofPhotoURL:
          typeof data.proofPhotoURL ===
          "string"
            ? data.proofPhotoURL
            : null,

        completedAt:
          data.completedAt instanceof
          Timestamp
            ? data.completedAt
            : null,
      };
    };

  /*
   * OPEN QUEST DETAILS
   */
  const openQuestDetails =
    async (quest: Quest) => {
      setSelectedQuest(
        quest
      );

      setSelectedQuestProgress(
        null
      );

      setScreen(
        "questDetails"
      );

      const user =
        auth.currentUser;

      if (!user) {
        return;
      }

      try {
        const progress =
          await getQuestProgress(
            quest
          );

        setSelectedQuestProgress(
          progress
        );
      } catch (error) {
        console.error(
          "Unable to load quest progress:",
          error
        );
      }
    };

  /*
   * START / CONTINUE QUEST
   */
  const startOrContinueQuest =
    async (quest: Quest) => {
      const user =
        auth.currentUser;

      if (!user) {
        setScreen("login");
        return;
      }

      if (isLoadingQuest) {
        return;
      }

      setIsLoadingQuest(
        true
      );

      try {
        let progress =
          await getQuestProgress(
            quest
          );

        if (
          progress &&
          progress.status ===
            "active"
        ) {
          setSelectedQuest(
            quest
          );

          setSelectedQuestProgress(
            progress
          );

          setScreen(
            "questTracker"
          );

          return;
        }

        const questRef = doc(
          db,
          "users",
          user.uid,
          "quests",
          quest.id
        );

        await setDoc(
          questRef,
          {
            questId:
              quest.id,

            status:
              "active",

            currentStep: 1,

            completedSteps:
              [],

            selectedTrail:
              null,

            driveStatus:
              "ready",

            driveStartedAt:
              null,

            driveStoppedAt:
              null,

            proofPhotoURL:
              null,

            startedAt:
              serverTimestamp(),

            completedAt:
              null,
          }
        );

        const newSnapshot =
          await getDoc(
            questRef
          );

        const newData =
          newSnapshot.data();

        progress = {
          questId:
            quest.id,

          status:
            "active",

          currentStep: 1,

          completedSteps:
            [],

          selectedTrail:
            null,

          driveStatus:
            "ready",

          driveStartedAt:
            null,

          driveStoppedAt:
            null,

          proofPhotoURL:
            null,

          startedAt:
            newData?.startedAt instanceof
            Timestamp
              ? newData.startedAt
              : Timestamp.now(),

          completedAt:
            null,
        };

        setSelectedQuest(
          quest
        );

        setSelectedQuestProgress(
          progress
        );

        setScreen(
          "questTracker"
        );
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
        setIsLoadingQuest(
          false
        );
      }
    };

  /*
   * SELECT TRAIL
   */
  const selectTrailForQuest =
    async (
      trailName: string
    ) => {
      const user =
        auth.currentUser;

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
          ).sort(
            (a, b) =>
              a - b
          );

        const updatedProgress: QuestProgress =
          {
            ...selectedQuestProgress,

            status:
              "active",

            currentStep:
              Math.max(
                2,
                selectedQuestProgress.currentStep
              ),

            completedSteps,

            selectedTrail:
              trailName,

            driveStatus:
              "ready",

            driveStartedAt:
              null,

            driveStoppedAt:
              null,
          };

        const questRef =
          doc(
            db,
            "users",
            user.uid,
            "quests",
            selectedQuest.id
          );

        await updateDoc(
          questRef,
          {
            currentStep:
              updatedProgress.currentStep,

            completedSteps:
              updatedProgress.completedSteps,

            selectedTrail:
              trailName,

            driveStatus:
              "ready",

            driveStartedAt:
              null,

            driveStoppedAt:
              null,
          }
        );

        setSelectedQuestProgress(
          updatedProgress
        );

        setScreen(
          "questTracker"
        );
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

  /*
   * QUEST COMPLETED
   */
  const handleQuestCompleted =
    (
      completedProgress: QuestProgress
    ) => {
      setSelectedQuestProgress(
        completedProgress
      );

      setScreen(
        "questCompletion"
      );
    };

  /*
   * STAMP ADDED
   */
  const handleStampAdded =
    (
      stamp: SavedPassportStamp
    ) => {
      setSelectedPassportStamp(
        stamp
      );

      setScreen(
        "stampDetails"
      );
    };

  /*
   * STAMP UPDATED
   */
  const handleStampUpdated =
    (
      stamp: SavedPassportStamp
    ) => {
      setSelectedPassportStamp(
        stamp
      );
    };

  /*
   * STAMP DETAILS BACK
   */
  const backToPassportFromStamp =
    () => {
      setScreen(
        "myPassport"
      );
    };

  /*
   * RENDER SCREEN
   */
  const renderScreen = () => {
    /*
     * SIGN UP
     */
    if (
      screen === "signup"
    ) {
      return (
        <SignUpScreen
          onBack={() =>
            setScreen(
              "login"
            )
          }
          onLogin={() =>
            setScreen(
              "landing"
            )
          }
        />
      );
    }

    /*
     * LANDING
     */
    if (
      screen === "landing"
    ) {
      return (
        <LandingScreen
          onExploreQuests={() =>
            setScreen(
              "home"
            )
          }
          onViewPassport={
            openPassport
          }
          onUpcomingExperiences={() =>
            openUpcomingExperiences(
              "landing"
            )
          }
        />
      );
    }

    /*
     * HOME
     */
    if (
      screen === "home"
    ) {
      return (
        <HomeScreen
          onPassport={
            openPassport
          }
          onAdventures={
            openAdventures
          }
          onProfile={
            openProfile
          }
          onQuestPress={
            openQuestDetails
          }
          onUpcomingExperiences={() =>
            openUpcomingExperiences(
              "home"
            )
          }
          onNotifications={
            openNotifications
          }
          notificationCount={
            unreadNotificationCount
          }
        />
      );
    }

    /*
     * NOTIFICATIONS
     */
    if (
      screen ===
      "notifications"
    ) {
      return (
        <NotificationsScreen
          notifications={
            notifications
          }
          onBack={() =>
            setScreen(
              "home"
            )
          }
          onMarkAllAsRead={
            markAllNotificationsAsRead
          }
          onNotificationPress={
            handleNotificationPress
          }
          onExplore={() =>
            setScreen(
              "home"
            )
          }
          onAdventures={
            openAdventures
          }
          onPassport={
            openPassport
          }
          onProfile={
            openProfile
          }
        />
      );
    }

    /*
     * MY ADVENTURES
     */
    if (
      screen ===
      "myAdventures"
    ) {
      return (
        <MyAdventuresScreen
          onExplore={() =>
            setScreen(
              "home"
            )
          }
          onPassport={
            openPassport
          }
          onProfile={
            openProfile
          }
          onUpcomingExperiences={() =>
            openUpcomingExperiences(
              "myAdventures"
            )
          }
          onQuestPress={
            openQuestDetails
          }
        />
      );
    }

    /*
     * UPCOMING EXPERIENCES
     */
    if (
      screen ===
      "upcomingExperiences"
    ) {
      return (
        <UpcomingExperiencesScreen
          onBack={() =>
            setScreen(
              upcomingExperiencesBackScreen
            )
          }
          onExplore={() =>
            setScreen(
              "home"
            )
          }
          onAdventures={
            openAdventures
          }
          onPassport={
            openPassport
          }
          onProfile={
            openProfile
          }
          onExperiencePress={
            openExperienceDetails
          }
        />
      );
    }

    /*
     * EXPERIENCE DETAILS
     */
    if (
      screen ===
        "experienceDetails" &&
      selectedExperience
    ) {
      return (
        <ExperienceDetailsScreen
          experience={
            selectedExperience
          }
          onBack={() =>
            setScreen(
              experienceDetailsBackScreen
            )
          }
          onExplore={() =>
            setScreen(
              "home"
            )
          }
          onAdventures={
            openAdventures
          }
          onPassport={
            openPassport
          }
          onProfile={
            openProfile
          }
        />
      );
    }

    /*
     * QUEST DETAILS
     */
    if (
      screen ===
        "questDetails" &&
      selectedQuest
    ) {
      return (
        <QuestDetailsScreen
          quest={
            selectedQuest
          }
          isActive={
            selectedQuestProgress?.status ===
            "active"
          }
          onBack={() =>
            setScreen(
              "home"
            )
          }
          onExplore={() =>
            setScreen(
              "home"
            )
          }
          onPassport={
            openPassport
          }
          onStart={
            startOrContinueQuest
          }
          onAdventures={
            openAdventures
          }
        />
      );
    }

    /*
     * QUEST TRACKER
     */
    if (
      screen ===
        "questTracker" &&
      selectedQuest &&
      selectedQuestProgress
    ) {
      return (
        <QuestTrackerScreen
          quest={
            selectedQuest
          }
          progress={
            selectedQuestProgress
          }
          onProgressChange={
            setSelectedQuestProgress
          }
          onQuestCompleted={
            handleQuestCompleted
          }
          onBackToExplore={() =>
            setScreen(
              "home"
            )
          }
          onPassport={
            openPassport
          }
          onFindTrail={() =>
            setScreen(
              "hibernate"
            )
          }
          onAbandon={() => {
            setSelectedQuestProgress(
              null
            );

            setScreen(
              "home"
            );
          }}
        />
      );
    }

    /*
     * QUEST COMPLETION
     */
    if (
      screen ===
        "questCompletion" &&
      selectedQuest &&
      selectedQuestProgress
    ) {
      return (
        <QuestCompletionScreen
          quest={
            selectedQuest
          }
          progress={
            selectedQuestProgress
          }
          onExplore={() =>
            setScreen(
              "home"
            )
          }
          onAdventures={
            openAdventures
          }
          onPassport={
            openPassport
          }
          onStampAdded={
            handleStampAdded
          }
        />
      );
    }

    /*
     * STAMP DETAILS
     */
    if (
      screen ===
        "stampDetails" &&
      selectedPassportStamp
    ) {
      return (
        <StampDetailsScreen
          stamp={
            selectedPassportStamp
          }
          onBack={
            backToPassportFromStamp
          }
          onExplore={() =>
            setScreen(
              "home"
            )
          }
          onAdventures={
            openAdventures
          }
          onPassport={() =>
            setScreen(
              "myPassport"
            )
          }
          onProfile={
            openProfile
          }
          onStampUpdated={
            handleStampUpdated
          }
        />
      );
    }

    /*
     * HIBERNATE
     */
    if (
      screen ===
        "hibernate" &&
      selectedQuest &&
      selectedQuestProgress
    ) {
      return (
        <HibernateScreen
          onBack={() =>
            setScreen(
              "questTracker"
            )
          }
          onTrailSelected={
            selectTrailForQuest
          }
          onExplore={() =>
            setScreen(
              "home"
            )
          }
          onAdventures={
            openAdventures
          }
          onPassport={
            openPassport
          }
        />
      );
    }

    /*
     * CREATE PASSPORT
     */
    if (
      screen ===
      "createPassport"
    ) {
      return (
        <CreatePassportScreen
          onBack={() =>
            setScreen(
              "myProfile"
            )
          }
          onExplore={() =>
            setScreen(
              "home"
            )
          }
          onCreatePassport={() =>
            setScreen(
              "myPassport"
            )
          }
        />
      );
    }

    /*
     * MY PASSPORT
     */
    if (
      screen ===
      "myPassport"
    ) {
      return (
        <MyPassportScreen
          onBack={() =>
            setScreen(
              "myProfile"
            )
          }
          onExplore={() =>
            setScreen(
              "home"
            )
          }
          onAdventures={
            openAdventures
          }
          onProfile={
            openProfile
          }
        />
      );
    }

    /*
     * EDIT PROFILE
     */
    if (
      screen ===
      "editProfile"
    ) {
      return (
        <EditProfileScreen
          onBack={() =>
            setScreen(
              "myProfile"
            )
          }
          onSaved={() =>
            setScreen(
              "myProfile"
            )
          }
        />
      );
    }

    /*
     * MY PROFILE
     */
    if (
      screen ===
      "myProfile"
    ) {
      return (
        <MyProfileScreen
          onExplore={() =>
            setScreen(
              "home"
            )
          }
          onAdventures={
            openAdventures
          }
          onPassport={
            openPassport
          }
          onCreatePassport={() =>
            setScreen(
              "createPassport"
            )
          }
          onEditProfile={
            openEditProfile
          }
          onSignOut={() => {
            setSelectedQuest(
              null
            );

            setSelectedQuestProgress(
              null
            );

            setSelectedPassportStamp(
              null
            );

            setSelectedExperience(
              null
            );

            setScreen(
              "login"
            );
          }}
        />
      );
    }

    /*
     * LOGIN
     */
    return (
      <LoginScreen
        onSignUp={() =>
          setScreen(
            "signup"
          )
        }
        onLogin={() =>
          setScreen(
            "landing"
          )
        }
      />
    );
  };

  /*
   * GLOBAL LOADING
   */
  if (
    isCheckingPassport ||
    isLoadingQuest ||
    isOpeningNotification
  ) {
    return (
      <SafeAreaProvider>
        <StatusBar
          style="dark"
        />

        <View
          style={
            styles.loading
          }
        >
          <ActivityIndicator
            color={
              colors.green
            }
          />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar
        style="dark"
      />

      {renderScreen()}
    </SafeAreaProvider>
  );
}

const styles =
  StyleSheet.create({
    loading: {
      flex: 1,
      alignItems:
        "center",
      justifyContent:
        "center",
      backgroundColor:
        colors.background,
    },
  });