import { useEffect, useRef, useState } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as ImagePicker from "expo-image-picker";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

import { auth, db, storage } from "../firebase/firebase";
import { colors, fonts, spacing } from "../theme/theme";

type SignUpScreenProps = {
  onBack: () => void;
  onLogin: () => void;
};

type PlacePrediction = {
  placeId: string;
  mainText: string;
  secondaryText: string;
};

type HomeLocation = {
  placeId: string;
  formattedAddress: string;
};

export default function SignUpScreen({
  onBack,
  onLogin,
}: SignUpScreenProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");

  const [locationQuery, setLocationQuery] = useState("");
  const [locationPredictions, setLocationPredictions] = useState<
    PlacePrediction[]
  >([]);
  const [selectedLocation, setSelectedLocation] =
    useState<HomeLocation | null>(null);
  const [isSearchingLocation, setIsSearchingLocation] =
    useState(false);
  const [isSelectingLocation, setIsSelectingLocation] =
    useState(false);
  const locationRequestId = useRef(0);

  const [profileImageUri, setProfileImageUri] =
    useState<string | null>(null);
  const [profileImageMimeType, setProfileImageMimeType] =
    useState<string | null>(null);

  const [isCreatingAccount, setIsCreatingAccount] =
    useState(false);

  const pickProfilePhoto = async () => {
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          "Photo access needed",
          "Please allow photo library access if you would like to add a profile photo."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets.length > 0) {
        const selectedImage = result.assets[0];

        setProfileImageUri(selectedImage.uri);
        setProfileImageMimeType(
          selectedImage.mimeType ?? "image/jpeg"
        );
      }
    } catch (error) {
      console.error("Image picker error:", error);

      Alert.alert(
        "Couldn't select photo",
        "Something went wrong while opening your photo library. Please try again."
      );
    }
  };

  const googlePlacesApiKey =
    process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

  useEffect(() => {
    const query = locationQuery.trim();

    if (
      selectedLocation &&
      query === selectedLocation.formattedAddress
    ) {
      setLocationPredictions([]);
      setIsSearchingLocation(false);
      return;
    }

    if (query.length < 3) {
      setLocationPredictions([]);
      setIsSearchingLocation(false);
      return;
    }

    const requestId = ++locationRequestId.current;

    const timer = setTimeout(async () => {
      if (!googlePlacesApiKey) {
        console.error(
          "Missing EXPO_PUBLIC_GOOGLE_PLACES_API_KEY"
        );
        return;
      }

      setIsSearchingLocation(true);

      try {
        const response = await fetch(
          "https://places.googleapis.com/v1/places:autocomplete",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": googlePlacesApiKey,
              "X-Goog-FieldMask":
                "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
            },
            body: JSON.stringify({
              input: query,
              includedRegionCodes: ["za"],
            }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Places autocomplete failed: ${response.status} ${errorText}`
          );
        }

        const data = await response.json();

        if (requestId !== locationRequestId.current) {
          return;
        }

        const predictions: PlacePrediction[] = (
          data.suggestions ?? []
        )
          .map((suggestion: any) => {
            const prediction = suggestion.placePrediction;

            if (!prediction?.placeId) {
              return null;
            }

            return {
              placeId: prediction.placeId,
              mainText:
                prediction.structuredFormat?.mainText?.text ??
                prediction.text?.text ??
                "",
              secondaryText:
                prediction.structuredFormat?.secondaryText?.text ??
                "",
            };
          })
          .filter(Boolean);

        setLocationPredictions(predictions);
      } catch (error) {
        console.error("Places autocomplete error:", error);

        if (requestId === locationRequestId.current) {
          setLocationPredictions([]);
        }
      } finally {
        if (requestId === locationRequestId.current) {
          setIsSearchingLocation(false);
        }
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [locationQuery, selectedLocation, googlePlacesApiKey]);

  const selectLocation = async (
    prediction: PlacePrediction
  ) => {
    if (!googlePlacesApiKey || isSelectingLocation) {
      return;
    }

    setIsSelectingLocation(true);
    setLocationPredictions([]);

    try {
      const response = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(
          prediction.placeId
        )}`,
        {
          headers: {
            "X-Goog-Api-Key": googlePlacesApiKey,
            "X-Goog-FieldMask": "id,formattedAddress",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Place details failed: ${response.status} ${errorText}`
        );
      }

      const place = await response.json();

      const homeLocation: HomeLocation = {
        placeId: place.id ?? prediction.placeId,
        formattedAddress:
          place.formattedAddress ??
          [prediction.mainText, prediction.secondaryText]
            .filter(Boolean)
            .join(", "),
      };

      setSelectedLocation(homeLocation);
      setLocationQuery(homeLocation.formattedAddress);
    } catch (error) {
      console.error("Place details error:", error);

      Alert.alert(
        "Couldn't select location",
        "We couldn't load that location. Please try selecting it again."
      );
    } finally {
      setIsSelectingLocation(false);
    }
  };

  const handleLocationQueryChange = (text: string) => {
    setLocationQuery(text);

    if (
      selectedLocation &&
      text !== selectedLocation.formattedAddress
    ) {
      setSelectedLocation(null);
    }
  };

  const getFriendlyFirebaseError = (error: unknown) => {
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error
        ? String((error as { code?: string }).code)
        : "";

    switch (code) {
      case "auth/email-already-in-use":
        return "An account already exists with this email address. Try logging in instead.";

      case "auth/invalid-email":
        return "Please enter a valid email address.";

      case "auth/weak-password":
        return "Your password is too weak. Please use at least 8 characters.";

      case "auth/network-request-failed":
        return "We couldn't connect to the network. Please check your internet connection and try again.";

      case "auth/too-many-requests":
        return "Too many attempts were made. Please wait a little while and try again.";

      default:
        return "We couldn't create your account right now. Please try again.";
    }
  };

  const uploadProfilePhoto = async (
    userId: string
  ): Promise<string | null> => {
    if (!profileImageUri) {
      return null;
    }

    const response = await fetch(profileImageUri);
    const blob = await response.blob();

    const profileImageRef = ref(
      storage,
      `users/${userId}/profile`
    );

    await uploadBytes(profileImageRef, blob, {
      contentType: profileImageMimeType ?? "image/jpeg",
    });

    return await getDownloadURL(profileImageRef);
  };

  const createAccount = async () => {
    const trimmedFullName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone.trim();

    if (!trimmedFullName) {
      Alert.alert(
        "Full name required",
        "Please enter your full name."
      );
      return;
    }

    if (!trimmedEmail) {
      Alert.alert(
        "Email required",
        "Please enter your email address."
      );
      return;
    }

    const emailIsValid =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);

    if (!emailIsValid) {
      Alert.alert(
        "Invalid email",
        "Please enter a valid email address."
      );
      return;
    }

    if (!password) {
      Alert.alert(
        "Password required",
        "Please create a password."
      );
      return;
    }

    if (password.length < 8) {
      Alert.alert(
        "Password too short",
        "Please use at least 8 characters for your password."
      );
      return;
    }

    if (isCreatingAccount) {
      return;
    }

    setIsCreatingAccount(true);

    try {
      const userCredential =
        await createUserWithEmailAndPassword(
          auth,
          trimmedEmail,
          password
        );

      const user = userCredential.user;

      /*
       * Create the user's Firestore profile first.
       * The password is NEVER stored here.
       */
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        fullName: trimmedFullName,
        profilePhotoURL: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await setDoc(doc(db, "privateUserData", user.uid), {
        uid: user.uid,
        email: trimmedEmail,
        phone: trimmedPhone || null,
        homeLocation: selectedLocation
          ? {
              placeId: selectedLocation.placeId,
              formattedAddress:
                selectedLocation.formattedAddress,
            }
          : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      /*
       * Set the Firebase Authentication display name.
       */
      await updateProfile(user, {
        displayName: trimmedFullName,
      });

      /*
       * Upload the profile photo only if the user selected one.
       */
      let profilePhotoURL: string | null = null;

      if (profileImageUri) {
        try {
          profilePhotoURL =
            await uploadProfilePhoto(user.uid);

          if (profilePhotoURL) {
            await setDoc(
              doc(db, "users", user.uid),
              {
                profilePhotoURL,
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );

            await updateProfile(user, {
              displayName: trimmedFullName,
              photoURL: profilePhotoURL,
            });
          }
        } catch (photoError) {
          console.error(
            "Profile photo upload error:",
            photoError
          );

          /*
           * The account and Firestore profile have already
           * been created successfully, so a failed optional
           * photo upload should not destroy the account.
           */
          Alert.alert(
            "Account created",
            "Your account was created successfully, but we couldn't upload your profile photo. You can add it again later.",
            [
              {
                text: "OK",
                onPress: onLogin,
              },
            ]
          );

          return;
        }
      }

      Alert.alert(
        "Welcome to Jimny Side Quests!",
        "Your account and profile have been created successfully.",
        [
          {
            text: "Continue",
            onPress: onLogin,
          },
        ]
      );
    } catch (error) {
      console.error("Create account error:", error);

      Alert.alert(
        "Couldn't create account",
        getFriendlyFirebaseError(error)
      );
    } finally {
      setIsCreatingAccount(false);
    }
  };

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top", "bottom"]}
    >
      <View style={styles.screen}>
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            hitSlop={12}
            onPress={onBack}
            disabled={isCreatingAccount}
          >
            <MaterialIcons
              name="arrow-back"
              size={20}
              color={colors.text}
            />

            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <Text style={styles.headerTitle}>Sign up</Text>

          <View style={styles.headerSpacer} />
        </View>

        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.content}>
              {/* INTRO */}
              <View style={styles.intro}>
                <Text style={styles.eyebrow}>
                  JIMNY SIDE QUESTS
                </Text>

                <Text style={styles.heading}>
                  Set up My Profile
                </Text>

                <Text style={styles.body}>
                  Join the owners network. These details fill your My Profile
                  page and can be reused for your Adventure Passport.
                </Text>
              </View>

              {/* PROFILE PHOTO */}
              <View style={styles.photoCard}>
                <View style={styles.photoCircle}>
                  {profileImageUri ? (
                    <Image
                      source={{ uri: profileImageUri }}
                      style={styles.profileImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <MaterialIcons
                      name="person-outline"
                      size={28}
                      color={colors.green}
                    />
                  )}
                </View>

                <View style={styles.photoContent}>
                  <Text style={styles.photoTitle}>
                    Profile photo · Optional
                  </Text>

                  <Text style={styles.photoDescription}>
                    Add a face to your adventures. You can do this later.
                  </Text>

                  <Pressable
                    onPress={pickProfilePhoto}
                    disabled={isCreatingAccount}
                  >
                    <Text style={styles.uploadText}>
                      {profileImageUri
                        ? "Change photo"
                        : "Upload photo"}
                    </Text>
                  </Pressable>
                </View>

                <Pressable
                  style={styles.addPhotoButton}
                  hitSlop={10}
                  onPress={pickProfilePhoto}
                  disabled={isCreatingAccount}
                >
                  <MaterialIcons
                    name={profileImageUri ? "edit" : "add"}
                    size={24}
                    color={colors.text}
                  />
                </Pressable>
              </View>

              {/* YOUR ACCOUNT */}
              <Text style={styles.sectionTitle}>
                YOUR ACCOUNT
              </Text>

              {/* FULL NAME */}
              <View style={styles.field}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Full name</Text>
                  <Text style={styles.required}>Required</Text>
                </View>

                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Enter your first and last name"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="words"
                  autoComplete="name"
                  textContentType="name"
                  style={styles.input}
                  returnKeyType="next"
                  editable={!isCreatingAccount}
                />

                <Text style={styles.helperText}>
                  This is the owner name shown on My Profile.
                </Text>
              </View>

              {/* EMAIL */}
              <View style={styles.field}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Email address</Text>
                  <Text style={styles.required}>Required</Text>
                </View>

                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter your email address"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="emailAddress"
                  autoComplete="email"
                  style={styles.input}
                  returnKeyType="next"
                  editable={!isCreatingAccount}
                />

                <Text style={styles.helperText}>
                  Used to log in. Not shown on your public profile.
                </Text>
              </View>

              {/* PASSWORD */}
              <View style={styles.field}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Password</Text>
                  <Text style={styles.required}>Required</Text>
                </View>

                <View style={styles.passwordInput}>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Create a password"
                    placeholderTextColor={colors.textSecondary}
                    secureTextEntry={!showPassword}
                    textContentType="newPassword"
                    autoComplete="new-password"
                    style={styles.passwordTextInput}
                    returnKeyType="next"
                    editable={!isCreatingAccount}
                  />

                  <Pressable
                    onPress={() =>
                      setShowPassword((current) => !current)
                    }
                    hitSlop={10}
                    style={styles.eyeButton}
                    accessibilityRole="button"
                    accessibilityLabel={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                    disabled={isCreatingAccount}
                  >
                    <MaterialIcons
                      name={
                        showPassword
                          ? "visibility"
                          : "visibility-off"
                      }
                      size={21}
                      color={colors.text}
                    />
                  </Pressable>
                </View>

                <Text style={styles.helperText}>
                  Use at least 8 characters.
                </Text>
              </View>

              {/* MORE ABOUT YOU */}
              <Text style={styles.sectionTitle}>
                A LITTLE MORE ABOUT YOU
              </Text>

              {/* PHONE */}
              <View style={styles.field}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>Phone number</Text>
                  <Text style={styles.required}>Optional</Text>
                </View>

                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Country code and phone number"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  textContentType="telephoneNumber"
                  style={styles.input}
                  returnKeyType="next"
                  editable={!isCreatingAccount}
                />
              </View>

              {/* HOME LOCATION */}
              <View style={styles.field}>
                <View style={styles.labelRow}>
                  <Text style={styles.label}>
                    Home location
                  </Text>
                  <Text style={styles.required}>Optional</Text>
                </View>

                <View style={styles.locationInputWrap}>
                  <MaterialIcons
                    name="location-on"
                    size={19}
                    color={colors.textSecondary}
                    style={styles.locationIcon}
                  />

                  <TextInput
                    value={locationQuery}
                    onChangeText={handleLocationQueryChange}
                    placeholder="Search for your home address"
                    placeholderTextColor={colors.textSecondary}
                    autoCapitalize="words"
                    autoCorrect={false}
                    style={styles.locationTextInput}
                    returnKeyType="search"
                    editable={!isCreatingAccount}
                  />

                  {(isSearchingLocation ||
                    isSelectingLocation) && (
                    <Text style={styles.locationLoadingText}>
                      ...
                    </Text>
                  )}

                  {locationQuery.length > 0 &&
                    !isSearchingLocation &&
                    !isSelectingLocation && (
                      <Pressable
                        style={styles.clearLocationButton}
                        hitSlop={8}
                        onPress={() => {
                          setLocationQuery("");
                          setSelectedLocation(null);
                          setLocationPredictions([]);
                        }}
                      >
                        <MaterialIcons
                          name="close"
                          size={18}
                          color={colors.textSecondary}
                        />
                      </Pressable>
                    )}
                </View>

                {locationPredictions.length > 0 && (
                  <View style={styles.predictionsBox}>
                    {locationPredictions.map(
                      (prediction, index) => (
                        <Pressable
                          key={prediction.placeId}
                          style={[
                            styles.predictionRow,
                            index <
                              locationPredictions.length - 1 &&
                              styles.predictionDivider,
                          ]}
                          onPress={() =>
                            selectLocation(prediction)
                          }
                        >
                          <MaterialIcons
                            name="place"
                            size={18}
                            color={colors.orange}
                            style={styles.predictionIcon}
                          />

                          <View
                            style={styles.predictionTextWrap}
                          >
                            <Text
                              style={styles.predictionMainText}
                              numberOfLines={1}
                            >
                              {prediction.mainText}
                            </Text>

                            {!!prediction.secondaryText && (
                              <Text
                                style={
                                  styles.predictionSecondaryText
                                }
                                numberOfLines={2}
                              >
                                {prediction.secondaryText}
                              </Text>
                            )}
                          </View>
                        </Pressable>
                      )
                    )}

                    <Text style={styles.googleAttribution}>
                      Google
                    </Text>
                  </View>
                )}

                {selectedLocation && (
                  <View style={styles.selectedLocationRow}>
                    <MaterialIcons
                      name="check-circle"
                      size={15}
                      color={colors.green}
                    />
                    <Text style={styles.selectedLocationText}>
                      Location selected
                    </Text>
                  </View>
                )}

                <Text style={styles.helperText}>
                  Your exact home address stays private. It can
                  later be used to calculate approximate distance
                  without showing your address to other owners.
                </Text>
              </View>

              {/* PASSPORT NOTE */}
              <Text style={styles.passportNote}>
                Your Jimny details and photos come next when you create your
                passport. No stamps needed to get started.
              </Text>

              {/* TERMS */}
              <Text style={styles.termsText}>
                By creating an account, you agree to the{" "}
                <Text style={styles.termsLink}>
                  Terms of Use
                </Text>{" "}
                and{" "}
                <Text style={styles.termsLink}>
                  Privacy Policy
                </Text>
                .
              </Text>

              {/* CREATE ACCOUNT */}
              <Pressable
                style={({ pressed }) => [
                  styles.createButton,
                  pressed &&
                    !isCreatingAccount &&
                    styles.buttonPressed,
                  isCreatingAccount &&
                    styles.buttonDisabled,
                ]}
                onPress={createAccount}
                disabled={isCreatingAccount}
              >
                <Text style={styles.createButtonText}>
                  {isCreatingAccount
                    ? "CREATING ACCOUNT..."
                    : "CREATE ACCOUNT"}
                </Text>
              </Pressable>

              {/* LOGIN */}
              <View style={styles.loginSection}>
                <Text style={styles.memberText}>
                  Already a member?{" "}
                </Text>

                <Pressable
                  onPress={onLogin}
                  hitSlop={8}
                  disabled={isCreatingAccount}
                >
                  <Text style={styles.loginLink}>
                    Log in
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* FULL-WIDTH FOOTER */}
            <View style={styles.footer}>
              <Image
                source={require("../../assets/images/footer-pattern.png")}
                style={styles.footerPattern}
                resizeMode="stretch"
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
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

  keyboardView: {
    flex: 1,
  },

  /* HEADER */

  header: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.medium,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },

  backButton: {
    width: 90,
    flexDirection: "row",
    alignItems: "center",
  },

  backText: {
    marginLeft: 5,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
  },

  headerTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
    color: colors.red,
    textAlign: "center",
  },

  headerSpacer: {
    width: 90,
  },

  /* SCROLL */

  scrollView: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
  },

  content: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: spacing.medium,
    paddingTop: 24,
  },

  /* INTRO */

  intro: {
    marginBottom: 19,
  },

  eyebrow: {
    fontFamily: fonts.extraBold,
    fontSize: 11,
    color: colors.red,
    marginBottom: 7,
  },

  heading: {
    fontFamily: fonts.extraBold,
    fontSize: 22,
    lineHeight: 27,
    color: colors.text,
    marginBottom: 4,
  },

  body: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },

  /* PROFILE PHOTO */

  photoCard: {
    width: "100%",
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 22,
  },

  photoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F2E9D9",
    marginRight: 12,
    overflow: "hidden",
  },

  profileImage: {
    width: "100%",
    height: "100%",
  },

  photoContent: {
    flex: 1,
    paddingRight: 8,
  },

  photoTitle: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.text,
    marginBottom: 3,
  },

  photoDescription: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 15,
    color: colors.textSecondary,
    marginBottom: 4,
  },

  uploadText: {
    fontFamily: fonts.semiBold,
    fontSize: 11,
    color: colors.text,
    textDecorationLine: "underline",
  },

  addPhotoButton: {
    width: 30,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  /* SECTIONS */

  sectionTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 12,
    color: colors.red,
    marginBottom: 14,
  },

  /* FIELDS */

  field: {
    marginBottom: 17,
  },

  labelRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 6,
  },

  label: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.text,
  },

  required: {
    marginLeft: 7,
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.textSecondary,
  },

  input: {
    width: "100%",
    minHeight: 45,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.background,
  },

  helperText: {
    marginTop: 6,
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 14,
    color: colors.textSecondary,
  },

  passwordInput: {
    width: "100%",
    minHeight: 45,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    backgroundColor: colors.background,
  },

  passwordTextInput: {
    flex: 1,
    minHeight: 45,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.text,
  },

  eyeButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  locationInputWrap: {
    width: "100%",
    minHeight: 45,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    backgroundColor: colors.background,
  },

  locationIcon: {
    marginLeft: 11,
    marginRight: 2,
  },

  locationTextInput: {
    flex: 1,
    minHeight: 45,
    paddingHorizontal: 8,
    paddingVertical: 10,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.text,
  },

  locationLoadingText: {
    paddingHorizontal: 12,
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.textSecondary,
  },

  clearLocationButton: {
    width: 40,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  predictionsBox: {
    width: "100%",
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 4,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },

  predictionRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 11,
    paddingVertical: 9,
  },

  predictionDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },

  predictionIcon: {
    marginRight: 9,
  },

  predictionTextWrap: {
    flex: 1,
  },

  predictionMainText: {
    fontFamily: fonts.semiBold,
    fontSize: 12,
    color: colors.text,
    marginBottom: 2,
  },

  predictionSecondaryText: {
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 14,
    color: colors.textSecondary,
  },

  googleAttribution: {
    alignSelf: "flex-end",
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontFamily: fonts.medium,
    fontSize: 9,
    color: colors.textSecondary,
  },

  selectedLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },

  selectedLocationText: {
    flex: 1,
    marginLeft: 5,
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 14,
    color: colors.green,
  },

  /* BOTTOM CONTENT */

  passportNote: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textSecondary,
    marginTop: 3,
    marginBottom: 22,
  },

  termsText: {
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 16,
    color: colors.textSecondary,
    marginBottom: 19,
  },

  termsLink: {
    fontFamily: fonts.semiBold,
    color: colors.text,
    textDecorationLine: "underline",
  },

  createButton: {
    width: "100%",
    minHeight: 45,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green,
    borderRadius: 4,

    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.16,
    shadowRadius: 3,
    elevation: 3,
  },

  createButtonText: {
    fontFamily: fonts.extraBold,
    fontSize: 14,
    color: colors.white,
  },

  buttonPressed: {
    opacity: 0.82,
  },

  buttonDisabled: {
    opacity: 0.65,
  },

  loginSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    marginBottom: 26,
  },

  memberText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },

  loginLink: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.text,
    textDecorationLine: "underline",
  },

  /* FOOTER */

  footer: {
    width: "100%",
  },

  footerPattern: {
    width: "100%",
    height: 27,
  },
});