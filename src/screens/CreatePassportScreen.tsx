import { useEffect, useState } from "react";
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
import BottomNav from "../components/BottomNav";
import * as ImagePicker from "expo-image-picker";

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

import { httpsCallable } from "firebase/functions";

import {
  auth,
  db,
  functions,
  storage,
} from "../firebase/firebase";
import { colors, fonts, spacing } from "../theme/theme";

type CreatePassportScreenProps = {
  onBack?: () => void;
  onExplore?: () => void;
  onAdventures?: () => void;
  onProfile?: () => void;
  onCreatePassport?: () => void;
};

export default function CreatePassportScreen({
  onBack,
  onExplore,
  onAdventures,
  onProfile,
  onCreatePassport,
}: CreatePassportScreenProps) {
  const [ownerName, setOwnerName] = useState("");
  const [homeLocation, setHomeLocation] = useState("");

  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [colour, setColour] = useState("");
  const [vehicleNickname, setVehicleNickname] = useState("");

  const [profilePhotoUri, setProfilePhotoUri] =
    useState<string | null>(null);

  const [existingProfilePhotoURL, setExistingProfilePhotoURL] =
    useState<string | null>(null);

  const [jimnyPhotoUri, setJimnyPhotoUri] =
    useState<string | null>(null);

  const [isLoadingProfile, setIsLoadingProfile] =
    useState(true);

  const [isCreating, setIsCreating] =
    useState(false);

  /*
   * LOAD EXISTING PROFILE + PRIVATE HOME LOCATION
   */
  useEffect(() => {
    const loadProfile = async () => {
      const user = auth.currentUser;

      if (!user) {
        setIsLoadingProfile(false);
        return;
      }

      try {
        const userRef = doc(
          db,
          "users",
          user.uid
        );

        const privateRef = doc(
          db,
          "privateUserData",
          user.uid
        );

        const [
          userSnapshot,
          privateSnapshot,
        ] = await Promise.all([
          getDoc(userRef),
          getDoc(privateRef),
        ]);

        /*
         * PUBLIC PROFILE
         */
        if (userSnapshot.exists()) {
          const data =
            userSnapshot.data();

          if (data.fullName) {
            setOwnerName(
              data.fullName
            );
          }

          if (data.profilePhotoURL) {
            setExistingProfilePhotoURL(
              data.profilePhotoURL
            );
          }
        }

        /*
         * PRIVATE PROFILE DATA
         *
         * The exact address stays in
         * privateUserData.
         */
        if (privateSnapshot.exists()) {
          const privateData =
            privateSnapshot.data();

          if (
            privateData.homeLocation
              ?.formattedAddress
          ) {
            setHomeLocation(
              privateData.homeLocation
                .formattedAddress
            );
          }
        }
      } catch (error) {
        console.error(
          "Unable to load profile:",
          error
        );
      } finally {
        setIsLoadingProfile(false);
      }
    };

    loadProfile();
  }, []);

  /*
   * PICK PHOTO
   */
  const pickPhoto = async (
    type: "profile" | "jimny"
  ) => {
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          "Photo permission needed",
          "Please allow access to your photos so you can choose an image."
        );
        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect:
            type === "profile"
              ? [1, 1]
              : [4, 3],
          quality: 0.8,
        });

      if (result.canceled) {
        return;
      }

      const selectedUri =
        result.assets[0]?.uri;

      if (!selectedUri) {
        return;
      }

      if (type === "profile") {
        setProfilePhotoUri(
          selectedUri
        );
      } else {
        setJimnyPhotoUri(
          selectedUri
        );
      }
    } catch (error) {
      console.error(
        "Unable to select photo:",
        error
      );

      Alert.alert(
        "Unable to select photo",
        "Please try again."
      );
    }
  };

  /*
   * UPLOAD PHOTO
   */
  const uploadPhoto = async (
    uri: string,
    uid: string,
    fileName: string
  ) => {
    const response =
      await fetch(uri);

    const blob =
      await response.blob();

    const storageRef = ref(
      storage,
      `users/${uid}/passport/${fileName}`
    );

    await uploadBytes(
      storageRef,
      blob
    );

    return await getDownloadURL(
      storageRef
    );
  };

  /*
   * GENERATE PASSPORT NUMBER
   */
  const generatePassportNumber = (
    uid: string
  ) => {
    let hash = 0;

    for (
      let i = 0;
      i < uid.length;
      i += 1
    ) {
      hash =
        (hash * 31 +
          uid.charCodeAt(i)) %
        9000;
    }

    const number =
      1000 + Math.abs(hash);

    return `JSQ-${number}`;
  };

  /*
   * CREATE PASSPORT
   */
  const handleCreatePassport =
    async () => {
      const user =
        auth.currentUser;

      if (!user) {
        Alert.alert(
          "Not signed in",
          "Please log in again before creating your passport."
        );
        return;
      }

      if (
        !ownerName.trim() ||
        !make.trim() ||
        !model.trim() ||
        vehicleYear.trim().length !==
          4 ||
        !colour.trim()
      ) {
        Alert.alert(
          "Missing details",
          "Please complete all required passport fields."
        );
        return;
      }

      const numericYear =
        Number(vehicleYear);

      const currentYear =
        new Date().getFullYear();

      if (
        Number.isNaN(
          numericYear
        ) ||
        numericYear < 1970 ||
        numericYear >
          currentYear + 1
      ) {
        Alert.alert(
          "Check vehicle year",
          "Please enter a valid four-digit vehicle year."
        );
        return;
      }

      setIsCreating(true);

      try {
        const passportRef = doc(
          db,
          "passports",
          user.uid
        );

        /*
         * PREVENT DUPLICATES
         */
        const existingPassport =
          await getDoc(
            passportRef
          );

        if (
          existingPassport.exists()
        ) {
          Alert.alert(
            "Passport already created",
            "You already have an Adventure Passport."
          );

          onCreatePassport?.();
          return;
        }

        let finalProfilePhotoURL =
          existingProfilePhotoURL ||
          "";

        let jimnyPhotoURL = "";

        /*
         * PROFILE PHOTO
         */
        if (profilePhotoUri) {
          finalProfilePhotoURL =
            await uploadPhoto(
              profilePhotoUri,
              user.uid,
              "profile.jpg"
            );

          await setDoc(
            doc(
              db,
              "users",
              user.uid
            ),
            {
              profilePhotoURL:
                finalProfilePhotoURL,

              updatedAt:
                serverTimestamp(),
            },
            {
              merge: true,
            }
          );
        }

        /*
         * JIMNY PHOTO
         *
         * Keep the original photo in Storage,
         * then ask the Cloud Function to remove
         * its background. The passport uses the
         * processed transparent PNG.
         */
        let originalJimnyPhotoURL = "";

        if (jimnyPhotoUri) {
          const originalStoragePath =
            `users/${user.uid}/passport/jimny-original.jpg`;

          originalJimnyPhotoURL =
            await uploadPhoto(
              jimnyPhotoUri,
              user.uid,
              "jimny-original.jpg"
            );

          const removeBackground =
            httpsCallable<
              {
                storagePath: string;
              },
              {
                processedPath: string;
              }
            >(
              functions,
              "removeJimnyBackground"
            );

          const processedResult =
            await removeBackground({
              storagePath:
                originalStoragePath,
            });

          const processedPath =
            processedResult.data
              ?.processedPath;

          if (!processedPath) {
            throw new Error(
              "The processed Jimny photo path was not returned."
            );
          }

          jimnyPhotoURL =
            await getDownloadURL(
              ref(
                storage,
                processedPath
              )
            );
        }

        const passportNumber =
          generatePassportNumber(
            user.uid
          );

        /*
         * CREATE PASSPORT
         *
         * Important:
         * We do NOT duplicate the user's
         * exact home address here.
         *
         * The address remains inside
         * privateUserData.
         */
        await setDoc(
          passportRef,
          {
            uid: user.uid,

            passportNumber,

            ownerName:
              ownerName.trim(),

            profilePhotoURL:
              finalProfilePhotoURL ||
              null,

            vehicle: {
              make: make.trim(),

              model:
                model.trim(),

              year:
                numericYear,

              colour:
                colour.trim(),

              nickname:
                vehicleNickname.trim() ||
                null,

              photoURL:
                jimnyPhotoURL ||
                null,

              originalPhotoURL:
                originalJimnyPhotoURL ||
                null,
            },

            stamps: [],

            stampCount: 0,

            firstAdventureAt:
              null,

            lastAdventureAt:
              null,

            createdAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp(),
          }
        );

        Alert.alert(
          "Passport created!",
          "Your Adventure Passport is ready for its first stamp.",
          [
            {
              text: "View Passport",

              onPress: () => {
                onCreatePassport?.();
              },
            },
          ]
        );
      } catch (error: any) {
        console.error(
          "Unable to create passport:",
          error
        );

        let message =
          "We couldn't create your passport. Please try again.";

        if (
          error?.code ===
          "permission-denied"
        ) {
          message =
            "Firebase couldn't save your passport. Please check the Firestore permissions.";
        }

        if (
          error?.code ===
          "storage/unauthorized"
        ) {
          message =
            "Firebase couldn't upload the photo. Please check the Storage permissions.";
        }

        if (
          typeof error?.code === "string" &&
          error.code.startsWith(
            "functions/"
          )
        ) {
          message =
            "We couldn't remove the Jimny photo background. Please try again.";
        }

        Alert.alert(
          "Unable to create passport",
          message
        );
      } finally {
        setIsCreating(false);
      }
    };

  const canCreatePassport =
    !isLoadingProfile &&
    !isCreating &&
    ownerName.trim().length >
      0 &&
    make.trim().length > 0 &&
    model.trim().length > 0 &&
    vehicleYear.trim()
      .length === 4 &&
    colour.trim().length > 0;

  const displayedProfilePhoto =
    profilePhotoUri ||
    existingProfilePhotoURL;

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
        <KeyboardAvoidingView
          style={
            styles.keyboardView
          }
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
                name="arrow-back"
                size={20}
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
              Create Passport
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
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={
              false
            }
          >
            <View
              style={
                styles.content
              }
            >
              {/* INTRO */}
              <View
                style={
                  styles.intro
                }
              >
                <Text
                  style={
                    styles.pageTitle
                  }
                >
                  Create your
                  Adventure Passport
                </Text>

                <Text
                  style={
                    styles.pageBody
                  }
                >
                  Your Jimny. Your
                  adventures. Your own
                  digital booklet. Set
                  it up before your
                  first side quest — no
                  stamp required.
                </Text>
              </View>

              {/* PROFILE INFO */}
              <View
                style={
                  styles.infoCard
                }
              >
                <MaterialIcons
                  name="person-search"
                  size={25}
                  color={
                    colors.green
                  }
                  style={
                    styles.infoIcon
                  }
                />

                <View
                  style={
                    styles.infoContent
                  }
                >
                  <Text
                    style={
                      styles.infoTitle
                    }
                  >
                    A head start from
                    My Profile
                  </Text>

                  <Text
                    style={
                      styles.infoBody
                    }
                  >
                    Your owner name,
                    home location and
                    saved profile photo
                    are reused from My
                    Profile.
                  </Text>
                </View>
              </View>

              {/* PASSPORT OWNER */}
              <View
                style={
                  styles.section
                }
              >
                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  PASSPORT OWNER
                </Text>

                <FieldLabel
                  label="Owner name"
                  requirement="Required"
                />

                <TextInput
                  value={ownerName}
                  onChangeText={
                    setOwnerName
                  }
                  placeholder={
                    isLoadingProfile
                      ? "Loading..."
                      : "Enter your name"
                  }
                  placeholderTextColor={
                    colors.textSecondary
                  }
                  style={
                    styles.input
                  }
                  autoCapitalize="words"
                  editable={
                    !isLoadingProfile &&
                    !isCreating
                  }
                />

                <Text
                  style={
                    styles.helperText
                  }
                >
                  From My Profile · Edit
                  if needed for your
                  passport.
                </Text>

                {/* HOME LOCATION */}
                <View
                  style={
                    styles.fieldSpacing
                  }
                >
                  <FieldLabel
                    label="Home location"
                    requirement="Optional"
                  />

                  <View
                    style={
                      styles.locationBox
                    }
                  >
                    <MaterialIcons
                      name="location-on"
                      size={19}
                      color={
                        colors.green
                      }
                    />

                    <Text
                      style={[
                        styles.locationText,
                        !homeLocation &&
                          styles.placeholder,
                      ]}
                    >
                      {isLoadingProfile
                        ? "Loading your saved location..."
                        : homeLocation ||
                          "No home location added"}
                    </Text>
                  </View>

                  <Text
                    style={
                      styles.helperText
                    }
                  >
                    From My Profile ·
                    Your exact address
                    remains private.
                  </Text>
                </View>

                {/* PROFILE PHOTO */}
                <Pressable
                  style={({
                    pressed,
                  }) => [
                    styles.photoCard,
                    pressed &&
                      styles.pressed,
                  ]}
                  onPress={() =>
                    pickPhoto(
                      "profile"
                    )
                  }
                  disabled={
                    isCreating
                  }
                >
                  {displayedProfilePhoto ? (
                    <Image
                      source={{
                        uri: displayedProfilePhoto,
                      }}
                      style={
                        styles.profilePhotoImage
                      }
                    />
                  ) : (
                    <View
                      style={
                        styles.profilePhotoPlaceholder
                      }
                    >
                      <MaterialIcons
                        name="person-outline"
                        size={29}
                        color={
                          colors.green
                        }
                      />
                    </View>
                  )}

                  <View
                    style={
                      styles.photoContent
                    }
                  >
                    <Text
                      style={
                        styles.photoTitle
                      }
                    >
                      Profile photo ·
                      Optional
                    </Text>

                    <Text
                      style={
                        styles.photoDescription
                      }
                    >
                      {displayedProfilePhoto
                        ? "Your current profile photo will be used on your passport."
                        : "No profile photo added yet. Upload one or add it later."}
                    </Text>

                    <Text
                      style={
                        styles.uploadText
                      }
                    >
                      {displayedProfilePhoto
                        ? "Change photo"
                        : "Upload photo"}
                    </Text>
                  </View>

                  <MaterialIcons
                    name="add"
                    size={24}
                    color={
                      colors.text
                    }
                  />
                </Pressable>
              </View>

              {/* YOUR JIMNY */}
              <View
                style={
                  styles.section
                }
              >
                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  YOUR JIMNY
                </Text>

                <Text
                  style={
                    styles.vehicleIntro
                  }
                >
                  These details identify
                  your vehicle in your
                  passport and on My
                  Profile.
                </Text>

                <View
                  style={
                    styles.twoColumnRow
                  }
                >
                  <View
                    style={
                      styles.halfField
                    }
                  >
                    <FieldLabel
                      label="Make"
                      requirement="Required"
                    />

                    <TextInput
                      value={make}
                      onChangeText={
                        setMake
                      }
                      placeholder="e.g. Suzuki"
                      placeholderTextColor={
                        colors.textSecondary
                      }
                      style={
                        styles.input
                      }
                      autoCapitalize="words"
                      editable={
                        !isCreating
                      }
                    />
                  </View>

                  <View
                    style={
                      styles.halfField
                    }
                  >
                    <FieldLabel
                      label="Model"
                      requirement="Required"
                    />

                    <TextInput
                      value={model}
                      onChangeText={
                        setModel
                      }
                      placeholder="e.g. Jimny GLX"
                      placeholderTextColor={
                        colors.textSecondary
                      }
                      style={
                        styles.input
                      }
                      autoCapitalize="words"
                      editable={
                        !isCreating
                      }
                    />
                  </View>
                </View>

                <View
                  style={
                    styles.twoColumnRow
                  }
                >
                  <View
                    style={
                      styles.halfField
                    }
                  >
                    <FieldLabel
                      label="Vehicle year"
                      requirement="Required"
                    />

                    <TextInput
                      value={
                        vehicleYear
                      }
                      onChangeText={(
                        value
                      ) =>
                        setVehicleYear(
                          value
                            .replace(
                              /[^0-9]/g,
                              ""
                            )
                            .slice(
                              0,
                              4
                            )
                        )
                      }
                      placeholder="YYYY"
                      placeholderTextColor={
                        colors.textSecondary
                      }
                      style={
                        styles.input
                      }
                      keyboardType="number-pad"
                      maxLength={4}
                      editable={
                        !isCreating
                      }
                    />
                  </View>

                  <View
                    style={
                      styles.halfField
                    }
                  >
                    <FieldLabel
                      label="Colour"
                      requirement="Required"
                    />

                    <TextInput
                      value={colour}
                      onChangeText={
                        setColour
                      }
                      placeholder="Enter colour"
                      placeholderTextColor={
                        colors.textSecondary
                      }
                      style={
                        styles.input
                      }
                      autoCapitalize="words"
                      editable={
                        !isCreating
                      }
                    />
                  </View>
                </View>

                <View
                  style={
                    styles.fullField
                  }
                >
                  <FieldLabel
                    label="Vehicle nickname"
                    requirement="Optional"
                  />

                  <TextInput
                    value={
                      vehicleNickname
                    }
                    onChangeText={
                      setVehicleNickname
                    }
                    placeholder="What do you call your Jimny?"
                    placeholderTextColor={
                      colors.textSecondary
                    }
                    style={
                      styles.input
                    }
                    autoCapitalize="words"
                    editable={
                      !isCreating
                    }
                  />

                  <Text
                    style={
                      styles.helperText
                    }
                  >
                    Shown as Vehicle
                    Name in your
                    passport.
                  </Text>
                </View>

                {/* JIMNY PHOTO */}
                <Pressable
                  style={({
                    pressed,
                  }) => [
                    styles.photoCard,
                    pressed &&
                      styles.pressed,
                  ]}
                  onPress={() =>
                    pickPhoto(
                      "jimny"
                    )
                  }
                  disabled={
                    isCreating
                  }
                >
                  {jimnyPhotoUri ? (
                    <Image
                      source={{
                        uri: jimnyPhotoUri,
                      }}
                      style={
                        styles.vehiclePhotoImage
                      }
                    />
                  ) : (
                    <View
                      style={
                        styles.vehiclePhotoPlaceholder
                      }
                    >
                      <MaterialIcons
                        name="directions-car"
                        size={26}
                        color={
                          colors.green
                        }
                      />
                    </View>
                  )}

                  <View
                    style={
                      styles.photoContent
                    }
                  >
                    <Text
                      style={
                        styles.photoTitle
                      }
                    >
                      Jimny photo ·
                      Optional
                    </Text>

                    <Text
                      style={
                        styles.photoDescription
                      }
                    >
                      {jimnyPhotoUri
                        ? "Your selected Jimny photo will be used on the passport identity page."
                        : "Add a clear photo of your Jimny directly from the side or directly from the front. Avoid angled photos. We’ll remove the background for a clean passport-style vehicle photo."}
                    </Text>

                    <Text
                      style={
                        styles.uploadText
                      }
                    >
                      {jimnyPhotoUri
                        ? "Change photo"
                        : "Upload photo"}
                    </Text>
                  </View>

                  <MaterialIcons
                    name="add"
                    size={24}
                    color={
                      colors.text
                    }
                  />
                </Pressable>

                <Text
                  style={
                    styles.photoNote
                  }
                >
                  Photos: JPG or PNG,
                  up to 10 MB each. Add
                  or change later.
                </Text>
              </View>

              {/* PASSPORT NUMBER */}
              <View
                style={
                  styles.passportNumberCard
                }
              >
                <Text
                  style={
                    styles.passportNumberTitle
                  }
                >
                  Your passport number
                  is on us
                </Text>

                <Text
                  style={
                    styles.passportNumberBody
                  }
                >
                  A digital passport
                  number and date of
                  issue are generated
                  when you create it.
                  Your booklet starts
                  with 0 stamps.
                </Text>
              </View>

              {/* CREATE */}
              <Pressable
                style={({
                  pressed,
                }) => [
                  styles.createButton,

                  !canCreatePassport &&
                    styles.createButtonDisabled,

                  pressed &&
                    canCreatePassport &&
                    styles.pressed,
                ]}
                disabled={
                  !canCreatePassport
                }
                onPress={
                  handleCreatePassport
                }
              >
                <Text
                  style={
                    styles.createButtonText
                  }
                >
                  {isCreating
                    ? "CREATING PASSPORT..."
                    : "CREATE PASSPORT"}
                </Text>
              </Pressable>

              <Text
                style={
                  styles.editLaterText
                }
              >
                You can edit your
                passport details and
                photos later.
              </Text>
            </View>

            <Image
              source={require("../../assets/images/footer-pattern.png")}
              style={
                styles.footerPattern
              }
              resizeMode="stretch"
            />
          </ScrollView>
        </KeyboardAvoidingView>

        {/* BOTTOM NAV */}
        <BottomNav selected="passport" onExplore={onExplore} onHibernate={onAdventures} onProfile={onProfile} />
      </View>
    </SafeAreaView>
  );
}

function FieldLabel({
  label,
  requirement,
}: {
  label: string;
  requirement:
    | "Required"
    | "Optional";
}) {
  return (
    <View
      style={styles.labelRow}
    >
      <Text
        style={styles.label}
      >
        {label}
      </Text>

      <Text
        style={
          styles.requirement
        }
      >
        {requirement}
      </Text>
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

    keyboardView: {
      flex: 1,
    },

    header: {
      height: 58,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal:
        spacing.medium,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        colors.divider,
    },

    headerSide: {
      width: 90,
      flexDirection: "row",
      alignItems: "center",
    },

    backText: {
      marginLeft: 4,
      fontFamily:
        fonts.regular,
      fontSize: 14,
      color: colors.text,
    },

    headerTitle: {
      flex: 1,
      fontFamily:
        fonts.extraBold,
      fontSize: 15,
      color: colors.red,
      textAlign: "center",
    },

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
      paddingHorizontal:
        spacing.medium,
      paddingTop: 25,
      paddingBottom: 24,
    },

    intro: {
      marginBottom: 23,
    },

    pageTitle: {
      fontFamily:
        fonts.extraBold,
      fontSize: 21,
      lineHeight: 27,
      color: colors.text,
      marginBottom: 5,
    },

    pageBody: {
      fontFamily:
        fonts.regular,
      fontSize: 12,
      lineHeight: 17,
      color:
        colors.textSecondary,
    },

    infoCard: {
      flexDirection: "row",
      borderWidth: 1,
      borderColor:
        colors.green,
      borderRadius: 4,
      paddingHorizontal: 11,
      paddingVertical: 12,
      marginBottom: 24,
    },

    infoIcon: {
      marginRight: 10,
      marginTop: 1,
    },

    infoContent: {
      flex: 1,
    },

    infoTitle: {
      fontFamily:
        fonts.extraBold,
      fontSize: 12,
      lineHeight: 16,
      color: colors.text,
      marginBottom: 4,
    },

    infoBody: {
      fontFamily:
        fonts.regular,
      fontSize: 11,
      lineHeight: 15,
      color:
        colors.textSecondary,
    },

    section: {
      marginBottom: 25,
    },

    sectionTitle: {
      fontFamily:
        fonts.extraBold,
      fontSize: 11,
      lineHeight: 15,
      color: colors.red,
      marginBottom: 15,
    },

    labelRow: {
      flexDirection: "row",
      alignItems: "baseline",
      marginBottom: 6,
    },

    label: {
      fontFamily:
        fonts.semiBold,
      fontSize: 11,
      color: colors.text,
    },

    requirement: {
      marginLeft: 6,
      fontFamily:
        fonts.regular,
      fontSize: 9,
      color:
        colors.textSecondary,
    },

    input: {
      width: "100%",
      minHeight: 46,
      borderWidth: 1,
      borderColor:
        colors.orange,
      borderRadius: 4,
      paddingHorizontal: 11,
      paddingVertical: 10,
      fontFamily:
        fonts.regular,
      fontSize: 13,
      color: colors.text,
      backgroundColor:
        colors.background,
    },

    helperText: {
      marginTop: 6,
      fontFamily:
        fonts.regular,
      fontSize: 9,
      lineHeight: 13,
      color:
        colors.textSecondary,
    },

    fieldSpacing: {
      marginTop: 14,
    },

    locationBox: {
      width: "100%",
      minHeight: 46,
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor:
        colors.orange,
      borderRadius: 4,
      paddingHorizontal: 11,
      paddingVertical: 10,
      backgroundColor:
        colors.background,
    },

    locationText: {
      flex: 1,
      marginLeft: 7,
      fontFamily:
        fonts.regular,
      fontSize: 12,
      lineHeight: 17,
      color: colors.text,
    },

    placeholder: {
      color:
        colors.textSecondary,
    },

    photoCard: {
      width: "100%",
      minHeight: 92,
      flexDirection: "row",
      alignItems: "center",
      marginTop: 14,
      padding: 11,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor:
        colors.orange,
      borderRadius: 4,
    },

    profilePhotoPlaceholder: {
      width: 64,
      height: 64,
      alignItems: "center",
      justifyContent:
        "center",
      borderRadius: 32,
      backgroundColor:
        "#F2EBDD",
    },

    profilePhotoImage: {
      width: 64,
      height: 64,
      borderRadius: 32,
    },

    vehiclePhotoPlaceholder: {
      width: 64,
      height: 64,
      alignItems: "center",
      justifyContent:
        "center",
      borderRadius: 3,
      backgroundColor:
        "#F2EBDD",
    },

    vehiclePhotoImage: {
      width: 64,
      height: 64,
      borderRadius: 3,
    },

    photoContent: {
      flex: 1,
      paddingHorizontal: 11,
    },

    photoTitle: {
      fontFamily:
        fonts.extraBold,
      fontSize: 11,
      color: colors.text,
      marginBottom: 4,
    },

    photoDescription: {
      fontFamily:
        fonts.regular,
      fontSize: 9,
      lineHeight: 13,
      color:
        colors.textSecondary,
    },

    uploadText: {
      alignSelf:
        "flex-start",
      marginTop: 4,
      fontFamily:
        fonts.semiBold,
      fontSize: 10,
      color: colors.text,
      textDecorationLine:
        "underline",
    },

    photoNote: {
      marginTop: 12,
      fontFamily:
        fonts.regular,
      fontSize: 9,
      lineHeight: 13,
      color:
        colors.textSecondary,
    },

    vehicleIntro: {
      marginTop: 1,
      marginBottom: 14,
      fontFamily:
        fonts.regular,
      fontSize: 10,
      lineHeight: 15,
      color:
        colors.textSecondary,
    },

    twoColumnRow: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 14,
    },

    halfField: {
      flex: 1,
      minWidth: 0,
    },

    fullField: {
      width: "100%",
    },

    passportNumberCard: {
      borderWidth: 1,
      borderColor:
        colors.green,
      borderRadius: 4,
      padding: 13,
      marginBottom: 24,
    },

    passportNumberTitle: {
      fontFamily:
        fonts.extraBold,
      fontSize: 11,
      color: colors.text,
      marginBottom: 6,
    },

    passportNumberBody: {
      fontFamily:
        fonts.regular,
      fontSize: 10,
      lineHeight: 15,
      color:
        colors.textSecondary,
    },

    createButton: {
      width: "100%",
      minHeight: 47,
      alignItems: "center",
      justifyContent:
        "center",
      borderRadius: 4,
      backgroundColor:
        colors.green,

      shadowColor: "#000000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.17,
      shadowRadius: 3,
      elevation: 3,
    },

    createButtonDisabled: {
      opacity: 0.55,
    },

    createButtonText: {
      fontFamily:
        fonts.extraBold,
      fontSize: 13,
      color: colors.white,
    },

    editLaterText: {
      marginTop: 24,
      textAlign: "center",
      fontFamily:
        fonts.regular,
      fontSize: 9,
      color:
        colors.textSecondary,
    },

    footerPattern: {
      width: "100%",
      height: 27,
    },

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

    pressed: {
      opacity: 0.82,
    },
  });