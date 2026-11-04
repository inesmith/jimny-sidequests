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
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { isRegistrationInProgress } from "./src/services/registrationState";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import {
  collection,
  doc,
  getDocs,
  runTransaction,
  getDoc,
  getDocFromServer,
  serverTimestamp,
  getDocsFromServer,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";


import EditProfileScreen from "./src/screens/EditProfileScreen";
import LoginScreen from "./src/screens/LoginScreen";
import SignUpScreen from "./src/screens/SignUpScreen";
import LandingScreen from "./src/screens/LandingScreen";
import MyExperiencesScreen from "./src/screens/MyExperiencesScreen";
import HomeScreen, {
  type Quest,
} from "./src/screens/HomeScreen";

import NotificationsScreen, {
  type NotificationItem,
} from "./src/screens/NotificationsScreen";

import MyAdventuresScreen from "./src/screens/MyAdventuresScreen";
import UpcomingExperiencesScreen from "./src/screens/UpcomingExperiencesScreen";

import { waveBack } from "./src/services/nearbyJimnys";

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
import { quests, allQuests } from "./src/data/quests";

type Screen =
  | "login"
  | "signup"
  | "landing"
  | "home"
  | "notifications"
  | "myAdventures"
  | "adventures"
  | "upcomingExperiences"
  | "experienceDetails"
  | "questDetails"
  | "questTracker"
  | "questCompletion"
  | "stampDetails"
  | "hibernate"
  | "createPassport"
  | "editPassport"
  | "myPassport"
  | "myProfile"
  | "editProfile"
  | "myExperiences";

type UpcomingExperiencesOrigin =
  | "home"
  | "myAdventures";

type ExperienceDetailsOrigin =
  | "upcomingExperiences"
  | "notifications"
  | "myExperiences";

export default function App() {
  const [screen, setScreen] =
    useState<Screen>("landing");

  const [passportOpenedFromProfile, setPassportOpenedFromProfile] = useState(false);
  const [stampDetailsBackScreen, setStampDetailsBackScreen] = useState<"myPassport" | "myAdventures">("myPassport");
  const [canEditNewStampMemory, setCanEditNewStampMemory] = useState(false);

  const [questDetailsBackScreen, setQuestDetailsBackScreen] =
    useState<"home" | "myAdventures">("home");

  /*
   * AUTH STARTUP
   *
   * LandingScreen is now our startup
   * screen while Firebase restores the
   * saved authentication session.
   */
  const [
    isCheckingAuth,
    setIsCheckingAuth,
  ] = useState(true);

  /*
   * SMALL LANDING DISPLAY TIME
   *
   * This gives the branded startup
   * screen enough time to be visible
   * instead of flashing past instantly.
   */
  const [
    hasMinimumLandingTimePassed,
    setHasMinimumLandingTimePassed,
  ] = useState(false);

  const [
    initialUserAuthenticated,
    setInitialUserAuthenticated,
  ] = useState<boolean | null>(
    null
  );

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

  const [monthlyQuests, setMonthlyQuests] = useState<Quest[]>([]);
  const [isLoadingMonthlyQuests, setIsLoadingMonthlyQuests] = useState(true);

  // Each user receives a stable, Firestore-backed selection per calendar month.
  // Completed quests are filtered out immediately and never reselected.
  useEffect(() => {
    if (screen !== "home") return;
    const user = auth.currentUser;
    if (!user) {
      setMonthlyQuests([]);
      setIsLoadingMonthlyQuests(false);
      return;
    }
    let cancelled = false;
    setIsLoadingMonthlyQuests(true);
    const load = async () => {
      try {
        const now = new Date();
        const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const progress = await getDocs(collection(db, "users", user.uid, "quests"));
        const completed = new Set<string>();
        progress.forEach((item) => {
          if (item.data().status === "completed") completed.add(item.id);
        });
        const selectionRef = doc(db, "users", user.uid, "monthlyQuestSelections", month);
        const ids = await runTransaction(db, async (transaction) => {
          const existing = await transaction.get(selectionRef);
          if (existing.exists()) {
            const saved = existing.data().questIds;
            return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : [];
          }
          const eligible = quests.filter((quest) => !completed.has(quest.id));
          const shuffled = [...eligible];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          const selected = shuffled.slice(0, 2).map((quest) => quest.id);
          transaction.set(selectionRef, { questIds: selected, month, createdAt: serverTimestamp() });
          return selected;
        });
        if (!cancelled) setMonthlyQuests(ids.filter((id) => !completed.has(id)).map((id) => quests.find((quest) => quest.id === id)).filter((quest): quest is Quest => Boolean(quest)));
      } catch (error) {
        console.error("Unable to load monthly quests:", error);
        if (!cancelled) setMonthlyQuests([]);
      } finally {
        if (!cancelled) setIsLoadingMonthlyQuests(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [screen]);

  const [fontsLoaded] =
    useFonts({
      Inter_400Regular,
      Inter_400Regular_Italic,
      Inter_500Medium,
      Inter_600SemiBold,
      Inter_800ExtraBold,
    });

  /*
   * MINIMUM LANDING DISPLAY TIME
   */
  useEffect(() => {
    const timer = setTimeout(
      () => {
        setHasMinimumLandingTimePassed(
          true
        );
      },
      1600
    );

    return () =>
      clearTimeout(timer);
  }, []);

  /*
   * RESTORE SAVED LOGIN
   */
  useEffect(() => {
  let cancelled = false;
  let hasResolvedInitialAuth = false;

  const unsubscribe = onAuthStateChanged(
    auth,
    async (user) => {
      if (!user) {
        if (!hasResolvedInitialAuth) {
          hasResolvedInitialAuth = true;
          setInitialUserAuthenticated(false);
          setIsCheckingAuth(false);
        } else if (!cancelled) {
          setScreen("login");
        }
        return;
      }

      try {
        const accountSnapshot = await getDocFromServer(
          doc(db, "privateUserData", user.uid)
        );

        if (cancelled || auth.currentUser?.uid !== user.uid) {
          return;
        }

        // Fail closed: a missing registration record is not an active member.
        const status = accountSnapshot.exists()
          ? accountSnapshot.data().accountStatus
          : null;

        const isActive = status === "active";

        if (status === "deletionPending") {
          await signOut(auth);

          if (!hasResolvedInitialAuth) {
            hasResolvedInitialAuth = true;
            setInitialUserAuthenticated(false);
            setIsCheckingAuth(false);
          }

          setScreen("login");
          return;
        }

        if (!isActive && !isRegistrationInProgress()) {
  // Never allow an inactive or incomplete account into the app.
  // Keep deactivated accounts signed in so they can reactivate.
  setScreen("login");
}

        if (!hasResolvedInitialAuth) {
          hasResolvedInitialAuth = true;
          setInitialUserAuthenticated(isActive);
          setIsCheckingAuth(false);
        } else if (!isActive && !isRegistrationInProgress()) {
  setScreen("login");
}
      } catch (error) {
        console.error("Unable to verify account status:", error);

        if (!cancelled) {
          await signOut(auth);

          if (!hasResolvedInitialAuth) {
            hasResolvedInitialAuth = true;
            setInitialUserAuthenticated(false);
            setIsCheckingAuth(false);
          } else {
            setScreen("login");
          }
        }
      }
    },
    (error) => {
      console.error("Unable to restore authentication:", error);

      if (!cancelled) {
        if (!hasResolvedInitialAuth) {
          hasResolvedInitialAuth = true;
          setInitialUserAuthenticated(false);
          setIsCheckingAuth(false);
        } else {
          setScreen("login");
        }
      }
    }
  );

  return () => {
    cancelled = true;
    unsubscribe();
  };
}, []);

  /*
   * LEAVE STARTUP LANDING
   *
   * We wait for:
   * 1. Firebase auth restoration
   * 2. Fonts
   * 3. Minimum landing display time
   *
   * Returning user -> Explore
   * Logged-out user -> Login
   */
  useEffect(() => {
    if (
      isCheckingAuth ||
      !fontsLoaded ||
      !hasMinimumLandingTimePassed ||
      initialUserAuthenticated ===
        null
    ) {
      return;
    }

    if (
      initialUserAuthenticated
    ) {
      setScreen("home");
    } else {
      setScreen("login");
    }
  }, [
    fontsLoaded,
    hasMinimumLandingTimePassed,
    initialUserAuthenticated,
    isCheckingAuth,
  ]);

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
    respondToInvite,
  } = useNotifications();

  /*
   * STARTUP LANDING
   */
  if (
    isCheckingAuth ||
    !fontsLoaded ||
    !hasMinimumLandingTimePassed
  ) {
    return (
      <SafeAreaProvider>
        <StatusBar
          style="dark"
        />

        <LandingScreen />
      </SafeAreaProvider>
    );
  }

  /*
   * OPEN PASSPORT
   */
  const openPassport =
    async (fromProfile = false) => {
      setPassportOpenedFromProfile(fromProfile);
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
   * OPEN ADVENTURES TAB
   *
   * This is now the Hibernate screen:
   * Popular Locations + Jimny's Near You.
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
        "adventures"
      );
    };

  /*
   * OPEN MY ADVENTURES & STATS
   *
   * This is only accessed from
   * the Profile tools section.
   */
  const openMyAdventures =
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

        await markNotificationAsRead(
          backendNotification
        );

        if (backendNotification.type === "wave") {
        if (backendNotification.waveAccepted) {
          Alert.alert(
            "Jimny Friends! 🚙",
            "You're already friends with this Jimny owner."
          );
          return;
        }

        if (!backendNotification.senderId || !backendNotification.waveId) {
          Alert.alert(
            "Wave unavailable",
            "The Wave information is missing."
          );
          return;
        }

        const waveSnapshot = await getDoc(
          doc(db, "waves", backendNotification.waveId)
        );

        if (waveSnapshot.exists() &&
            waveSnapshot.data().status === "friends") {
          Alert.alert(
            "Jimny Friends! 🚙",
            "You're already friends with this Jimny owner."
          );
          return;
        }

        await waveBack(backendNotification.senderId);

        Alert.alert(
          "Wave sent back! 👋",
          "You're now Jimny friends!"
        );

        return;
    }

        /*
         * EXPERIENCE / EVENT UPDATE
         */
        if (
          backendNotification.type === "experience" ||
          backendNotification.type === "eventUpdate" ||
          backendNotification.type === "invite"
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
      setQuestDetailsBackScreen(screen === "myAdventures" ? "myAdventures" : "home");
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
      setMonthlyQuests((current) => current.filter((quest) => quest.id !== completedProgress.questId));

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
      setStampDetailsBackScreen("myPassport");
      setCanEditNewStampMemory(true);

      setScreen(
        "stampDetails"
      );
    };

  /*
   * OPEN AN EARNED STAMP FROM PASSPORT OR COMPLETED ADVENTURES
   */
  const openEarnedStamp = async (
    questId: string,
    origin: "myPassport" | "myAdventures"
  ) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      const [passportSnapshot, questSnapshot] = await Promise.all([
        getDoc(doc(db, "passports", user.uid)),
        getDoc(doc(db, "users", user.uid, "quests", questId)),
      ]);
      const passportStamps = passportSnapshot.exists() && Array.isArray(passportSnapshot.data().stamps)
        ? passportSnapshot.data().stamps as SavedPassportStamp[]
        : [];
      const savedStamp = passportStamps.find((item) => item.questId === questId || item.id === questId);
      if (!savedStamp) {
        Alert.alert("Stamp not found", "This Side Quest has not been added to your passport yet.");
        return;
      }
      const quest = allQuests.find((item) => item.id === questId);
      const questData = questSnapshot.exists() ? questSnapshot.data() : null;
      const completeStamp: SavedPassportStamp = {
        ...savedStamp,
        id: savedStamp.id || questId,
        questId,
        name: savedStamp.name || quest?.title || "Side Quest",
        title: savedStamp.title || quest?.stampTitle || quest?.title || "Stamp",
        earnedAt: savedStamp.earnedAt ?? (questData?.completedAt instanceof Timestamp ? questData.completedAt : Timestamp.now()),
        adventureMemory: savedStamp.adventureMemory ?? "",
        driveStartedAt: savedStamp.driveStartedAt ?? null,
        driveStoppedAt: savedStamp.driveStoppedAt ?? null,
        proofPhotoURL: savedStamp.proofPhotoURL ?? null,
        selectedTrail: savedStamp.selectedTrail ?? null,
      };
      setSelectedPassportStamp(completeStamp);
      setCanEditNewStampMemory(false);
      setStampDetailsBackScreen(origin);
      setScreen("stampDetails");
    } catch (error) {
      console.error("Unable to open earned stamp:", error);
      Alert.alert("Unable to open stamp", "Please try again.");
    }
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
      setScreen(stampDetailsBackScreen);
    };

  /*
   * RENDER SCREEN
   */
  const renderScreen = () => {
    if (screen !== "login" && screen !== "signup" && screen !== "landing" && !auth.currentUser) {
      return <LoginScreen onSignUp={() => setScreen("signup")} onLogin={async () => {
          const user = auth.currentUser;
          if (!user) return;
          try {
            const account = await getDocFromServer(doc(db, "privateUserData", user.uid));
            if (auth.currentUser?.uid !== user.uid) return;
            if (account.exists() && account.data().accountStatus === "active") {
              setScreen("home");
            } else {
              if (account.data()?.accountStatus !== "deactivated") await signOut(auth);
              Alert.alert("Account unavailable", "Your account is not active yet.");
            }
          } catch (error) {
            console.error("Unable to verify account before navigation:", error);
            await signOut(auth);
            Alert.alert("Unable to verify account", "Please check your connection and try again.");
          }
        }} />;
    }

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
              "login"
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
        <LandingScreen />
      );
    }

    /*
     * HOME / EXPLORE
     */
    if (
      screen === "home"
    ) {
      return (
        <HomeScreen
          availableQuests={monthlyQuests}
          isLoadingMonthlyQuests={isLoadingMonthlyQuests}
          onPassport={
            () => openPassport(false)
          }
          onAdventures={() => setScreen("adventures")}
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
     * ADVENTURES TAB
     *
     * Popular Locations +
     * Jimny's Near You.
     */
    if (
      screen ===
      "adventures"
    ) {
      return (
        <HibernateScreen
          mode="adventures"
          onExplore={() =>
            setScreen(
              "home"
            )
          }
          onAdventures={
            openAdventures
          }
          onPassport={
            () => openPassport(false)
          }
          onProfile={
            openProfile
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
          onRSVP={async (notification, response) => {
            try {
              await respondToInvite(notification as BackendNotificationItem, response);
              await markNotificationAsRead(notification as BackendNotificationItem);
            } catch (error) {
              console.error("Unable to respond to invitation:", error);
              Alert.alert("RSVP failed", "Please try again.");
            }
          }}
          onExplore={() =>
            setScreen(
              "home"
            )
          }
          onAdventures={
            openAdventures
          }
          onPassport={
            () => openPassport(false)
          }
          onProfile={
            openProfile
          }
        />
      );
    }

    /*
     * MY ADVENTURES & STATS
     *
     * Only reached from Profile.
     */
    if (
      screen ===
      "myAdventures"
    ) {
      return (
        <MyAdventuresScreen
          onBack={openProfile}
          onHibernate={openAdventures}
          onExplore={() =>
            setScreen(
              "home"
            )
          }
          onPassport={
            () => openPassport(false)
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
          onCompletedQuestPress={(quest) => openEarnedStamp(quest.id, "myAdventures")}
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
            () => openPassport(false)
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
            () => openPassport(false)
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
          onBack={() => setScreen(questDetailsBackScreen)}
          onExplore={() =>
            setScreen(
              "home"
            )
          }
          onPassport={
            () => openPassport(false)
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
            () => openPassport(false)
          }
          onAdventures={
            openAdventures
          }
          onProfile={
            openProfile
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
            () => openPassport(false)
          }
          onProfile={
            openProfile
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
          allowMemoryEditing={canEditNewStampMemory}
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
          onPassport={() => {
            setPassportOpenedFromProfile(false);
            setScreen("myPassport");
          }}
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
     * HIBERNATE — QUEST MODE
     *
     * This is only used when the
     * active quest asks the user
     * to find/select a trail.
     */
    if (
      screen ===
        "hibernate" &&
      selectedQuest &&
      selectedQuestProgress
    ) {
      return (
        <HibernateScreen
          mode="quest"
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
            () => openPassport(false)
          }
          onProfile={
            openProfile
          }
        />
      );
    }

    /*
     * CREATE PASSPORT
     */
    if (
      screen === "createPassport" || screen === "editPassport"
    ) {
      return (
        <CreatePassportScreen
          onAdventures={openAdventures}
          onProfile={openProfile}
          editMode={screen === "editPassport"}
          onBack={() => setScreen(screen === "editPassport" ? "myPassport" : "myProfile")}
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
          onEditPassport={() => setScreen("editPassport")}
          onStampPress={(questId) => openEarnedStamp(questId, "myPassport")}
          showBackButton={passportOpenedFromProfile}
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

    if (screen === "myExperiences") {
      return (
        <MyExperiencesScreen
          onBack={() => setScreen("myProfile")}
          onExperiencePress={(experience) => {
            setSelectedExperience(experience);
            setExperienceDetailsBackScreen("myExperiences");
            setScreen("experienceDetails");
          }}
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

  onAdventures={openAdventures}

  onMyAdventures={
    openMyAdventures
  }

          onMyExperiences={() => setScreen("myExperiences")}

          onPassport={() => openPassport(true)}
          onCreatePassport={() => {
            setPassportOpenedFromProfile(true);
            setScreen("createPassport");
          }}
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
        onLogin={async () => {
          const user = auth.currentUser;
          if (!user) return;
          try {
            const account = await getDocFromServer(doc(db, "privateUserData", user.uid));
            if (auth.currentUser?.uid !== user.uid) return;
            if (account.exists() && account.data().accountStatus === "active") {
              setScreen("home");
            } else {
              if (account.data()?.accountStatus !== "deactivated") await signOut(auth);
              Alert.alert("Account unavailable", "Your account is not active yet.");
            }
          } catch (error) {
            console.error("Unable to verify account before navigation:", error);
            await signOut(auth);
            Alert.alert("Unable to verify account", "Please check your connection and try again.");
          }
        }}
      />
    );
  };

    const handleSwipeBack = () => {
    switch (screen) {
      case "notifications":
        setScreen("home");
        break;

      case "questDetails":
        setScreen(questDetailsBackScreen);
        break;

      case "stampDetails":
        setScreen(stampDetailsBackScreen);
        break;

      case "questTracker":
        setScreen("questDetails");
        break;

      case "upcomingExperiences":
        setScreen(upcomingExperiencesBackScreen);
        break;

      case "experienceDetails":
        setScreen(experienceDetailsBackScreen);
        break;

      case "myAdventures":
      case "myExperiences":
      case "editProfile":
      case "createPassport":
        setScreen("myProfile");
        break;

      case "myPassport":
        if (passportOpenedFromProfile) setScreen("myProfile");
        break;

      case "editPassport":
        setScreen("myPassport");
        break;

      default:
        break;
    }
  };

    const swipeBackEnabled = [
    "notifications",
    "questDetails",
    "questTracker",
    "stampDetails",
    "upcomingExperiences",
    "experienceDetails",
    "myAdventures",
    "myExperiences",
    "editProfile",
    "createPassport",
    "editPassport",
  ].includes(screen) || (screen === "myPassport" && passportOpenedFromProfile);

    const swipeBackGesture = Gesture.Pan()
    .enabled(swipeBackEnabled)
    .hitSlop({ left: 0, width: 40 })
    .runOnJS(true)
    .activeOffsetX(20)
    .failOffsetY([-25, 25])
    .onEnd((event) => {
      if (event.translationX > 65 && Math.abs(event.translationY) < 80) {
        handleSwipeBack();
      }
    });

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
  <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <StatusBar style="dark" />

      <GestureDetector gesture={swipeBackGesture}>
        <View style={{ flex: 1 }}>
          {renderScreen()}
        </View>
      </GestureDetector>
    </SafeAreaProvider>
  </GestureHandlerRootView>
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