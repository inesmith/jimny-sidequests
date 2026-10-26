import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import BottomNav from "../components/BottomNav";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

import {
  colors,
  fonts,
  spacing,
} from "../theme/theme";

export type Experience = {
  id: string;
  title: string;
  category: string;
  date: string;
  time?: string;
  location: string;
  description: string;
  eventDate?: string;
  locationPlaceId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type ExperienceDetailsScreenProps = {
  experience: Experience;
  onBack: () => void;
  onExplore: () => void;
  onAdventures: () => void;
  onPassport: () => void;
  onProfile: () => void;
};

type UserProfile = {
  fullName?: string;
  profilePhotoURL?: string | null;
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
  ownerName?: string;
  profilePhotoURL?: string | null;
  vehicle?: PassportVehicle;
};

export default function ExperienceDetailsScreen({
  experience,
  onBack,
  onExplore,
  onAdventures,
  onPassport,
  onProfile,
}: ExperienceDetailsScreenProps) {
  const [profile, setProfile] =
    useState<UserProfile | null>(null);

  const [passport, setPassport] =
    useState<PassportData | null>(null);

  const [isLoadingUser, setIsLoadingUser] =
    useState(true);

  const [profileError, setProfileError] =
    useState("");

  const [isRegistering, setIsRegistering] =
    useState(false);

  const [guests, setGuests] = useState("");

  const [dietaryNotes, setDietaryNotes] =
    useState("");

  const [
    emergencyContact,
    setEmergencyContact,
  ] = useState("");

  const [
    recoveryGear,
    setRecoveryGear,
  ] = useState("");

  /*
   * LOAD USER + PASSPORT
   */
  useEffect(() => {
    const loadRegistrationIdentity =
      async () => {
        const user = auth.currentUser;

        if (!user) {
          setProfileError(
            "Please log in to register for an experience."
          );

          setIsLoadingUser(false);
          return;
        }

        try {
          const [
            userSnapshot,
            passportSnapshot,
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
                "passports",
                user.uid
              )
            ),
          ]);

          if (userSnapshot.exists()) {
            setProfile(
              userSnapshot.data() as UserProfile
            );
          } else {
            setProfile({
              fullName:
                user.displayName ?? "",
              profilePhotoURL:
                user.photoURL ?? null,
            });
          }

          if (passportSnapshot.exists()) {
            setPassport(
              passportSnapshot.data() as PassportData
            );
          } else {
            setPassport(null);
          }
        } catch (error) {
          console.error(
            "Unable to load registration identity:",
            error
          );

          setProfileError(
            "We couldn't load your profile details."
          );
        } finally {
          setIsLoadingUser(false);
        }
      };

    loadRegistrationIdentity();
  }, []);

  const fullName =
    profile?.fullName?.trim() ||
    passport?.ownerName?.trim() ||
    auth.currentUser?.displayName ||
    "Jimny Owner";

  const profilePhotoURL =
    profile?.profilePhotoURL ||
    passport?.profilePhotoURL ||
    auth.currentUser?.photoURL ||
    null;

  const vehicle = passport?.vehicle;

  const vehicleDescription = useMemo(() => {
    if (!vehicle) {
      return "Jimny details not added yet";
    }

    const mainDescription = [
      vehicle.make,
      vehicle.model,
      vehicle.year
        ? String(vehicle.year)
        : null,
    ]
      .filter(Boolean)
      .join(" ");

    const nickname =
      vehicle.nickname?.trim();

    if (
      mainDescription &&
      nickname
    ) {
      return `${mainDescription} • “${nickname}”`;
    }

    if (mainDescription) {
      return mainDescription;
    }

    if (nickname) {
      return `“${nickname}”`;
    }

    return "Jimny details not added yet";
  }, [vehicle]);

  const initials = useMemo(
    () => getInitials(fullName),
    [fullName]
  );

  /*
   * REGISTER
   */
  const handleRegister = async () => {
    const user = auth.currentUser;

    if (!user) {
      Alert.alert(
        "Sign in required",
        "Please sign in before registering."
      );

      return;
    }

    if (!passport?.vehicle) {
      Alert.alert(
        "Jimny details needed",
        "Please create your Adventure Passport and add your Jimny details before registering."
      );

      return;
    }

    const trimmedGuests =
      guests.trim();

    const guestCount =
      Number(trimmedGuests);

    if (
      !trimmedGuests ||
      !Number.isInteger(guestCount) ||
      guestCount < 0
    ) {
      Alert.alert(
        "Number of guests",
        "Please enter a valid number of guests."
      );

      return;
    }

    if (!emergencyContact.trim()) {
      Alert.alert(
        "Emergency contact",
        "Please enter an emergency contact."
      );

      return;
    }

    try {
      setIsRegistering(true);

      const registrationRef = doc(
        db,
        "users",
        user.uid,
        "experienceRegistrations",
        experience.id
      );

      await setDoc(
        registrationRef,
        {
          /*
           * EXPERIENCE
           */
          experienceId:
            experience.id,

          experienceTitle:
            experience.title,

          experienceCategory:
            experience.category,

          experienceDate:
            experience.date,

          experienceTime:
            experience.time ?? null,

          experienceLocation:
            experience.location,

          experienceLocationPlaceId:
            experience.locationPlaceId ??
            null,

          experienceLatitude:
            experience.latitude ??
            null,

          experienceLongitude:
            experience.longitude ??
            null,

          /*
           * USER
           */
          userId: user.uid,

          fullName,

          profilePhotoURL:
            profilePhotoURL ?? null,

          /*
           * JIMNY
           */
          vehicle: {
            make:
              passport.vehicle?.make ??
              null,

            model:
              passport.vehicle?.model ??
              null,

            year:
              passport.vehicle?.year ??
              null,

            colour:
              passport.vehicle?.colour ??
              null,

            nickname:
              passport.vehicle
                ?.nickname ??
              null,

            photoURL:
              passport.vehicle
                ?.photoURL ??
              null,
          },

          /*
           * REGISTRATION DETAILS
           */
          numberOfGuests:
            guestCount,

          dietaryNotes:
            dietaryNotes.trim(),

          emergencyContact:
            emergencyContact.trim(),

          recoveryGear:
            recoveryGear.trim(),

          status: "registered",

          registeredAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        },
        {
          merge: true,
        }
      );

      Alert.alert(
        "Registration complete",
        `You're registered for ${experience.title}.`,
        [
          {
            text: "OK",
          },
        ]
      );
    } catch (error) {
      console.error(
        "Unable to register for experience:",
        error
      );

      Alert.alert(
        "Registration failed",
        "We couldn't save your registration. Please try again."
      );
    } finally {
      setIsRegistering(false);
    }
  };

  if (isLoadingUser) {
    return (
      <SafeAreaView
        style={styles.safeArea}
        edges={["top", "bottom"]}
      >
        <View
          style={
            styles.loadingContainer
          }
        >
          <ActivityIndicator
            size="small"
            color={colors.green}
          />

          <Text
            style={styles.loadingText}
          >
            Loading your registration
            details...
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
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
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
              style={
                styles.headerTitle
              }
            >
              Experience Details
            </Text>

            <View
              style={
                styles.headerSpacer
              }
            />
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
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            {/* EXPERIENCE IMAGE */}
            <View
              style={
                styles.heroPlaceholder
              }
            >
              <MaterialIcons
                name="image"
                size={42}
                color={
                  colors.textSecondary
                }
              />

              <Text
                style={
                  styles.heroPlaceholderText
                }
              >
                EXPERIENCE IMAGE
              </Text>
            </View>

            <View style={styles.content}>
              {/* CATEGORY */}
              <View
                style={
                  styles.categoryTag
                }
              >
                <Text
                  style={
                    styles.categoryTagText
                  }
                >
                  {experience.category}
                </Text>
              </View>

              {/* TITLE */}
              <Text style={styles.title}>
                {experience.title}
              </Text>

              {/* DESCRIPTION */}
              <Text
                style={
                  styles.description
                }
              >
                {experience.description}
              </Text>

              {/* DATE + TIME + LOCATION */}
              <View
                style={
                  styles.detailsCard
                }
              >
                <View
                  style={
                    styles.detailRow
                  }
                >
                  <Text
                    style={
                      styles.detailLabel
                    }
                  >
                    DATE
                  </Text>

                  <Text
                    style={
                      styles.detailValue
                    }
                  >
                    {experience.date}
                  </Text>
                </View>

                <View
                  style={
                    styles.detailRow
                  }
                >
                  <Text
                    style={
                      styles.detailLabel
                    }
                  >
                    TIME
                  </Text>

                  <Text
                    style={
                      styles.detailValue
                    }
                  >
                    {experience.time ??
                      "To be confirmed"}
                  </Text>
                </View>

                <View
                  style={
                    styles.detailRow
                  }
                >
                  <Text
                    style={
                      styles.detailLabel
                    }
                  >
                    LOCATION
                  </Text>

                  <Text
                    style={
                      styles.detailValue
                    }
                  >
                    {experience.location}
                  </Text>
                </View>
              </View>

              <Text
                style={
                  styles.meetingNote
                }
              >
                Exact meeting point and
                final instructions will
                be shared before the
                experience.
              </Text>

              {/* REGISTRATION INTRO */}
              <View
                style={
                  styles.registrationIntro
                }
              >
                <Text
                  style={
                    styles.registrationHeading
                  }
                >
                  REGISTRATION FORM
                </Text>

                <Text
                  style={
                    styles.registrationDescription
                  }
                >
                  Complete your details
                  to register for this
                  experience.
                </Text>
              </View>

              {/* PROFILE CARD */}
              <View
                style={styles.userCard}
              >
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

                <View
                  style={
                    styles.userDetails
                  }
                >
                  <Text
                    style={
                      styles.userName
                    }
                    numberOfLines={1}
                  >
                    {fullName}
                  </Text>

                  <Text
                    style={
                      styles.userVehicle
                    }
                    numberOfLines={2}
                  >
                    {vehicleDescription}
                  </Text>
                </View>
              </View>

              {profileError ? (
                <Text
                  style={
                    styles.errorText
                  }
                >
                  {profileError}
                </Text>
              ) : null}

              {/* REGISTRATION FORM */}
              <View
                style={styles.formCard}
              >
                <Text
                  style={
                    styles.formTitle
                  }
                >
                  Start a Meet & Greet
                </Text>

                {/* NAME */}
                <View
                  style={
                    styles.backendField
                  }
                >
                  <Text
                    style={
                      styles.backendFieldLabel
                    }
                  >
                    NAME
                  </Text>

                  <Text
                    style={
                      styles.backendFieldValue
                    }
                    numberOfLines={1}
                  >
                    {fullName}
                  </Text>
                </View>

                {/* JIMNY */}
                <View
                  style={
                    styles.backendField
                  }
                >
                  <Text
                    style={
                      styles.backendFieldLabel
                    }
                  >
                    JIMNY
                  </Text>

                  <Text
                    style={
                      styles.backendFieldValue
                    }
                    numberOfLines={2}
                  >
                    {vehicleDescription}
                  </Text>
                </View>

                <TextInput
                  style={styles.input}
                  value={guests}
                  onChangeText={
                    setGuests
                  }
                  placeholder="Number of guests"
                  placeholderTextColor="#A7AFBC"
                  keyboardType="number-pad"
                  editable={
                    !isRegistering
                  }
                />

                <TextInput
                  style={styles.input}
                  value={dietaryNotes}
                  onChangeText={
                    setDietaryNotes
                  }
                  placeholder="Dietary notes"
                  placeholderTextColor="#A7AFBC"
                  editable={
                    !isRegistering
                  }
                />

                <TextInput
                  style={styles.input}
                  value={
                    emergencyContact
                  }
                  onChangeText={
                    setEmergencyContact
                  }
                  placeholder="Emergency contact"
                  placeholderTextColor="#A7AFBC"
                  keyboardType="phone-pad"
                  editable={
                    !isRegistering
                  }
                />

                <TextInput
                  style={[
                    styles.input,
                    styles.recoveryInput,
                  ]}
                  value={recoveryGear}
                  onChangeText={
                    setRecoveryGear
                  }
                  placeholder="Vehicle recovery gear..."
                  placeholderTextColor="#A7AFBC"
                  multiline
                  textAlignVertical="top"
                  editable={
                    !isRegistering
                  }
                />

                <Pressable
                  style={({ pressed }) => [
                    styles.registerButton,
                    isRegistering &&
                      styles.registerButtonDisabled,
                    pressed &&
                      !isRegistering &&
                      styles.pressed,
                  ]}
                  onPress={
                    handleRegister
                  }
                  disabled={
                    isRegistering
                  }
                >
                  {isRegistering ? (
                    <ActivityIndicator
                      size="small"
                      color={colors.white}
                    />
                  ) : (
                    <Text
                      style={
                        styles.registerButtonText
                      }
                    >
                      REGISTER
                    </Text>
                  )}
                </Pressable>

                <Text
                  style={
                    styles.formDisclaimer
                  }
                >
                  By submitting, you
                  confirm you can attend
                  the experience and will
                  follow the meeting
                  instructions shared
                  before the event.
                </Text>
              </View>
            </View>
          </ScrollView>

          {/* BOTTOM NAV */}
          <BottomNav selected="explore" onExplore={onExplore} onHibernate={onAdventures} onPassport={onPassport} onProfile={onProfile} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function getInitials(
  fullName: string
) {
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  keyboardView: {
    flex: 1,
  },

  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },

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

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: 24,
  },

  heroPlaceholder: {
    width: "100%",
    aspectRatio: 1.72,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#D9D9D9",
  },

  heroPlaceholderText: {
    marginTop: 6,
    fontFamily: fonts.semiBold,
    fontSize: 10,
    color: colors.textSecondary,
  },

  content: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  categoryTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 2,
    backgroundColor: colors.green,
  },

  categoryTagText: {
    fontFamily: fonts.semiBold,
    fontSize: 10,
    color: colors.white,
  },

  title: {
    marginTop: 9,
    fontFamily: fonts.extraBold,
    fontSize: 25,
    lineHeight: 30,
    color: colors.text,
  },

  description: {
    marginTop: 5,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textSecondary,
  },

  detailsCard: {
    marginTop: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.green,
    borderRadius: 4,
  },

  detailRow: {
    minHeight: 26,
    flexDirection: "row",
    alignItems: "center",
  },

  detailLabel: {
    width: 76,
    flexShrink: 0,
    fontFamily: fonts.extraBold,
    fontSize: 12,
    color: colors.text,
  },

  detailValue: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 17,
    color: colors.text,
  },

  meetingNote: {
    marginTop: 16,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },

  registrationIntro: {
    marginTop: 16,
  },

  registrationHeading: {
    fontFamily: fonts.extraBold,
    fontSize: 13,
    color: colors.red,
  },

  registrationDescription: {
    marginTop: 4,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },

  userCard: {
    width: "100%",
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 11,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.green,
    borderRadius: 4,
  },

  profilePhoto: {
    width: 52,
    height: 52,
    flexShrink: 0,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.red,
    borderRadius: 26,
    backgroundColor: colors.background,
  },

  profileImage: {
    width: "100%",
    height: "100%",
  },

  initials: {
    fontFamily: fonts.extraBold,
    fontSize: 16,
    color: colors.green,
  },

  userDetails: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
  },

  userName: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
    lineHeight: 19,
    color: colors.text,
  },

  userVehicle: {
    marginTop: 3,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },

  errorText: {
    marginTop: 8,
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.red,
  },

  formCard: {
    width: "100%",
    marginTop: 12,
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: colors.green,
    borderRadius: 8,
  },

  formTitle: {
    marginBottom: 12,
    fontFamily: fonts.extraBold,
    fontSize: 16,
    color: colors.text,
  },

  backendField: {
    width: "100%",
    minHeight: 48,
    justifyContent: "center",
    marginBottom: 12,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderWidth: 1.5,
    borderColor: colors.orange,
    borderRadius: 4,
    backgroundColor: colors.background,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },

  backendFieldLabel: {
    fontFamily: fonts.extraBold,
    fontSize: 8,
    lineHeight: 11,
    color: colors.textSecondary,
  },

  backendFieldValue: {
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 18,
    color: colors.text,
  },

  input: {
    width: "100%",
    minHeight: 48,
    marginBottom: 12,
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: colors.orange,
    borderRadius: 4,
    backgroundColor: colors.background,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.text,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },

  recoveryInput: {
    minHeight: 66,
  },

  registerButton: {
    width: "100%",
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    borderRadius: 4,
    backgroundColor: colors.green,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 3,
  },

  registerButtonDisabled: {
    opacity: 0.65,
  },

  registerButtonText: {
    fontFamily: fonts.extraBold,
    fontSize: 14,
    color: colors.white,
  },

  formDisclaimer: {
    marginTop: 11,
    paddingHorizontal: 12,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
    textAlign: "center",
  },

  bottomNav: {
    minHeight: 86,
    flexDirection: "row",
    alignItems: "stretch",
    borderTopWidth:
      StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    backgroundColor: colors.background,
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

  navItemSelected: {
    backgroundColor: colors.orange,
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
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.text,
    textAlign: "center",
  },

  navTextSelected: {
    fontFamily: fonts.extraBold,
  },

  pressed: {
    opacity: 0.82,
  },
});