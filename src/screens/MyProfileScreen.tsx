import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Share,
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
  Timestamp,
} from "firebase/firestore";
import { signOut } from "firebase/auth";

import {
  auth,
  db,
} from "../firebase/firebase";

import {
  colors,
  fonts,
} from "../theme/theme";

type MyProfileScreenProps = {
  onExplore: () => void;
  onAdventures: () => void;
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

export default function MyProfileScreen({
  onExplore,
  onAdventures,
  onPassport,
  onCreatePassport,
  onEditProfile,
  onSignOut,
}: MyProfileScreenProps) {
  const [
    profile,
    setProfile,
  ] = useState<UserProfile | null>(
    null
  );

  const [
    privateData,
    setPrivateData,
  ] =
    useState<PrivateUserData | null>(
      null
    );

  const [
    passport,
    setPassport,
  ] = useState<PassportData | null>(
    null
  );

  const [
    hasPassport,
    setHasPassport,
  ] = useState(false);

  const [
    completedQuestCount,
    setCompletedQuestCount,
  ] = useState(0);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  /*
   * LOAD PROFILE
   */
  useEffect(() => {
    const loadProfile =
      async () => {
        const user =
          auth.currentUser;

        if (!user) {
          setErrorMessage(
            "Please log in to view your profile."
          );

          setIsLoading(
            false
          );

          return;
        }

        try {
          const [
            userSnapshot,
            privateSnapshot,
            passportSnapshot,
            questSnapshot,
          ] = await Promise.all([
            getDoc(
              doc(
                db,
                "users",
                user.uid
              )
            ),

            getDoc(
              doc(
                db,
                "privateUserData",
                user.uid
              )
            ),

            getDoc(
              doc(
                db,
                "passports",
                user.uid
              )
            ),

            getDocs(
              collection(
                db,
                "users",
                user.uid,
                "quests"
              )
            ),
          ]);

          /*
           * PUBLIC PROFILE
           */
          if (
            userSnapshot.exists()
          ) {
            setProfile(
              userSnapshot.data() as UserProfile
            );
          } else {
            setProfile({
              uid: user.uid,
              fullName:
                user.displayName ??
                "",
              profilePhotoURL:
                user.photoURL ??
                null,
            });
          }

          /*
           * PRIVATE ACCOUNT DATA
           */
          if (
            privateSnapshot.exists()
          ) {
            setPrivateData(
              privateSnapshot.data() as PrivateUserData
            );
          } else {
            setPrivateData(
              null
            );
          }

          /*
           * PASSPORT
           */
          if (
            passportSnapshot.exists()
          ) {
            setPassport(
              passportSnapshot.data() as PassportData
            );

            setHasPassport(
              true
            );
          } else {
            setPassport(
              null
            );

            setHasPassport(
              false
            );
          }

          /*
           * COMPLETED QUESTS
           */
          let completed = 0;

          questSnapshot.forEach(
            (questDocument) => {
              const questData =
                questDocument.data();

              if (
                questData.status ===
                "completed"
              ) {
                completed += 1;
              }
            }
          );

          setCompletedQuestCount(
            completed
          );
        } catch (error) {
          console.error(
            "Unable to load profile:",
            error
          );

          setErrorMessage(
            "We couldn't load your profile."
          );
        } finally {
          setIsLoading(
            false
          );
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

  const initials = getInitials(
    fullName
  );

  const vehicle =
    passport?.vehicle;

  const vehicleNickname =
    vehicle?.nickname?.trim();

  const stampCount =
    passport?.stampCount ??
    passport?.stamps?.length ??
    0;

  const memberSince =
    formatMemberSince(
      profile?.createdAt ??
        privateData?.createdAt ??
        null
    );

  /*
   * VEHICLE DESCRIPTION
   */
  const vehicleDescription =
    hasPassport &&
    vehicle
      ? [
          vehicle.make,
          vehicle.model,
          vehicle.year
            ? String(
                vehicle.year
              )
            : null,
        ]
          .filter(Boolean)
          .join(" ")
      : "";

  /*
   * THREE DOT MENU
   */
  const openAccountMenu =
    () => {
      Alert.alert(
        "Account",
        "Choose an option",
        [
          {
            text:
              "Share Profile",
            onPress:
              shareProfile,
          },
          {
            text:
              "Edit Account Profile",
            onPress:
              onEditProfile,
          },
          {
            text:
              "Sign Out",
            style:
              "destructive",
            onPress:
              handleSignOut,
          },
          {
            text:
              "Deactivate Account",
            onPress: () => {
              Alert.alert(
                "Deactivate Account",
                "We'll add account deactivation when we build the account settings functionality."
              );
            },
          },
          {
            text:
              "Delete Account",
            style:
              "destructive",
            onPress: () => {
              Alert.alert(
                "Delete Account",
                "Account deletion will require confirmation and removal of the user's account data. We'll wire this safely when we build account settings."
              );
            },
          },
          {
            text: "Cancel",
            style: "cancel",
          },
        ]
      );
    };

  /*
   * SHARE PROFILE
   */
  const shareProfile =
    async () => {
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
  const handleSignOut =
    () => {
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
            style:
              "destructive",
            onPress:
              async () => {
                try {
                  await signOut(
                    auth
                  );

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
   * LOADING
   */
  if (isLoading) {
    return (
      <SafeAreaView
        style={
          styles.safeArea
        }
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
            size="small"
            color={
              colors.green
            }
          />

          <Text
            style={
              styles.loadingText
            }
          >
            Loading your
            profile...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /*
   * ERROR
   */
  if (
    !profile ||
    errorMessage
  ) {
    return (
      <SafeAreaView
        style={
          styles.safeArea
        }
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
            name="account-circle"
            size={48}
            color={
              colors.green
            }
          />

          <Text
            style={
              styles.errorTitle
            }
          >
            Profile unavailable
          </Text>

          <Text
            style={
              styles.errorBody
            }
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
      <View
        style={styles.screen}
      >
        {/* HEADER */}
        <View
          style={styles.header}
        >
          <View
            style={
              styles.headerSide
            }
          />

          <Text
            style={
              styles.headerTitle
            }
          >
            My Profile
          </Text>

          <Pressable
            style={[
              styles.headerSide,
              styles.headerRight,
            ]}
            onPress={
              openAccountMenu
            }
            hitSlop={10}
          >
            <MaterialIcons
              name="more-horiz"
              size={25}
              color={
                colors.text
              }
            />
          </Pressable>
        </View>

        <ScrollView
          style={
            styles.scrollView
          }
          contentContainerStyle={
            styles.scrollContent
          }
          showsVerticalScrollIndicator={
            false
          }
        >
          <View
            style={
              styles.content
            }
          >
            {/* PROFILE PHOTO */}
            <View
              style={
                styles.profilePhoto
              }
            >
              {profilePhotoURL ? (
                <Image
                  source={{
                    uri: profilePhotoURL,
                  }}
                  style={
                    styles.profileImage
                  }
                  resizeMode="cover"
                />
              ) : (
                <Text
                  style={
                    styles.initials
                  }
                >
                  {initials}
                </Text>
              )}
            </View>

            {/* NAME */}
            <Text
              style={
                styles.profileName
              }
            >
              {fullName}
            </Text>

            {/* JIMNY INFO */}
            {hasPassport &&
            vehicleDescription ? (
              <View
                style={
                  styles.vehicleLine
                }
              >
                <Text
                  style={
                    styles.vehicleText
                  }
                >
                  {
                    vehicleDescription
                  }
                </Text>

                {vehicleNickname ? (
                  <>
                    <View
                      style={
                        styles.vehicleDot
                      }
                    />

                    <Text
                      style={
                        styles.vehicleNickname
                      }
                    >
                      "
                      {
                        vehicleNickname
                      }
                      "
                    </Text>
                  </>
                ) : null}
              </View>
            ) : hasPassport ? null : (
              <Text
                style={
                  styles.noJimnyText
                }
              >
                Jimny details not
                added yet
              </Text>
            )}

            {/* NO PASSPORT ACCOUNT INFO */}
            {!hasPassport ? (
              <Text
                style={
                  styles.locationText
                }
                numberOfLines={1}
              >
                {privateData
                  ?.homeLocation
                  ?.formattedAddress
                  ? "Home location added"
                  : "Home location not added"}{" "}
                · New member
              </Text>
            ) : null}

            {/* STATS */}
            <View
              style={
                styles.statsRow
              }
            >
              <StatCard
                value={String(
                  completedQuestCount
                )}
                label="QUESTS DONE"
              />

              <StatCard
                value={String(
                  stampCount
                )}
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
            <Text
              style={
                styles.sectionTitle
              }
            >
              PASSPORT & TOOLS
            </Text>

            {/* ================================= */}
            {/* PASSPORT EXISTS */}
            {/* ================================= */}

            {hasPassport ? (
              <>
                <ToolButton
                  icon="menu-book"
                  title="View My Passport"
                  onPress={
                    onPassport
                  }
                />

                <ToolButton
                  icon="monitor-heart"
                  title="My Adventures & Stats"
                  onPress={
                    onAdventures
                  }
                />

                <ToolButton
                  icon="settings"
                  title="Edit Account Profile"
                  onPress={
                    onEditProfile
                  }
                />
              </>
            ) : (
              <>
                {/* ================================= */}
                {/* NO PASSPORT YET */}
                {/* ================================= */}

                <View
                  style={
                    styles.passportStartCard
                  }
                >
                  <View
                    style={
                      styles.passportStartHeader
                    }
                  >
                    <View
                      style={
                        styles.passportIconBox
                      }
                    >
                      <MaterialIcons
                        name="menu-book"
                        size={26}
                        color={
                          colors.green
                        }
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
                        Your passport
                        starts here
                      </Text>

                      <Text
                        style={
                          styles.passportStartSubtitle
                        }
                      >
                        No Adventure
                        Passport yet
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={
                      styles.passportStartBody
                    }
                  >
                    Give your Jimny
                    an identity and a
                    place to collect
                    every adventure
                    stamp. Add your
                    details and photos
                    to create your
                    digital booklet.
                  </Text>

                  <Text
                    style={
                      styles.passportStartStrong
                    }
                  >
                    Create it now —
                    your first stamp
                    can come later.
                  </Text>

                  <Pressable
                    style={
                      styles.createPassportButton
                    }
                    onPress={
                      onCreatePassport
                    }
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
                  onPress={
                    onAdventures
                  }
                />

                <ToolButton
                  icon="settings"
                  title="Edit Profile"
                  onPress={
                    onEditProfile
                  }
                />
              </>
            )}
          </View>
        </ScrollView>

        {/* BOTTOM NAVIGATION */}
        <View
          style={
            styles.bottomNav
          }
        >
          <Pressable
            style={
              styles.navItem
            }
            onPress={
              onExplore
            }
          >
            <MaterialIcons
              name="explore"
              size={27}
              color={
                colors.text
              }
            />

            <Text
              style={
                styles.navText
              }
            >
              Explore
            </Text>
          </Pressable>

          <Pressable
            style={
              styles.navItem
            }
            onPress={
              onAdventures
            }
          >
            <MaterialIcons
              name="monitor-heart"
              size={28}
              color={
                colors.text
              }
            />

            <Text
              style={
                styles.navText
              }
            >
              Adventures
            </Text>
          </Pressable>

          <Pressable
            style={
              styles.navItem
            }
            onPress={
              onPassport
            }
          >
            <MaterialIcons
              name="menu-book"
              size={27}
              color={
                colors.text
              }
            />

            <Text
              style={
                styles.navText
              }
            >
              Passport
            </Text>
          </Pressable>

          <View
            style={[
              styles.navItem,
              styles.navItemSelected,
            ]}
          >
            <MaterialIcons
              name="account-circle"
              size={28}
              color={
                colors.text
              }
            />

            <Text
              style={[
                styles.navText,
                styles.navTextSelected,
              ]}
            >
              My Profile
            </Text>
          </View>
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
    <View
      style={styles.statCard}
    >
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
    | "settings";
  title: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.toolButton,
        pressed &&
          styles.toolButtonPressed,
      ]}
      onPress={onPress}
    >
      <MaterialIcons
        name={icon}
        size={28}
        color={colors.text}
      />

      <Text
        style={styles.toolTitle}
      >
        {title}
      </Text>

      <MaterialIcons
        name="chevron-right"
        size={21}
        color={
          colors.textSecondary
        }
      />
    </Pressable>
  );
}

/*
 * INITIALS
 */
function getInitials(
  fullName: string
) {
  const parts =
    fullName
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
    parts[
      parts.length - 1
    ][0]
  }`.toUpperCase();
}

/*
 * MEMBER SINCE
 */
function formatMemberSince(
  timestamp?: Timestamp | null
) {
  if (!timestamp) {
    return "New member";
  }

  try {
    return timestamp
      .toDate()
      .toLocaleDateString(
        "en-ZA",
        {
          month: "long",
          year: "numeric",
        }
      );
  } catch {
    return "New member";
  }
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
     * LOADING
     */

    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent:
        "center",
      gap: 10,
    },

    loadingText: {
      fontFamily:
        fonts.regular,
      fontSize: 12,
      color:
        colors.textSecondary,
    },

    /*
     * ERROR
     */

    errorContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent:
        "center",
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
      width: 72,

      flexDirection: "row",
      alignItems: "center",
    },

    headerRight: {
      justifyContent:
        "flex-end",
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
     * CONTENT
     */

    scrollView: {
      flex: 1,
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
      justifyContent:
        "center",

      overflow: "hidden",

      borderRadius: 58,

      borderWidth: 1.5,
      borderColor: colors.red,

      backgroundColor:
        colors.background,
    },

    profileImage: {
      width: "100%",
      height: "100%",
    },

    initials: {
      fontFamily:
        fonts.extraBold,

      fontSize: 30,

      color: colors.green,
    },

    profileName: {
      marginTop: 16,

      textAlign: "center",

      fontFamily:
        fonts.extraBold,

      fontSize: 25,
      lineHeight: 31,

      color: colors.text,
    },

    vehicleLine: {
      marginTop: 3,

      flexDirection: "row",
      flexWrap: "wrap",

      alignItems: "center",
      justifyContent:
        "center",

      paddingHorizontal: 12,
    },

    vehicleText: {
      fontFamily:
        fonts.semiBold,

      fontSize: 17,

      color:
        colors.textSecondary,
    },

    vehicleDot: {
      width: 6,
      height: 6,

      marginHorizontal: 10,

      borderRadius: 3,

      backgroundColor:
        "#A7ADB7",
    },

    vehicleNickname: {
      fontFamily:
        fonts.extraBold,

      fontSize: 17,

      color: colors.text,
    },

    noJimnyText: {
      marginTop: 3,

      textAlign: "center",

      fontFamily:
        fonts.regular,

      fontSize: 13,

      color:
        colors.textSecondary,
    },

    locationText: {
      marginTop: 6,

      textAlign: "center",

      fontFamily:
        fonts.regular,

      fontSize: 11,

      color:
        colors.textSecondary,
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
      justifyContent:
        "center",

      paddingHorizontal: 6,

      borderRadius: 4,

      backgroundColor:
        colors.green,
    },

    statValue: {
      width: "100%",

      textAlign: "center",

      fontFamily:
        fonts.extraBold,

      fontSize: 22,

      color: colors.white,
    },

    statLabel: {
      width: "100%",

      marginTop: 4,

      textAlign: "center",

      fontFamily:
        fonts.semiBold,

      fontSize: 10,

      color: colors.white,
    },

    /*
     * SECTION
     */

    sectionTitle: {
      marginTop: 28,
      marginBottom: 13,

      fontFamily:
        fonts.extraBold,

      fontSize: 14,

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
      borderColor:
        colors.orange,

      borderRadius: 4,

      backgroundColor:
        colors.background,

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

      fontFamily:
        fonts.extraBold,

      fontSize: 16,

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
      borderColor:
        colors.green,

      borderRadius: 4,

      backgroundColor:
        colors.background,
    },

    passportStartHeader: {
      flexDirection: "row",
      alignItems: "center",
    },

    passportIconBox: {
      width: 48,
      height: 48,

      alignItems: "center",
      justifyContent:
        "center",

      borderWidth: 1,
      borderColor:
        colors.green,

      borderRadius: 4,

      marginRight: 14,
    },

    passportStartTitleWrap: {
      flex: 1,
    },

    passportStartTitle: {
      fontFamily:
        fonts.extraBold,

      fontSize: 16,

      color: colors.text,
    },

    passportStartSubtitle: {
      marginTop: 2,

      fontFamily:
        fonts.regular,

      fontSize: 11,

      color:
        colors.textSecondary,
    },

    passportStartBody: {
      marginTop: 14,

      fontFamily:
        fonts.regular,

      fontSize: 13,
      lineHeight: 19,

      color:
        colors.textSecondary,
    },

    passportStartStrong: {
      marginTop: 8,

      fontFamily:
        fonts.semiBold,

      fontSize: 12,
      lineHeight: 17,

      color: colors.green,
    },

    createPassportButton: {
      width: "100%",

      minHeight: 48,

      marginTop: 14,

      alignItems: "center",
      justifyContent:
        "center",

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

    createPassportButtonText: {
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