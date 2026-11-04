
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import BottomNav from "../components/BottomNav";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  Timestamp,
} from "firebase/firestore";

import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  signOut,
} from "firebase/auth";

import { getFunctions, httpsCallable } from "firebase/functions";
import { getApp } from "firebase/app";

import { auth, db } from "../firebase/firebase";
import { colors, fonts } from "../theme/theme";

type MyProfileScreenProps = {
  onExplore: () => void;
  onAdventures: () => void;
  onMyAdventures: () => void;
  onMyExperiences: () => void;
  onPassport: () => void;
  onCreatePassport: () => void;
  onEditProfile: () => void;
  onSignOut: () => void;
};

type UserProfile = {
  uid?: string;
  fullName?: string;
  profilePhotoURL?: string | null;
  createdAt?: Timestamp | null;
};

type PrivateUserData = {
  email?: string | null;
  phone?: string | null;
  homeLocation?: {
    placeId?: string;
    formattedAddress?: string;
  } | null;
  createdAt?: Timestamp | null;
};

type PassportVehicle = {
  make?: string;
  model?: string;
  year?: number;
  colour?: string;
  nickname?: string | null;
  photoURL?: string | null;
};

type PassportData = {
  passportNumber?: string;
  vehicle?: PassportVehicle;
  stamps?: unknown[];
  stampCount?: number;
  createdAt?: Timestamp | null;
};

type AccountAction = "deactivate" | "delete" | null;

const accountFunctions = getFunctions(
  getApp(),
  "africa-south1"
);

export default function MyProfileScreen({
  onExplore,
  onAdventures,
  onMyAdventures,
  onMyExperiences,
  onPassport,
  onCreatePassport,
  onEditProfile,
  onSignOut,
}: MyProfileScreenProps) {
  const [availableHeight, setAvailableHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);

  const contentScale =
    availableHeight > 0 && contentHeight > 0
      ? Math.min(1, availableHeight / contentHeight)
      : 1;

  const handleAvailableLayout = (event: LayoutChangeEvent) => {
    setAvailableHeight(event.nativeEvent.layout.height);
  };

  const handleContentLayout = (event: LayoutChangeEvent) => {
    setContentHeight(event.nativeEvent.layout.height);
  };

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [privateData, setPrivateData] = useState<PrivateUserData | null>(null);
  const [passport, setPassport] = useState<PassportData | null>(null);
  const [hasPassport, setHasPassport] = useState(false);
  const [completedQuestCount, setCompletedQuestCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  /*
   * ACCOUNT ACTIONS
   */
  const [accountAction, setAccountAction] =
    useState<AccountAction>(null);

  const [accountPassword, setAccountPassword] = useState("");
  const [showAccountPassword, setShowAccountPassword] =
    useState(false);

  const [deleteAcknowledged, setDeleteAcknowledged] =
    useState(false);

  const [isProcessingAccount, setIsProcessingAccount] =
    useState(false);

  const openAccountAction = (action: AccountAction) => {
    if (isProcessingAccount) return;

    setAccountPassword("");
    setShowAccountPassword(false);
    setDeleteAcknowledged(false);
    setAccountAction(action);
  };

  const closeAccountAction = () => {
    if (isProcessingAccount) return;

    setAccountAction(null);
    setAccountPassword("");
    setShowAccountPassword(false);
    setDeleteAcknowledged(false);
  };

  const handleAccountAction = async () => {
    if (!accountAction || isProcessingAccount) return;

    // Permanent deletion is not yet operational on the backend.
    // Do not enqueue a deletion job or claim that deletion completed.
    if (accountAction === "delete") {
      Alert.alert(
        "Account deletion unavailable",
        "Permanent account deletion is temporarily unavailable. Please contact support for assistance."
      );
      return;
    }

    const action = accountAction;

    if (!accountPassword) {
      Alert.alert(
        "Password required",
        "Please enter your current password to continue."
      );
      return;
    }

    const user = auth.currentUser;

    if (!user || !user.email) {
      Alert.alert(
        "Account unavailable",
        "Please log in again before continuing."
      );
      return;
    }

    const finalTitle =
      action === "deactivate"
        ? "Deactivate your account?"
        : "Permanently delete your account?";

    const finalMessage =
      action === "deactivate"
        ? "Your profile will be hidden and you will be signed out. Your Adventure Passport, stamps and progress will be saved. You can reactivate your account by logging in again."
        : "This action is permanent. Your account and associated information will be deleted. This cannot be undone.";

    Alert.alert(finalTitle, finalMessage, [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text:
          action === "deactivate"
            ? "Deactivate Account"
            : "Delete Forever",
        style: "destructive",
        onPress: async () => {
          setIsProcessingAccount(true);

          try {
            /*
             * VERIFY CURRENT PASSWORD
             */
            const credential = EmailAuthProvider.credential(
              user.email!,
              accountPassword
            );

            await reauthenticateWithCredential(
              user,
              credential
            );

            await user.getIdToken(true);

            /*
             * CALL SECURE FIREBASE BACKEND
             *
             * These functions must be deployed
             * before account actions can succeed.
             */
            const functionName =
              action === "deactivate"
                ? "deactivateMyAccount"
                : "deleteMyAccount";

            const accountFunction = httpsCallable(
              accountFunctions,
              functionName
            );

            await accountFunction();

            /*
             * DEACTIVATION:
             * Sign out after backend success.
             *
             * DELETION:
             * The backend may already have
             * deleted the Firebase Auth user.
             * Signing out clears the local session.
             */
            try {
              await signOut(auth);
            } catch (signOutError) {
              console.warn(
                "Unable to clear local session:",
                signOutError
              );
            }

            setAccountPassword("");
            setAccountAction(null);
            onSignOut();

            if (action === "deactivate") {
              Alert.alert(
                "Account deactivated",
                "Your account has been deactivated. You can reactivate it when you log in again."
              );
            } else {
              Alert.alert(
                "Account deletion completed",
                "Your account deletion request has been completed."
              );
            }
          } catch (error: any) {
            console.error(
              "Account action failed:",
              error
            );

            let message =
              "We couldn't complete this request. Please try again.";

            switch (error?.code) {
              case "auth/invalid-credential":
              case "auth/wrong-password":
              case "auth/invalid-login-credentials":
                message =
                  "The password you entered is incorrect. Please try again.";
                break;

              case "auth/too-many-requests":
                message =
                  "Too many attempts were made. Please wait a while and try again.";
                break;

              case "auth/network-request-failed":
              case "functions/unavailable":
                message =
                  "We couldn't connect to Firebase. Please check your internet connection.";
                break;

              case "functions/not-found":
              case "functions/unimplemented":
                message =
                  "This account feature is not available yet. The Firebase backend still needs to be deployed.";
                break;

              case "functions/unauthenticated":
                message =
                  "Your session has expired. Please log in again.";
                break;

              case "functions/permission-denied":
                message =
                  "This account action could not be authorised.";
                break;

              default:
                if (
                  typeof error?.message === "string" &&
                  error.message.includes("not-found")
                ) {
                  message =
                    "The Firebase account function has not been deployed yet.";
                }
            }

            Alert.alert(
              "Unable to complete request",
              message
            );
          } finally {
            setIsProcessingAccount(false);
          }
        },
      },
    ]);
  };

  /*
   * LOAD PROFILE
   */
  useEffect(() => {
    const loadProfile = async () => {
      const user = auth.currentUser;

      if (!user) {
        setErrorMessage(
          "Please log in to view your profile."
        );
        setIsLoading(false);
        return;
      }

      try {
        const [
          userSnapshot,
          privateSnapshot,
          passportSnapshot,
          questSnapshot,
        ] = await Promise.all([
          getDoc(doc(db, "users", user.uid)),
          getDoc(doc(db, "privateUserData", user.uid)),
          getDoc(doc(db, "passports", user.uid)),
          getDocs(collection(db, "users", user.uid, "quests")),
        ]);

        if (userSnapshot.exists()) {
          setProfile(userSnapshot.data() as UserProfile);
        } else {
          setProfile({
            uid: user.uid,
            fullName: user.displayName ?? "",
            profilePhotoURL: user.photoURL ?? null,
          });
        }

        if (privateSnapshot.exists()) {
          setPrivateData(
            privateSnapshot.data() as PrivateUserData
          );
        } else {
          setPrivateData(null);
        }

        if (passportSnapshot.exists()) {
          setPassport(
            passportSnapshot.data() as PassportData
          );
          setHasPassport(true);
        } else {
          setPassport(null);
          setHasPassport(false);
        }

        let completed = 0;

        questSnapshot.forEach((questDocument) => {
          const questData = questDocument.data();

          if (questData.status === "completed") {
            completed += 1;
          }
        });

        setCompletedQuestCount(completed);
      } catch (error) {
        console.error(
          "Unable to load profile:",
          error
        );

        setErrorMessage(
          "We couldn't load your profile."
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, []);

  /*
   * PROFILE VALUES
   */
  const fullName =
    profile?.fullName?.trim() ||
    auth.currentUser?.displayName ||
    "Jimny Owner";

  const profilePhotoURL =
    profile?.profilePhotoURL ||
    auth.currentUser?.photoURL ||
    null;

  const initials = getInitials(fullName);

  const vehicle = passport?.vehicle;
  const vehicleNickname = vehicle?.nickname?.trim();

  const stampCount =
    passport?.stampCount ??
    passport?.stamps?.length ??
    0;

  const memberSince = formatMemberSince(
    profile?.createdAt ??
      privateData?.createdAt ??
      null
  );

  const vehicleDescription =
    hasPassport && vehicle
      ? [
          vehicle.make,
          vehicle.model,
          vehicle.year ? String(vehicle.year) : null,
        ]
          .filter(Boolean)
          .join(" ")
      : "";

  /*
   * SHARE PROFILE
   */
  const shareProfile = async () => {
    try {
      await Share.share({
        message: `${fullName} is part of the Jimny Side Quests owners network.`,
      });
    } catch (error) {
      console.error(
        "Unable to share profile:",
        error
      );
    }
  };

  /*
   * SIGN OUT
   */
  const handleSignOut = () => {
    Alert.alert(
      "Sign out?",
      "Are you sure you want to sign out?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            try {
              await signOut(auth);
              onSignOut();
            } catch (error) {
              console.error(
                "Unable to sign out:",
                error
              );

              Alert.alert(
                "Couldn't sign out",
                "Please try again."
              );
            }
          },
        },
      ]
    );
  };

  /*
   * THREE DOT MENU
   */
  const openAccountMenu = () => {
    Alert.alert(
      "Account",
      "Choose an option",
      [
        {
          text: "Share Profile",
          onPress: shareProfile,
        },
        {
          text: "Edit Account Profile",
          onPress: onEditProfile,
        },
        {
          text: "Sign Out",
          onPress: handleSignOut,
        },
        {
          text: "Deactivate Account",
          onPress: () =>
            openAccountAction("deactivate"),
        },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: () =>
            openAccountAction("delete"),
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ]
    );
  };

  /*
   * LOADING
   */
  if (isLoading) {
    return (
      <SafeAreaView
        style={styles.safeArea}
        edges={["top", "bottom"]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="small"
            color={colors.green}
          />
          <Text style={styles.loadingText}>
            Loading your profile...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /*
   * ERROR
   */
  if (!profile || errorMessage) {
    return (
      <SafeAreaView
        style={styles.safeArea}
        edges={["top", "bottom"]}
      >
        <View style={styles.errorContainer}>
          <MaterialIcons
            name="account-circle"
            size={48}
            color={colors.green}
          />

          <Text style={styles.errorTitle}>
            Profile unavailable
          </Text>

          <Text style={styles.errorBody}>
            {errorMessage}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top", "bottom"]}
    >
      <View style={styles.screen}>
        {/* HEADER */}
        <View style={styles.header}>
          <View style={styles.headerSide} />

          <Text style={styles.headerTitle}>
            My Profile
          </Text>

          <Pressable
            style={[
              styles.headerSide,
              styles.headerRight,
            ]}
            onPress={openAccountMenu}
            hitSlop={10}
          >
            <MaterialIcons
              name="more-horiz"
              size={25}
              color={colors.text}
            />
          </Pressable>
        </View>

        {/* PROFILE CONTENT */}
        <ScrollView
          style={styles.scrollView}
          onLayout={handleAvailableLayout}
          scrollEnabled={!hasPassport}
          showsVerticalScrollIndicator={false}
          bounces={!hasPassport}
          contentContainerStyle={
            !hasPassport
              ? styles.scrollContent
              : undefined
          }
        >
          <View
            onLayout={handleContentLayout}
            style={[
              styles.content,
              {
                transform: [
                  {
                    scale: hasPassport
                      ? contentScale
                      : 1,
                  },
                ],
                transformOrigin: "top center",
              },
            ]}
          >
            {/* PROFILE PHOTO */}
            <View style={styles.profilePhoto}>
              {profilePhotoURL ? (
                <Image
                  source={{
                    uri: profilePhotoURL,
                  }}
                  style={styles.profileImage}
                  resizeMode="cover"
                />
              ) : (
                <Text style={styles.initials}>
                  {initials}
                </Text>
              )}
            </View>

            {/* NAME */}
            <Text style={styles.profileName}>
              {fullName}
            </Text>

            {/* VEHICLE INFO */}
            {hasPassport && vehicleDescription ? (
              <View style={styles.vehicleLine}>
                <Text style={styles.vehicleText}>
                  {vehicleDescription}
                </Text>

                {vehicleNickname ? (
                  <>
                    <View style={styles.vehicleDot} />

                    <Text style={styles.vehicleNickname}>
                      "{vehicleNickname}"
                    </Text>
                  </>
                ) : null}
              </View>
            ) : hasPassport ? null : (
              <Text style={styles.noJimnyText}>
                Jimny details not added yet
              </Text>
            )}

            {/* NO PASSPORT ACCOUNT INFO */}
            {!hasPassport ? (
              <Text
                style={styles.locationText}
                numberOfLines={1}
              >
                {privateData?.homeLocation
                  ?.formattedAddress
                  ? "Home location added"
                  : "Home location not added"}{" "}
                · New member
              </Text>
            ) : null}

            {/* STATS */}
            <View style={styles.statsRow}>
              <StatCard
                value={String(completedQuestCount)}
                label="QUESTS DONE"
              />

              <StatCard
                value={String(stampCount)}
                label="STAMPS SECURED"
              />

              <StatCard
                value={
                  hasPassport
                    ? memberSince
                    : "Just started"
                }
                label={
                  hasPassport
                    ? "MEMBER SINCE"
                    : "JOURNEY"
                }
              />
            </View>

            {/* SECTION */}
            <Text style={styles.sectionTitle}>
              PASSPORT & TOOLS
            </Text>

            {hasPassport ? (
              <>
                <ToolButton
                  icon="menu-book"
                  title="View My Passport"
                  onPress={onPassport}
                />

                <ToolButton
                  icon="monitor-heart"
                  title="My Adventures & Stats"
                  onPress={onMyAdventures}
                />

                <ToolButton
                  icon="event"
                  title="My Experiences"
                  onPress={onMyExperiences}
                />

                <ToolButton
                  icon="settings"
                  title="Edit Account Profile"
                  onPress={onEditProfile}
                />
              </>
            ) : (
              <>
                {/* NO PASSPORT YET */}
                <View style={styles.passportStartCard}>
                  <View
                    style={styles.passportStartHeader}
                  >
                    <View
                      style={styles.passportIconBox}
                    >
                      <MaterialIcons
                        name="menu-book"
                        size={26}
                        color={colors.green}
                      />
                    </View>

                    <View
                      style={
                        styles.passportStartTitleWrap
                      }
                    >
                      <Text
                        style={
                          styles.passportStartTitle
                        }
                      >
                        Your passport starts here
                      </Text>

                      <Text
                        style={
                          styles.passportStartSubtitle
                        }
                      >
                        No Adventure Passport yet
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={styles.passportStartBody}
                  >
                    Give your Jimny an identity and a
                    place to collect every adventure
                    stamp. Add your details and photos
                    to create your digital booklet.
                  </Text>

                  <Text
                    style={styles.passportStartStrong}
                  >
                    Create it now — your first stamp
                    can come later.
                  </Text>

                  <Pressable
                    style={
                      styles.createPassportButton
                    }
                    onPress={onCreatePassport}
                  >
                    <Text
                      style={
                        styles.createPassportButtonText
                      }
                    >
                      CREATE PASSPORT
                    </Text>
                  </Pressable>
                </View>

                <ToolButton
                  icon="monitor-heart"
                  title="My Adventures & Stats"
                  onPress={onMyAdventures}
                />

                <ToolButton
                  icon="event"
                  title="My Experiences"
                  onPress={onMyExperiences}
                />

                <ToolButton
                  icon="settings"
                  title="Edit Profile"
                  onPress={onEditProfile}
                />
              </>
            )}
          </View>
        </ScrollView>

        {/* BOTTOM NAVIGATION */}
        <BottomNav
          selected="profile"
          onExplore={onExplore}
          onHibernate={onAdventures}
          onPassport={onPassport}
        />

        {/* ACCOUNT ACTION MODAL */}
        <Modal
          visible={accountAction !== null}
          transparent
          animationType="fade"
          onRequestClose={closeAccountAction}
        >
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={
              Platform.OS === "ios"
                ? "padding"
                : undefined
            }
          >
            <ScrollView
              contentContainerStyle={
                styles.modalScrollContent
              }
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.modalCard}>
                <View style={styles.modalIconContainer}>
                  <MaterialIcons
                    name={
                      accountAction === "delete"
                        ? "delete-outline"
                        : "pause-circle-outline"
                    }
                    size={36}
                    color={
                      accountAction === "delete"
                        ? colors.red
                        : colors.orange
                    }
                  />
                </View>

                <Text style={styles.modalTitle}>
                  {accountAction === "delete"
                    ? "Delete Account"
                    : "Deactivate Account"}
                </Text>

                <Text style={styles.modalDescription}>
                  {accountAction === "delete"
                    ? "Are you sure you want to permanently delete your Jimny Side Quests account?"
                    : "Are you sure you want to temporarily deactivate your Jimny Side Quests account?"}
                </Text>

                <View style={styles.warningBox}>
                  <MaterialIcons
                    name="info-outline"
                    size={20}
                    color={
                      accountAction === "delete"
                        ? colors.red
                        : colors.green
                    }
                  />

                  <Text style={styles.warningText}>
                    {accountAction === "delete"
                      ? "Your account and associated personal information will be permanently deleted. This action cannot be undone."
                      : "Your profile will be hidden from the community. Your Adventure Passport, stamps and progress will be saved. You can reactivate your account when you log in again."}
                  </Text>
                </View>

                <Text style={styles.passwordLabel}>
                  CURRENT PASSWORD
                </Text>

                <Text style={styles.passwordHelp}>
                  For your security, please enter your
                  current password to continue.
                </Text>

                <View style={styles.passwordContainer}>
                  <TextInput
                    value={accountPassword}
                    onChangeText={setAccountPassword}
                    placeholder="Enter your password"
                    placeholderTextColor={
                      colors.textSecondary
                    }
                    secureTextEntry={
                      !showAccountPassword
                    }
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="password"
                    style={styles.passwordInput}
                    editable={!isProcessingAccount}
                  />

                  <Pressable
                    onPress={() =>
                      setShowAccountPassword(
                        (current) => !current
                      )
                    }
                    disabled={isProcessingAccount}
                    style={styles.passwordEyeButton}
                    accessibilityRole="button"
                    accessibilityLabel={
                      showAccountPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    <MaterialIcons
                      name={
                        showAccountPassword
                          ? "visibility"
                          : "visibility-off"
                      }
                      size={21}
                      color={colors.textSecondary}
                    />
                  </Pressable>
                </View>

                {/* EXTRA DELETE CONFIRMATION */}
                {accountAction === "delete" ? (
                  <Pressable
                    style={styles.acknowledgeRow}
                    onPress={() =>
                      setDeleteAcknowledged(
                        (current) => !current
                      )
                    }
                    disabled={isProcessingAccount}
                  >
                    <MaterialIcons
                      name={
                        deleteAcknowledged
                          ? "check-box"
                          : "check-box-outline-blank"
                      }
                      size={24}
                      color={
                        deleteAcknowledged
                          ? colors.green
                          : colors.textSecondary
                      }
                    />

                    <Text
                      style={styles.acknowledgeText}
                    >
                      I understand that deleting my
                      account is permanent and cannot
                      be undone.
                    </Text>
                  </Pressable>
                ) : null}

                {/* CONFIRM BUTTON */}
                <Pressable
                  style={[
                    styles.confirmActionButton,
                    accountAction === "delete"
                      ? styles.deleteButton
                      : styles.deactivateButton,
                    (!accountPassword ||
                      isProcessingAccount ||
                      (accountAction === "delete" &&
                        !deleteAcknowledged)) &&
                      styles.disabledButton,
                  ]}
                  onPress={handleAccountAction}
                  disabled={
                    !accountPassword ||
                    isProcessingAccount ||
                    (accountAction === "delete" &&
                      !deleteAcknowledged)
                  }
                >
                  {isProcessingAccount ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.white}
                    />
                  ) : (
                    <Text
                      style={styles.confirmActionText}
                    >
                      {accountAction === "delete"
                        ? "DELETE ACCOUNT"
                        : "DEACTIVATE ACCOUNT"}
                    </Text>
                  )}
                </Pressable>

                {/* CANCEL */}
                <Pressable
                  style={styles.cancelActionButton}
                  onPress={closeAccountAction}
                  disabled={isProcessingAccount}
                >
                  <Text style={styles.cancelActionText}>
                    CANCEL
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </Modal>
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
        minimumFontScale={0.65}
      >
        {value}
      </Text>

      <Text
        style={styles.statLabel}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {label}
      </Text>
    </View>
  );
}

/*
 * TOOL BUTTON
 */
function ToolButton({
  icon,
  title,
  onPress,
}: {
  icon:
    | "menu-book"
    | "monitor-heart"
    | "settings"
    | "event";
  title: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.toolButton,
        pressed && styles.toolButtonPressed,
      ]}
      onPress={onPress}
    >
      <MaterialIcons
        name={icon}
        size={28}
        color={colors.text}
      />

      <Text style={styles.toolTitle}>
        {title}
      </Text>

      <MaterialIcons
        name="chevron-right"
        size={21}
        color={colors.textSecondary}
      />
    </Pressable>
  );
}

/*
 * INITIALS
 */
function getInitials(fullName: string) {
  const parts = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "JS";
  }

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${parts[0][0]}${
    parts[parts.length - 1][0]
  }`.toUpperCase();
}

/*
 * MEMBER SINCE
 */
function formatMemberSince(
  timestamp?: Timestamp | null
) {
  if (!timestamp) {
    return "00/00/00";
  }

  try {
    const date = timestamp.toDate();

    const day = String(
      date.getDate()
    ).padStart(2, "0");

    const month = String(
      date.getMonth() + 1
    ).padStart(2, "0");

    const year = String(
      date.getFullYear()
    ).slice(-2);

    return `${day}/${month}/${year}`;
  } catch {
    return "00/00/00";
  }
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

  /*
   * LOADING
   */
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },

  loadingText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },

  /*
   * ERROR
   */
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },

  errorTitle: {
    marginTop: 12,
    fontFamily: fonts.extraBold,
    fontSize: 19,
    color: colors.text,
  },

  errorBody: {
    marginTop: 7,
    textAlign: "center",
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },

  /*
   * HEADER
   */
  header: {
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
    backgroundColor: colors.background,
  },

  headerSide: {
    width: 72,
    flexDirection: "row",
    alignItems: "center",
  },

  headerRight: {
    justifyContent: "flex-end",
  },

  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontFamily: fonts.extraBold,
    fontSize: 16,
    lineHeight: 23,
    color: colors.red,
  },

  /*
   * CONTENT
   */
  scrollView: {
    flex: 1,
    overflow: "hidden",
  },

  scrollContent: {
    paddingBottom: 34,
  },

  content: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 20,
  },

  /*
   * PROFILE
   */
  profilePhoto: {
    width: 116,
    height: 116,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 58,
    borderWidth: 1.5,
    borderColor: colors.red,
    backgroundColor: colors.background,
  },

  profileImage: {
    width: "100%",
    height: "100%",
  },

  initials: {
    fontFamily: fonts.extraBold,
    fontSize: 30,
    color: colors.green,
  },

  profileName: {
    marginTop: 16,
    textAlign: "center",
    fontFamily: fonts.extraBold,
    fontSize: 20,
    lineHeight: 26,
    color: colors.text,
  },

  vehicleLine: {
    marginTop: 3,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  vehicleText: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.textSecondary,
  },

  vehicleDot: {
    width: 6,
    height: 6,
    marginHorizontal: 10,
    borderRadius: 3,
    backgroundColor: "#A7ADB7",
  },

  vehicleNickname: {
    fontFamily: fonts.extraBold,
    fontSize: 13,
    color: colors.text,
  },

  noJimnyText: {
    marginTop: 3,
    textAlign: "center",
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },

  locationText: {
    marginTop: 6,
    textAlign: "center",
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textSecondary,
  },

  /*
   * STATS
   */
  statsRow: {
    width: "100%",
    marginTop: 22,
    flexDirection: "row",
    gap: 12,
  },

  statCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 82,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: colors.green,
  },

  statValue: {
    width: "100%",
    textAlign: "center",
    fontFamily: fonts.extraBold,
    fontSize: 18,
    color: colors.white,
  },

  statLabel: {
    width: "100%",
    marginTop: 4,
    textAlign: "center",
    fontFamily: fonts.semiBold,
    fontSize: 9,
    color: colors.white,
  },

  /*
   * SECTION
   */
  sectionTitle: {
    marginTop: 28,
    marginBottom: 13,
    fontFamily: fonts.extraBold,
    fontSize: 12,
    color: colors.red,
  },

  /*
   * TOOL BUTTON
   */
  toolButton: {
    width: "100%",
    minHeight: 66,
    marginBottom: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 17,
    borderWidth: 1.5,
    borderColor: colors.orange,
    borderRadius: 4,
    backgroundColor: colors.background,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.13,
    shadowRadius: 4,
    elevation: 3,
  },

  toolButtonPressed: {
    opacity: 0.78,
  },

  toolTitle: {
    flex: 1,
    fontFamily: fonts.extraBold,
    fontSize: 13,
    color: colors.text,
  },

  /*
   * NO PASSPORT
   */
  passportStartCard: {
    width: "100%",
    marginBottom: 13,
    padding: 16,
    borderWidth: 1.5,
    borderColor: colors.green,
    borderRadius: 4,
    backgroundColor: colors.background,
  },

  passportStartHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  passportIconBox: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.green,
    borderRadius: 4,
    marginRight: 14,
  },

  passportStartTitleWrap: {
    flex: 1,
  },

  passportStartTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 14,
    color: colors.text,
  },

  passportStartSubtitle: {
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textSecondary,
  },

  passportStartBody: {
    marginTop: 14,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 19,
    color: colors.textSecondary,
  },

  passportStartStrong: {
    marginTop: 8,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    lineHeight: 17,
    color: colors.green,
  },

  createPassportButton: {
    width: "100%",
    minHeight: 48,
    marginTop: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    backgroundColor: colors.green,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 3,
  },

  createPassportButtonText: {
    fontFamily: fonts.extraBold,
    fontSize: 12,
    color: colors.white,
  },

  /*
   * ACCOUNT MODAL
   */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "center",
  },

  modalScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 30,
  },

  modalCard: {
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 24,
  },

  modalIconContainer: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  modalTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 20,
    color: colors.text,
    textAlign: "center",
    marginBottom: 10,
  },

  modalDescription: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 20,
  },

  warningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 5,
    padding: 13,
    marginBottom: 22,
  },

  warningText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 19,
    color: colors.text,
  },

  passwordLabel: {
    fontFamily: fonts.extraBold,
    fontSize: 11,
    color: colors.text,
    marginBottom: 6,
  },

  passwordHelp: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
    marginBottom: 10,
  },

  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    minHeight: 46,
    marginBottom: 20,
  },

  passwordInput: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: 12,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.text,
  },

  passwordEyeButton: {
    width: 45,
    height: 45,
    alignItems: "center",
    justifyContent: "center",
  },

  acknowledgeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 22,
  },

  acknowledgeText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 19,
    color: colors.text,
  },

  confirmActionButton: {
    width: "100%",
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    marginBottom: 12,
  },

  deactivateButton: {
    backgroundColor: colors.orange,
  },

  deleteButton: {
    backgroundColor: colors.red,
  },

  disabledButton: {
    opacity: 0.45,
  },

  confirmActionText: {
    fontFamily: fonts.extraBold,
    fontSize: 12,
    color: colors.white,
  },

  cancelActionButton: {
    width: "100%",
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
  },

  cancelActionText: {
    fontFamily: fonts.extraBold,
    fontSize: 12,
    color: colors.text,
  },
});
