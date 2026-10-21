import { useEffect, useRef, useState } from "react";
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
import * as ImagePicker from "expo-image-picker";

import {
  updateEmail,
  updatePassword,
  updateProfile,
} from "firebase/auth";

import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import {
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";

import {
  auth,
  db,
  storage,
} from "../firebase/firebase";

import {
  colors,
  fonts,
} from "../theme/theme";

type EditProfileScreenProps = {
  onBack: () => void;
  onSaved: () => void;
};

type PlacePrediction = {
  place_id: string;
  description: string;
};

type HomeLocation = {
  placeId: string;
  formattedAddress: string;
};

export default function EditProfileScreen({
  onBack,
  onSaved,
}: EditProfileScreenProps) {
  const [fullName, setFullName] =
    useState("");

  const [email, setEmail] =
    useState("");

  const [phone, setPhone] =
    useState("");

  const [newPassword, setNewPassword] =
    useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    locationQuery,
    setLocationQuery,
  ] = useState("");

  const [
    locationPredictions,
    setLocationPredictions,
  ] = useState<
    PlacePrediction[]
  >([]);

  const [
    selectedLocation,
    setSelectedLocation,
  ] =
    useState<HomeLocation | null>(
      null
    );

  const [
    profileImageUri,
    setProfileImageUri,
  ] = useState<string | null>(
    null
  );

  const [
    newProfileImageUri,
    setNewProfileImageUri,
  ] = useState<string | null>(
    null
  );

  const [
    newProfileImageMime,
    setNewProfileImageMime,
  ] = useState<
    string | null
  >(null);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const [
    originalEmail,
    setOriginalEmail,
  ] = useState("");

  const locationTimer =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

  const placesApiKey =
    process.env
      .EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

  /*
   * LOAD EXISTING ACCOUNT DATA
   */
  useEffect(() => {
    const loadAccount =
      async () => {
        const user =
          auth.currentUser;

        if (!user) {
          Alert.alert(
            "Account unavailable",
            "Please log in again."
          );

          onBack();
          return;
        }

        try {
          const [
            userSnapshot,
            privateSnapshot,
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
          ]);

          const userData =
            userSnapshot.exists()
              ? userSnapshot.data()
              : {};

          const privateData =
            privateSnapshot.exists()
              ? privateSnapshot.data()
              : {};

          const existingName =
            typeof userData.fullName ===
            "string"
              ? userData.fullName
              : user.displayName ??
                "";

          const existingPhoto =
            typeof userData.profilePhotoURL ===
            "string"
              ? userData.profilePhotoURL
              : user.photoURL ??
                null;

          const existingEmail =
            user.email ?? "";

          const existingPhone =
            typeof privateData.phone ===
            "string"
              ? privateData.phone
              : "";

          const existingLocation =
            privateData.homeLocation &&
            typeof privateData.homeLocation ===
              "object"
              ? privateData.homeLocation
              : null;

          setFullName(
            existingName
          );

          setEmail(
            existingEmail
          );

          setOriginalEmail(
            existingEmail
          );

          setPhone(
            existingPhone
          );

          setProfileImageUri(
            existingPhoto
          );

          if (
            existingLocation &&
            typeof existingLocation.placeId ===
              "string" &&
            typeof existingLocation.formattedAddress ===
              "string"
          ) {
            const location: HomeLocation =
              {
                placeId:
                  existingLocation.placeId,

                formattedAddress:
                  existingLocation.formattedAddress,
              };

            setSelectedLocation(
              location
            );

            setLocationQuery(
              location.formattedAddress
            );
          }
        } catch (error) {
          console.error(
            "Unable to load account profile:",
            error
          );

          Alert.alert(
            "Couldn't load profile",
            "Please try again."
          );
        } finally {
          setIsLoading(false);
        }
      };

    loadAccount();

    return () => {
      if (
        locationTimer.current
      ) {
        clearTimeout(
          locationTimer.current
        );
      }
    };
  }, []);

  /*
   * LOCATION SEARCH
   */
  const searchLocations =
    (
      text: string
    ) => {
      setLocationQuery(text);

      setSelectedLocation(
        null
      );

      if (
        locationTimer.current
      ) {
        clearTimeout(
          locationTimer.current
        );
      }

      if (
        text.trim().length < 3
      ) {
        setLocationPredictions(
          []
        );

        return;
      }

      locationTimer.current =
        setTimeout(
          async () => {
            if (
              !placesApiKey
            ) {
              return;
            }

            try {
              const encodedInput =
                encodeURIComponent(
                  text.trim()
                );

              const response =
                await fetch(
                  `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodedInput}&key=${placesApiKey}&components=country:za`
                );

              const data =
                await response.json();

              if (
                Array.isArray(
                  data.predictions
                )
              ) {
                const predictions: PlacePrediction[] =
                  data.predictions.map(
                    (
                      prediction: any
                    ) => ({
                      place_id:
                        prediction.place_id,

                      description:
                        prediction.description,
                    })
                  );

                setLocationPredictions(
                  predictions
                );
              } else {
                setLocationPredictions(
                  []
                );
              }
            } catch (error) {
              console.error(
                "Location search failed:",
                error
              );

              setLocationPredictions(
                []
              );
            }
          },
          350
        );
    };

  /*
   * SELECT LOCATION
   */
  const chooseLocation =
    async (
      prediction: PlacePrediction
    ) => {
      setLocationPredictions(
        []
      );

      setLocationQuery(
        prediction.description
      );

      if (!placesApiKey) {
        setSelectedLocation({
          placeId:
            prediction.place_id,

          formattedAddress:
            prediction.description,
        });

        return;
      }

      try {
        const response =
          await fetch(
            `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
              prediction.place_id
            )}&fields=place_id,formatted_address&key=${placesApiKey}`
          );

        const data =
          await response.json();

        const formattedAddress =
          data?.result
            ?.formatted_address;

        setSelectedLocation({
          placeId:
            prediction.place_id,

          formattedAddress:
            typeof formattedAddress ===
            "string"
              ? formattedAddress
              : prediction.description,
        });

        setLocationQuery(
          typeof formattedAddress ===
            "string"
            ? formattedAddress
            : prediction.description
        );
      } catch (error) {
        console.error(
          "Unable to load location:",
          error
        );

        setSelectedLocation({
          placeId:
            prediction.place_id,

          formattedAddress:
            prediction.description,
        });
      }
    };

  /*
   * PROFILE PHOTO
   */
  const chooseProfilePhoto =
    async () => {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (
        !permission.granted
      ) {
        Alert.alert(
          "Photo permission needed",
          "Please allow photo access to choose a profile picture."
        );

        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync(
          {
            mediaTypes: [
              "images",
            ],

            allowsEditing: true,

            aspect: [1, 1],

            quality: 0.85,
          }
        );

      if (
        result.canceled ||
        !result.assets[0]
      ) {
        return;
      }

      const asset =
        result.assets[0];

      setNewProfileImageUri(
        asset.uri
      );

      setProfileImageUri(
        asset.uri
      );

      setNewProfileImageMime(
        asset.mimeType ??
          "image/jpeg"
      );
    };

  /*
   * SAVE PROFILE
   */
  const saveProfile =
    async () => {
      const user =
        auth.currentUser;

      if (!user) {
        Alert.alert(
          "Account unavailable",
          "Please log in again."
        );

        return;
      }

      const trimmedName =
        fullName.trim();

      const trimmedEmail =
        email
          .trim()
          .toLowerCase();

      const trimmedPhone =
        phone.trim();

      const trimmedPassword =
        newPassword.trim();

      if (!trimmedName) {
        Alert.alert(
          "Name required",
          "Please enter your full name."
        );

        return;
      }

      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          trimmedEmail
        )
      ) {
        Alert.alert(
          "Email required",
          "Please enter a valid email address."
        );

        return;
      }

      if (
        trimmedPassword &&
        trimmedPassword.length <
          6
      ) {
        Alert.alert(
          "Password too short",
          "Your new password must be at least 6 characters."
        );

        return;
      }

      setIsSaving(true);

      try {
        let finalPhotoURL =
          profileImageUri;

        /*
         * UPLOAD NEW PROFILE PHOTO
         */
        if (
          newProfileImageUri
        ) {
          const response =
            await fetch(
              newProfileImageUri
            );

          const blob =
            await response.blob();

          const imageRef =
            ref(
              storage,
              `users/${user.uid}/profile`
            );

          await uploadBytes(
            imageRef,
            blob,
            {
              contentType:
                newProfileImageMime ??
                "image/jpeg",
            }
          );

          finalPhotoURL =
            await getDownloadURL(
              imageRef
            );
        }

        /*
         * UPDATE FIREBASE AUTH NAME / PHOTO
         */
        await updateProfile(
          user,
          {
            displayName:
              trimmedName,

            photoURL:
              finalPhotoURL ??
              null,
          }
        );

        /*
         * CHANGE EMAIL IF NECESSARY
         */
        if (
          trimmedEmail !==
          originalEmail
            .trim()
            .toLowerCase()
        ) {
          await updateEmail(
            user,
            trimmedEmail
          );
        }

        /*
         * OPTIONAL PASSWORD CHANGE
         */
        if (
          trimmedPassword
        ) {
          await updatePassword(
            user,
            trimmedPassword
          );
        }

        /*
         * UPDATE PUBLIC PROFILE
         */
        await setDoc(
          doc(
            db,
            "users",
            user.uid
          ),
          {
            uid: user.uid,

            fullName:
              trimmedName,

            profilePhotoURL:
              finalPhotoURL ??
              null,

            updatedAt:
              serverTimestamp(),
          },
          {
            merge: true,
          }
        );

        /*
         * UPDATE PRIVATE PROFILE
         */
        await setDoc(
          doc(
            db,
            "privateUserData",
            user.uid
          ),
          {
            uid: user.uid,

            email:
              trimmedEmail,

            phone:
              trimmedPhone ||
              null,

            homeLocation:
              selectedLocation
                ? {
                    placeId:
                      selectedLocation.placeId,

                    formattedAddress:
                      selectedLocation.formattedAddress,
                  }
                : null,

            updatedAt:
              serverTimestamp(),
          },
          {
            merge: true,
          }
        );

        Alert.alert(
          "Profile updated",
          "Your account details have been saved.",
          [
            {
              text: "Done",
              onPress:
                onSaved,
            },
          ]
        );
      } catch (error: any) {
        console.error(
          "Unable to update profile:",
          error
        );

        const code =
          typeof error?.code ===
          "string"
            ? error.code
            : "";

        if (
          code ===
            "auth/requires-recent-login" ||
          code ===
            "auth/requires-recent-login"
        ) {
          Alert.alert(
            "Please log in again",
            "For security, Firebase requires you to log in again before changing your email or password."
          );
        } else if (
          code ===
          "auth/email-already-in-use"
        ) {
          Alert.alert(
            "Email already in use",
            "That email address is already linked to another account."
          );
        } else if (
          code ===
          "auth/invalid-email"
        ) {
          Alert.alert(
            "Invalid email",
            "Please enter a valid email address."
          );
        } else if (
          code ===
          "auth/weak-password"
        ) {
          Alert.alert(
            "Password too weak",
            "Please choose a stronger password."
          );
        } else {
          Alert.alert(
            "Couldn't update profile",
            "Something went wrong while saving your changes. Please try again."
          );
        }
      } finally {
        setIsSaving(false);
      }
    };

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

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={[
        "top",
        "bottom",
      ]}
    >
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={
          Platform.OS ===
          "ios"
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
              name="arrow-back-ios-new"
              size={17}
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
            Edit Profile
          </Text>

          <View
            style={
              styles.headerSide
            }
          />
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
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={
              styles.content
            }
          >
            {/* INTRO */}
            <Text
              style={
                styles.eyebrow
              }
            >
              JIMNY SIDE QUESTS
            </Text>

            <Text
              style={
                styles.title
              }
            >
              Edit My Profile
            </Text>

            <Text
              style={
                styles.intro
              }
            >
              Keep your account
              details up to date.
              Your Adventure
              Passport and stamps
              stay exactly where
              they are.
            </Text>

            {/* PROFILE PHOTO */}
            <Pressable
              style={
                styles.photoCard
              }
              onPress={
                chooseProfilePhoto
              }
            >
              <View
                style={
                  styles.photoCircle
                }
              >
                {profileImageUri ? (
                  <Image
                    source={{
                      uri: profileImageUri,
                    }}
                    style={
                      styles.profileImage
                    }
                  />
                ) : (
                  <MaterialIcons
                    name="person"
                    size={42}
                    color={
                      colors.green
                    }
                  />
                )}
              </View>

              <View
                style={
                  styles.photoTextWrap
                }
              >
                <Text
                  style={
                    styles.photoTitle
                  }
                >
                  Change profile
                  photo
                </Text>

                <Text
                  style={
                    styles.photoSubtitle
                  }
                >
                  Tap to choose a
                  new photo
                </Text>
              </View>

              <MaterialIcons
                name="photo-camera"
                size={24}
                color={
                  colors.green
                }
              />
            </Pressable>

            {/* YOUR ACCOUNT */}
            <Text
              style={
                styles.sectionTitle
              }
            >
              YOUR ACCOUNT
            </Text>

            <FieldLabel
              text="FULL NAME"
            />

            <TextInput
              value={fullName}
              onChangeText={
                setFullName
              }
              placeholder="Your full name"
              placeholderTextColor="#8A8F98"
              style={
                styles.input
              }
              autoCapitalize="words"
            />

            <FieldLabel
              text="EMAIL"
            />

            <TextInput
              value={email}
              onChangeText={
                setEmail
              }
              placeholder="Your email address"
              placeholderTextColor="#8A8F98"
              style={
                styles.input
              }
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={
                false
              }
            />

            <FieldLabel
              text="NEW PASSWORD"
              optional
            />

            <View
              style={
                styles.passwordWrap
              }
            >
              <TextInput
                value={
                  newPassword
                }
                onChangeText={
                  setNewPassword
                }
                placeholder="Leave blank to keep current password"
                placeholderTextColor="#8A8F98"
                style={
                  styles.passwordInput
                }
                secureTextEntry={
                  !showPassword
                }
                autoCapitalize="none"
              />

              <Pressable
                style={
                  styles.eyeButton
                }
                onPress={() =>
                  setShowPassword(
                    (current) =>
                      !current
                  )
                }
                hitSlop={8}
              >
                <MaterialIcons
                  name={
                    showPassword
                      ? "visibility-off"
                      : "visibility"
                  }
                  size={22}
                  color={
                    colors.textSecondary
                  }
                />
              </Pressable>
            </View>

            <Text
              style={
                styles.passwordHint
              }
            >
              Only enter a new
              password if you want
              to change it.
            </Text>

            {/* A LITTLE MORE ABOUT YOU */}
            <Text
              style={[
                styles.sectionTitle,
                styles.secondSection,
              ]}
            >
              A LITTLE MORE ABOUT
              YOU
            </Text>

            <FieldLabel
              text="PHONE NUMBER"
              optional
            />

            <TextInput
              value={phone}
              onChangeText={
                setPhone
              }
              placeholder="Your phone number"
              placeholderTextColor="#8A8F98"
              style={
                styles.input
              }
              keyboardType="phone-pad"
            />

            <FieldLabel
              text="HOME LOCATION"
              optional
            />

            <View
              style={
                styles.locationWrap
              }
            >
              <View
                style={
                  styles.locationInputWrap
                }
              >
                <MaterialIcons
                  name="location-on"
                  size={21}
                  color={
                    colors.green
                  }
                />

                <TextInput
                  value={
                    locationQuery
                  }
                  onChangeText={
                    searchLocations
                  }
                  placeholder="Search your home location"
                  placeholderTextColor="#8A8F98"
                  style={
                    styles.locationInput
                  }
                />

                {locationQuery ? (
                  <Pressable
                    onPress={() => {
                      setLocationQuery(
                        ""
                      );

                      setSelectedLocation(
                        null
                      );

                      setLocationPredictions(
                        []
                      );
                    }}
                    hitSlop={8}
                  >
                    <MaterialIcons
                      name="close"
                      size={20}
                      color={
                        colors.textSecondary
                      }
                    />
                  </Pressable>
                ) : null}
              </View>

              {locationPredictions.length >
              0 ? (
                <View
                  style={
                    styles.predictions
                  }
                >
                  {locationPredictions.map(
                    (
                      prediction
                    ) => (
                      <Pressable
                        key={
                          prediction.place_id
                        }
                        style={
                          styles.predictionItem
                        }
                        onPress={() =>
                          chooseLocation(
                            prediction
                          )
                        }
                      >
                        <MaterialIcons
                          name="place"
                          size={18}
                          color={
                            colors.green
                          }
                        />

                        <Text
                          style={
                            styles.predictionText
                          }
                        >
                          {
                            prediction.description
                          }
                        </Text>
                      </Pressable>
                    )
                  )}
                </View>
              ) : null}
            </View>

            {/* NOTE */}
            <View
              style={
                styles.noteCard
              }
            >
              <MaterialIcons
                name="menu-book"
                size={23}
                color={
                  colors.green
                }
              />

              <Text
                style={
                  styles.noteText
                }
              >
                Updating your
                account profile
                will not remove
                your Adventure
                Passport, quests
                or collected
                stamps.
              </Text>
            </View>

            {/* SAVE */}
            <Pressable
              style={({ pressed }) => [
                styles.saveButton,
                (pressed ||
                  isSaving) &&
                  styles.buttonPressed,
              ]}
              onPress={
                saveProfile
              }
              disabled={
                isSaving
              }
            >
              {isSaving ? (
                <ActivityIndicator
                  color={
                    colors.white
                  }
                />
              ) : (
                <Text
                  style={
                    styles.saveButtonText
                  }
                >
                  SAVE CHANGES
                </Text>
              )}
            </Pressable>
          </View>

          {/* FOOTER */}
          <Image
            source={require("../../assets/images/footer-pattern.png")}
            style={
              styles.footerPattern
            }
            resizeMode="stretch"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FieldLabel({
  text,
  optional = false,
}: {
  text: string;
  optional?: boolean;
}) {
  return (
    <View
      style={
        styles.fieldLabelRow
      }
    >
      <Text
        style={
          styles.fieldLabel
        }
      >
        {text}
      </Text>

      {optional ? (
        <Text
          style={
            styles.optionalText
          }
        >
          OPTIONAL
        </Text>
      ) : null}
    </View>
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
     * HEADER
     */
    header: {
      minHeight: 72,

      flexDirection: "row",
      alignItems: "center",

      paddingHorizontal: 18,

      borderBottomWidth:
        StyleSheet.hairlineWidth,

      borderBottomColor:
        colors.divider,
    },

    headerSide: {
      width: 86,

      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },

    backText: {
      fontFamily:
        fonts.medium,

      fontSize: 13,

      color: colors.text,
    },

    headerTitle: {
      flex: 1,

      textAlign: "center",

      fontFamily:
        fonts.extraBold,

      fontSize: 18,

      color: colors.red,
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

      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 34,
    },

    /*
     * INTRO
     */
    eyebrow: {
      fontFamily:
        fonts.extraBold,

      fontSize: 11,

      letterSpacing: 1.2,

      color: colors.red,
    },

    title: {
      marginTop: 5,

      fontFamily:
        fonts.extraBold,

      fontSize: 30,
      lineHeight: 35,

      color: colors.text,
    },

    intro: {
      marginTop: 8,

      maxWidth: 410,

      fontFamily:
        fonts.regular,

      fontSize: 13,
      lineHeight: 19,

      color:
        colors.textSecondary,
    },

    /*
     * PHOTO
     */
    photoCard: {
      width: "100%",

      minHeight: 105,

      marginTop: 22,

      flexDirection: "row",
      alignItems: "center",

      paddingHorizontal: 17,
      paddingVertical: 14,

      borderWidth: 1.5,
      borderStyle: "dashed",
      borderColor:
        colors.orange,

      borderRadius: 4,
    },

    photoCircle: {
      width: 68,
      height: 68,

      alignItems: "center",
      justifyContent:
        "center",

      overflow: "hidden",

      borderRadius: 34,

      borderWidth: 1.5,
      borderColor:
        colors.red,

      backgroundColor:
        colors.surface,
    },

    profileImage: {
      width: "100%",
      height: "100%",
    },

    photoTextWrap: {
      flex: 1,
      minWidth: 0,

      marginLeft: 14,
      marginRight: 10,
    },

    photoTitle: {
      fontFamily:
        fonts.extraBold,

      fontSize: 14,

      color: colors.text,
    },

    photoSubtitle: {
      marginTop: 4,

      fontFamily:
        fonts.regular,

      fontSize: 11,

      color:
        colors.textSecondary,
    },

    /*
     * SECTIONS
     */
    sectionTitle: {
      marginTop: 28,
      marginBottom: 14,

      fontFamily:
        fonts.extraBold,

      fontSize: 13,

      color: colors.red,
    },

    secondSection: {
      marginTop: 31,
    },

    /*
     * LABELS
     */
    fieldLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",

      marginBottom: 7,
    },

    fieldLabel: {
      fontFamily:
        fonts.extraBold,

      fontSize: 10,

      letterSpacing: 0.5,

      color: colors.text,
    },

    optionalText: {
      fontFamily:
        fonts.regular,

      fontSize: 9,

      color:
        colors.textSecondary,
    },

    /*
     * INPUTS
     */
    input: {
      width: "100%",
      minHeight: 50,

      marginBottom: 17,

      paddingHorizontal: 14,

      borderWidth: 1,
      borderColor:
        colors.divider,

      borderRadius: 4,

      backgroundColor:
        colors.surface,

      fontFamily:
        fonts.regular,

      fontSize: 14,

      color: colors.text,
    },

    passwordWrap: {
      width: "100%",
      minHeight: 50,

      marginBottom: 6,

      flexDirection: "row",
      alignItems: "center",

      borderWidth: 1,
      borderColor:
        colors.divider,

      borderRadius: 4,

      backgroundColor:
        colors.surface,
    },

    passwordInput: {
      flex: 1,

      minHeight: 48,

      paddingLeft: 14,
      paddingRight: 8,

      fontFamily:
        fonts.regular,

      fontSize: 14,

      color: colors.text,
    },

    eyeButton: {
      width: 46,
      height: 48,

      alignItems: "center",
      justifyContent:
        "center",
    },

    passwordHint: {
      marginBottom: 17,

      fontFamily:
        fonts.regular,

      fontSize: 10,
      lineHeight: 15,

      color:
        colors.textSecondary,
    },

    /*
     * LOCATION
     */
    locationWrap: {
      width: "100%",

      marginBottom: 18,

      position: "relative",
      zIndex: 20,
    },

    locationInputWrap: {
      width: "100%",
      minHeight: 50,

      flexDirection: "row",
      alignItems: "center",

      paddingHorizontal: 13,

      borderWidth: 1,
      borderColor:
        colors.divider,

      borderRadius: 4,

      backgroundColor:
        colors.surface,
    },

    locationInput: {
      flex: 1,

      minHeight: 48,

      marginLeft: 8,
      marginRight: 6,

      fontFamily:
        fonts.regular,

      fontSize: 14,

      color: colors.text,
    },

    predictions: {
      width: "100%",

      marginTop: 4,

      overflow: "hidden",

      borderWidth: 1,
      borderColor:
        colors.divider,

      borderRadius: 4,

      backgroundColor:
        colors.surface,
    },

    predictionItem: {
      minHeight: 50,

      flexDirection: "row",
      alignItems: "center",

      gap: 9,

      paddingHorizontal: 12,
      paddingVertical: 10,

      borderBottomWidth:
        StyleSheet.hairlineWidth,

      borderBottomColor:
        colors.divider,
    },

    predictionText: {
      flex: 1,

      fontFamily:
        fonts.regular,

      fontSize: 12,
      lineHeight: 17,

      color: colors.text,
    },

    /*
     * NOTE
     */
    noteCard: {
      width: "100%",

      marginTop: 3,

      flexDirection: "row",
      alignItems:
        "flex-start",

      gap: 11,

      padding: 14,

      borderWidth: 1,
      borderColor:
        colors.green,

      borderRadius: 4,
    },

    noteText: {
      flex: 1,

      fontFamily:
        fonts.regular,

      fontSize: 11,
      lineHeight: 17,

      color:
        colors.textSecondary,
    },

    /*
     * SAVE
     */
    saveButton: {
      width: "100%",
      minHeight: 52,

      marginTop: 22,

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

      shadowOpacity: 0.17,

      shadowRadius: 4,

      elevation: 3,
    },

    saveButtonText: {
      fontFamily:
        fonts.extraBold,

      fontSize: 14,

      color: colors.white,
    },

    buttonPressed: {
      opacity: 0.76,
    },

    /*
     * FOOTER
     */
    footerPattern: {
      width: "100%",
      height: 55,
    },
  });