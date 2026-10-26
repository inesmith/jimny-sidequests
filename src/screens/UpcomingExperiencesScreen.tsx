import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import BottomNav from "../components/BottomNav";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
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

import type { Experience } from "./ExperienceDetailsScreen";

type UpcomingExperiencesScreenProps = {
  onBack: () => void;
  onExplore: () => void;
  onAdventures: () => void;
  onPassport: () => void;
  onProfile: () => void;
  onExperiencePress: (
    experience: Experience
  ) => void;
};

type PlacePrediction = {
  placeId: string;
  mainText: string;
  secondaryText: string;
};

type ExperienceLocation = {
  placeId: string;
  formattedAddress: string;
  latitude: number | null;
  longitude: number | null;
};

/*
 * PRESET EXPERIENCES
 */
const experiences: Experience[] = [
  {
    id: "franschhoek-coffee-cruise",
    title: "Franschhoek Coffee Cruise",
    category: "Coffee Meet-up",
    date: "12 Oct 2026",
    eventDate: "2026-10-12",
    time: "09:00",
    location: "Franschhoek, Western Cape",
    description:
      "Join fellow owners for a morning mountain pass cruise followed by artisanal coffee.",
  },
  {
    id: "baviaanskloof-weekend",
    title: "Baviaanskloof Weekend",
    category: "Camping Weekend",
    date: "25–27 Oct 2026",
    eventDate: "2026-10-25",
    time: "14:00",
    location: "Eastern Cape",
    description:
      "A legendary 4×4 route through wilderness campsites, rivers, and technical tracks.",
  },
  {
    id: "elgin-valley-convoy",
    title: "Elgin Valley Convoy",
    category: "Casual Convoy",
    date: "8 Nov 2026",
    eventDate: "2026-11-08",
    time: "10:00",
    location: "Elgin, Western Cape",
    description:
      "An easy-going vineyard-to-orchard group drive designed for GL and GLX models alike.",
  },
  {
    id: "cederberg-off-road-day",
    title: "Cederberg Off-Road Day",
    category: "Off-Road Day",
    date: "22 Nov 2026",
    eventDate: "2026-11-22",
    time: "08:00",
    location: "Cederberg, Western Cape",
    description:
      "Test your crawl ratios on rocky trails with experienced marshals to guide you.",
  },
];

export default function UpcomingExperiencesScreen({
  onBack,
  onExplore,
  onAdventures,
  onPassport,
  onProfile,
  onExperiencePress,
}: UpcomingExperiencesScreenProps) {
  /*
   * COMMUNITY EXPERIENCES
   */
  const [
    communityExperiences,
    setCommunityExperiences,
  ] = useState<Experience[]>([]);

  const [
    isLoadingExperiences,
    setIsLoadingExperiences,
  ] = useState(true);

  /*
   * CREATE EXPERIENCE FORM
   */
  const [
    experienceName,
    setExperienceName,
  ] = useState("");

  const [
    experienceCategory,
    setExperienceCategory,
  ] = useState("");

  const [
    experienceDescription,
    setExperienceDescription,
  ] = useState("");

  /*
   * DATE + TIME
   */
  const [
    selectedDate,
    setSelectedDate,
  ] = useState<Date | null>(null);

  const [
    selectedTime,
    setSelectedTime,
  ] = useState<Date | null>(null);

  const [
    showDatePicker,
    setShowDatePicker,
  ] = useState(false);

  const [
    showTimePicker,
    setShowTimePicker,
  ] = useState(false);

  /*
   * LOCATION
   */
  const [
    locationQuery,
    setLocationQuery,
  ] = useState("");

  const [
    locationPredictions,
    setLocationPredictions,
  ] = useState<PlacePrediction[]>([]);

  const [
    selectedLocation,
    setSelectedLocation,
  ] = useState<ExperienceLocation | null>(
    null
  );

  const [
    isSearchingLocation,
    setIsSearchingLocation,
  ] = useState(false);

  const [
    isSelectingLocation,
    setIsSelectingLocation,
  ] = useState(false);

  const locationRequestId =
    useRef(0);

  const [
    isCreating,
    setIsCreating,
  ] = useState(false);

  const googlePlacesApiKey =
    process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;

  /*
   * LOAD COMMUNITY EXPERIENCES
   */
  const loadCommunityExperiences =
    async () => {
      try {
        setIsLoadingExperiences(
          true
        );

        const experiencesQuery =
          query(
            collection(
              db,
              "experiences"
            ),
            orderBy(
              "createdAt",
              "desc"
            )
          );

        const snapshot =
          await getDocs(
            experiencesQuery
          );

        const loadedExperiences: Experience[] =
          snapshot.docs.map(
            (experienceDoc) => {
              const data =
                experienceDoc.data();

              return {
                id:
                  experienceDoc.id,

                title:
                  data.title ?? "",

                category:
                  data.category ?? "",

                date:
                  data.date ?? "",

                eventDate:
                  data.eventDate ?? "",

                time:
                  data.time ??
                  "To be confirmed",

                location:
                  data.location
                    ?.formattedAddress ??
                  data.location ??
                  "",

                description:
                  data.description ?? "",

                locationPlaceId:
                  data.location
                    ?.placeId ?? null,

                latitude:
                  data.location
                    ?.latitude ?? null,

                longitude:
                  data.location
                    ?.longitude ?? null,
              };
            }
          );

        setCommunityExperiences(
          loadedExperiences
        );
      } catch (error) {
        console.error(
          "Unable to load community experiences:",
          error
        );
      } finally {
        setIsLoadingExperiences(
          false
        );
      }
    };

  useEffect(() => {
    loadCommunityExperiences();
  }, []);

  /*
   * GOOGLE LOCATION AUTOCOMPLETE
   */
  useEffect(() => {
    const searchText =
      locationQuery.trim();

    if (
      selectedLocation &&
      searchText ===
        selectedLocation.formattedAddress
    ) {
      setLocationPredictions(
        []
      );

      setIsSearchingLocation(
        false
      );

      return;
    }

    if (
      searchText.length < 3
    ) {
      setLocationPredictions(
        []
      );

      setIsSearchingLocation(
        false
      );

      return;
    }

    const requestId =
      ++locationRequestId.current;

    const timer = setTimeout(
      async () => {
        if (
          !googlePlacesApiKey
        ) {
          console.error(
            "Missing EXPO_PUBLIC_GOOGLE_PLACES_API_KEY"
          );

          return;
        }

        setIsSearchingLocation(
          true
        );

        try {
          const response =
            await fetch(
              "https://places.googleapis.com/v1/places:autocomplete",
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json",

                  "X-Goog-Api-Key":
                    googlePlacesApiKey,

                  "X-Goog-FieldMask":
                    "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
                },

                body:
                  JSON.stringify(
                    {
                      input:
                        searchText,

                      includedRegionCodes:
                        ["za"],
                    }
                  ),
              }
            );

          if (
            !response.ok
          ) {
            const errorText =
              await response.text();

            throw new Error(
              `Places autocomplete failed: ${response.status} ${errorText}`
            );
          }

          const data =
            await response.json();

          if (
            requestId !==
            locationRequestId.current
          ) {
            return;
          }

          const predictions: PlacePrediction[] =
            (
              data.suggestions ??
              []
            )
              .map(
                (
                  suggestion: any
                ) => {
                  const prediction =
                    suggestion.placePrediction;

                  if (
                    !prediction?.placeId
                  ) {
                    return null;
                  }

                  return {
                    placeId:
                      prediction.placeId,

                    mainText:
                      prediction
                        .structuredFormat
                        ?.mainText
                        ?.text ??
                      prediction.text
                        ?.text ??
                      "",

                    secondaryText:
                      prediction
                        .structuredFormat
                        ?.secondaryText
                        ?.text ??
                      "",
                  };
                }
              )
              .filter(
                Boolean
              ) as PlacePrediction[];

          setLocationPredictions(
            predictions
          );
        } catch (error) {
          console.error(
            "Places autocomplete error:",
            error
          );

          if (
            requestId ===
            locationRequestId.current
          ) {
            setLocationPredictions(
              []
            );
          }
        } finally {
          if (
            requestId ===
            locationRequestId.current
          ) {
            setIsSearchingLocation(
              false
            );
          }
        }
      },
      400
    );

    return () =>
      clearTimeout(timer);
  }, [
    locationQuery,
    selectedLocation,
    googlePlacesApiKey,
  ]);

  /*
   * SELECT GOOGLE LOCATION
   */
  const selectLocation =
    async (
      prediction: PlacePrediction
    ) => {
      if (
        !googlePlacesApiKey ||
        isSelectingLocation
      ) {
        return;
      }

      setIsSelectingLocation(
        true
      );

      setLocationPredictions(
        []
      );

      try {
        const response =
          await fetch(
            `https://places.googleapis.com/v1/places/${encodeURIComponent(
              prediction.placeId
            )}`,
            {
              headers: {
                "X-Goog-Api-Key":
                  googlePlacesApiKey,

                "X-Goog-FieldMask":
                  "id,formattedAddress,location",
              },
            }
          );

        if (
          !response.ok
        ) {
          const errorText =
            await response.text();

          throw new Error(
            `Place details failed: ${response.status} ${errorText}`
          );
        }

        const place =
          await response.json();

        const location: ExperienceLocation =
          {
            placeId:
              place.id ??
              prediction.placeId,

            formattedAddress:
              place.formattedAddress ??
              [
                prediction.mainText,
                prediction.secondaryText,
              ]
                .filter(Boolean)
                .join(", "),

            latitude:
              typeof place
                .location
                ?.latitude ===
              "number"
                ? place.location
                    .latitude
                : null,

            longitude:
              typeof place
                .location
                ?.longitude ===
              "number"
                ? place.location
                    .longitude
                : null,
          };

        setSelectedLocation(
          location
        );

        setLocationQuery(
          location.formattedAddress
        );
      } catch (error) {
        console.error(
          "Place details error:",
          error
        );

        Alert.alert(
          "Couldn't select location",
          "We couldn't load that location. Please try selecting it again."
        );
      } finally {
        setIsSelectingLocation(
          false
        );
      }
    };

  const handleLocationQueryChange =
    (text: string) => {
      setLocationQuery(text);

      if (
        selectedLocation &&
        text !==
          selectedLocation.formattedAddress
      ) {
        setSelectedLocation(
          null
        );
      }
    };

  /*
   * DATE
   */
  const handleDateChange = (
    event: DateTimePickerEvent,
    date?: Date
  ) => {
    if (
      Platform.OS ===
      "android"
    ) {
      setShowDatePicker(
        false
      );
    }

    if (
      event.type ===
        "dismissed" ||
      !date
    ) {
      return;
    }

    setSelectedDate(date);
  };

  /*
   * TIME
   */
  const handleTimeChange = (
    event: DateTimePickerEvent,
    time?: Date
  ) => {
    if (
      Platform.OS ===
      "android"
    ) {
      setShowTimePicker(
        false
      );
    }

    if (
      event.type ===
        "dismissed" ||
      !time
    ) {
      return;
    }

    setSelectedTime(time);
  };

  /*
   * SHARE
   */
  const shareExperience =
    async (
      experience: Experience
    ) => {
      try {
        await Share.share({
          message:
            `${experience.title}\n` +
            `${experience.date}\n` +
            `${experience.time ?? ""}\n` +
            `${experience.location}\n\n` +
            `${experience.description}\n\n` +
            "Join me for this Jimny experience!",
        });
      } catch (error) {
        console.error(
          "Unable to share experience:",
          error
        );
      }
    };

  /*
   * CREATE EXPERIENCE
   */
  const createExperience =
    async () => {
      const user =
        auth.currentUser;

      if (!user) {
        Alert.alert(
          "Sign in required",
          "Please sign in before creating an experience."
        );

        return;
      }

      const trimmedName =
        experienceName.trim();

      const trimmedCategory =
        experienceCategory.trim();

      const trimmedDescription =
        experienceDescription.trim();

      if (!trimmedName) {
        Alert.alert(
          "Experience name",
          "Please enter a name for your experience."
        );

        return;
      }

      if (!trimmedCategory) {
        Alert.alert(
          "Experience type",
          "Please enter the type of experience."
        );

        return;
      }

      if (!selectedDate) {
        Alert.alert(
          "Experience date",
          "Please select the date of your experience."
        );

        return;
      }

      if (!selectedTime) {
        Alert.alert(
          "Experience time",
          "Please select the starting time of your experience."
        );

        return;
      }

      if (!selectedLocation) {
        Alert.alert(
          "Location",
          "Please select a location from the search results."
        );

        return;
      }

      if (
        !trimmedDescription
      ) {
        Alert.alert(
          "Description",
          "Please tell the community a little about the experience."
        );

        return;
      }

      try {
        setIsCreating(true);

        let creatorName =
          user.displayName ||
          "Jimny Owner";

        const profileSnapshot =
          await getDoc(
            doc(
              db,
              "users",
              user.uid
            )
          );

        if (
          profileSnapshot.exists()
        ) {
          const profileData =
            profileSnapshot.data();

          if (
            profileData.fullName
          ) {
            creatorName =
              profileData.fullName;
          }
        }

        const formattedDate =
          formatDate(
            selectedDate
          );

        const formattedTime =
          formatTime(
            selectedTime
          );

        await addDoc(
          collection(
            db,
            "experiences"
          ),
          {
            title:
              trimmedName,

            category:
              trimmedCategory,

            date:
              formattedDate,

            time:
              formattedTime,

            eventDate:
              toLocalDateKey(
                selectedDate
              ),

            eventTime:
              formattedTime,

            location: {
              placeId:
                selectedLocation.placeId,

              formattedAddress:
                selectedLocation.formattedAddress,

              latitude:
                selectedLocation.latitude,

              longitude:
                selectedLocation.longitude,
            },

            description:
              trimmedDescription,

            createdBy:
              user.uid,

            createdByName:
              creatorName,

            status:
              "upcoming",

            source:
              "community",

            createdAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp(),
          }
        );

        /*
         * CLEAR FORM
         */
        setExperienceName(
          ""
        );

        setExperienceCategory(
          ""
        );

        setSelectedDate(
          null
        );

        setSelectedTime(
          null
        );

        setLocationQuery(
          ""
        );

        setSelectedLocation(
          null
        );

        setLocationPredictions(
          []
        );

        setExperienceDescription(
          ""
        );

        /*
         * RELOAD EXPERIENCES
         */
        await loadCommunityExperiences();

        Alert.alert(
          "Experience created",
          "Your experience has been added to Upcoming Experiences."
        );
      } catch (error) {
        console.error(
          "Unable to create experience:",
          error
        );

        Alert.alert(
          "Couldn't create experience",
          "We couldn't save your experience. Please try again."
        );
      } finally {
        setIsCreating(
          false
        );
      }
    };

  /*
   * COMBINE + SORT
   *
   * Preset and community experiences
   * become one chronological list.
   */
  const allExperiences = [
    ...experiences,
    ...communityExperiences,
  ]
    .filter(
      (experience) => {
        if (
          !experience.eventDate
        ) {
          return true;
        }

        const today =
          new Date();

        today.setHours(
          0,
          0,
          0,
          0
        );

        const experienceDate =
          new Date(
            `${experience.eventDate}T00:00:00`
          );

        return (
          experienceDate >=
          today
        );
      }
    )
    .sort((a, b) => {
      if (
        !a.eventDate &&
        !b.eventDate
      ) {
        return 0;
      }

      if (!a.eventDate) {
        return 1;
      }

      if (!b.eventDate) {
        return -1;
      }

      const dateComparison =
        a.eventDate.localeCompare(
          b.eventDate
        );

      /*
       * If two experiences are on
       * the same date, sort them
       * by time.
       */
      if (
        dateComparison === 0
      ) {
        return (
          a.time ?? ""
        ).localeCompare(
          b.time ?? ""
        );
      }

      return dateComparison;
    });

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={[
        "top",
        "bottom",
      ]}
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
        <View
          style={styles.screen}
        >
          {/* HEADER */}
          <View
            style={styles.header}
          >
            <Pressable
              style={
                styles.backButton
              }
              onPress={onBack}
              hitSlop={10}
            >
              <MaterialIcons
                name="arrow-back"
                size={22}
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
              Experiences
            </Text>

            <Pressable
              style={
                styles.headerMenu
              }
              hitSlop={10}
            >
              <MaterialIcons
                name="more-horiz"
                size={26}
                color={
                  colors.text
                }
              />
            </Pressable>
          </View>

          {/* CONTENT */}
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
            bounces={false}
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
                  Upcoming Experiences
                </Text>

                <Text
                  style={
                    styles.pageSubtitle
                  }
                >
                  Year-round Jimny
                  adventures.
                </Text>
              </View>

              {/* EXPERIENCES */}
              <View
                style={
                  styles.experienceList
                }
              >
                {isLoadingExperiences ? (
                  <View
                    style={
                      styles.loadingExperiences
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
                        styles.loadingExperiencesText
                      }
                    >
                      Loading community
                      experiences...
                    </Text>
                  </View>
                ) : (
                  allExperiences.map(
                    (
                      experience
                    ) => (
                      <ExperienceCard
                        key={
                          experience.id
                        }
                        experience={
                          experience
                        }
                        onLearnMore={() =>
                          onExperiencePress(
                            experience
                          )
                        }
                        onShare={() =>
                          shareExperience(
                            experience
                          )
                        }
                      />
                    )
                  )
                )}
              </View>

              {/* CREATE EXPERIENCE */}
              <View
                style={
                  styles.createSection
                }
              >
                <Text
                  style={
                    styles.createSectionLabel
                  }
                >
                  CREATE AN EXPERIENCE
                </Text>

                <Text
                  style={
                    styles.createTitle
                  }
                >
                  Plan something for
                  the community.
                </Text>

                <Text
                  style={
                    styles.createDescription
                  }
                >
                  Planning a Jimny
                  adventure? Invite the
                  community along.
                </Text>

                <View
                  style={
                    styles.createCard
                  }
                >
                  {/* NAME */}
                  <FormLabel text="EXPERIENCE NAME" />

                  <TextInput
                    style={
                      styles.input
                    }
                    value={
                      experienceName
                    }
                    onChangeText={(
                      text
                    ) =>
                      setExperienceName(
                        toTitleCase(
                          text
                        )
                      )
                    }
                    placeholder="e.g. Sunday Mountain Cruise"
                    placeholderTextColor="#A7AFBC"
                    autoCapitalize="words"
                    editable={
                      !isCreating
                    }
                  />

                  {/* TYPE */}
                  <FormLabel text="EXPERIENCE TYPE" />

                  <TextInput
                    style={
                      styles.input
                    }
                    value={
                      experienceCategory
                    }
                    onChangeText={(
                      text
                    ) =>
                      setExperienceCategory(
                        toTitleCase(
                          text
                        )
                      )
                    }
                    placeholder="e.g. Casual Convoy"
                    placeholderTextColor="#A7AFBC"
                    autoCapitalize="words"
                    editable={
                      !isCreating
                    }
                  />

                  {/* DATE */}
                  <FormLabel text="DATE" />

                  <Pressable
                    style={({
                      pressed,
                    }) => [
                      styles.selector,
                      pressed &&
                        styles.pressed,
                    ]}
                    onPress={() =>
                      setShowDatePicker(
                        (
                          current
                        ) =>
                          !current
                      )
                    }
                    disabled={
                      isCreating
                    }
                  >
                    <MaterialIcons
                      name="calendar-month"
                      size={20}
                      color={
                        colors.orange
                      }
                    />

                    <Text
                      style={[
                        styles.selectorText,
                        !selectedDate &&
                          styles.placeholderText,
                      ]}
                    >
                      {selectedDate
                        ? formatDate(
                            selectedDate
                          )
                        : "Select a date"}
                    </Text>

                    <MaterialIcons
                      name="keyboard-arrow-down"
                      size={23}
                      color={
                        colors.text
                      }
                    />
                  </Pressable>

                  {showDatePicker && (
                    <View
                      style={
                        styles.pickerWrap
                      }
                    >
                      <DateTimePicker
                        value={
                          selectedDate ??
                          new Date()
                        }
                        mode="date"
                        minimumDate={
                          new Date()
                        }
                        display={
                          Platform.OS ===
                          "ios"
                            ? "inline"
                            : "default"
                        }
                        onChange={
                          handleDateChange
                        }
                      />

                      {Platform.OS ===
                        "ios" && (
                        <Pressable
                          style={
                            styles.pickerDone
                          }
                          onPress={() =>
                            setShowDatePicker(
                              false
                            )
                          }
                        >
                          <Text
                            style={
                              styles.pickerDoneText
                            }
                          >
                            DONE
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  )}

                  {/* TIME */}
                  <FormLabel text="TIME" />

                  <Pressable
                    style={({
                      pressed,
                    }) => [
                      styles.selector,
                      pressed &&
                        styles.pressed,
                    ]}
                    onPress={() =>
                      setShowTimePicker(
                        (
                          current
                        ) =>
                          !current
                      )
                    }
                    disabled={
                      isCreating
                    }
                  >
                    <MaterialIcons
                      name="schedule"
                      size={20}
                      color={
                        colors.orange
                      }
                    />

                    <Text
                      style={[
                        styles.selectorText,
                        !selectedTime &&
                          styles.placeholderText,
                      ]}
                    >
                      {selectedTime
                        ? formatTime(
                            selectedTime
                          )
                        : "Select a time"}
                    </Text>

                    <MaterialIcons
                      name="keyboard-arrow-down"
                      size={23}
                      color={
                        colors.text
                      }
                    />
                  </Pressable>

                  {showTimePicker && (
                    <View
                      style={
                        styles.pickerWrap
                      }
                    >
                      <DateTimePicker
                        value={
                          selectedTime ??
                          new Date()
                        }
                        mode="time"
                        is24Hour
                        display={
                          Platform.OS ===
                          "ios"
                            ? "spinner"
                            : "default"
                        }
                        onChange={
                          handleTimeChange
                        }
                      />

                      {Platform.OS ===
                        "ios" && (
                        <Pressable
                          style={
                            styles.pickerDone
                          }
                          onPress={() =>
                            setShowTimePicker(
                              false
                            )
                          }
                        >
                          <Text
                            style={
                              styles.pickerDoneText
                            }
                          >
                            DONE
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  )}

                  {/* LOCATION */}
                  <FormLabel text="LOCATION" />

                  <View
                    style={
                      styles.locationInputWrap
                    }
                  >
                    <MaterialIcons
                      name="location-on"
                      size={19}
                      color={
                        colors.textSecondary
                      }
                      style={
                        styles.locationIcon
                      }
                    />

                    <TextInput
                      value={
                        locationQuery
                      }
                      onChangeText={
                        handleLocationQueryChange
                      }
                      placeholder="Search for the meeting location"
                      placeholderTextColor="#A7AFBC"
                      autoCapitalize="words"
                      autoCorrect={
                        false
                      }
                      style={
                        styles.locationTextInput
                      }
                      returnKeyType="search"
                      editable={
                        !isCreating
                      }
                    />

                    {(isSearchingLocation ||
                      isSelectingLocation) && (
                      <ActivityIndicator
                        size="small"
                        color={
                          colors.green
                        }
                      />
                    )}

                    {locationQuery.length >
                      0 &&
                      !isSearchingLocation &&
                      !isSelectingLocation && (
                        <Pressable
                          hitSlop={
                            8
                          }
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
                        >
                          <MaterialIcons
                            name="close"
                            size={
                              18
                            }
                            color={
                              colors.textSecondary
                            }
                          />
                        </Pressable>
                      )}
                  </View>

                  {locationPredictions.length >
                    0 && (
                    <View
                      style={
                        styles.predictionsBox
                      }
                    >
                      {locationPredictions.map(
                        (
                          prediction,
                          index
                        ) => (
                          <Pressable
                            key={
                              prediction.placeId
                            }
                            style={[
                              styles.predictionRow,
                              index <
                                locationPredictions.length -
                                  1 &&
                                styles.predictionDivider,
                            ]}
                            onPress={() =>
                              selectLocation(
                                prediction
                              )
                            }
                          >
                            <MaterialIcons
                              name="place"
                              size={
                                18
                              }
                              color={
                                colors.orange
                              }
                              style={
                                styles.predictionIcon
                              }
                            />

                            <View
                              style={
                                styles.predictionTextWrap
                              }
                            >
                              <Text
                                style={
                                  styles.predictionMainText
                                }
                                numberOfLines={
                                  1
                                }
                              >
                                {
                                  prediction.mainText
                                }
                              </Text>

                              {!!prediction.secondaryText && (
                                <Text
                                  style={
                                    styles.predictionSecondaryText
                                  }
                                  numberOfLines={
                                    2
                                  }
                                >
                                  {
                                    prediction.secondaryText
                                  }
                                </Text>
                              )}
                            </View>
                          </Pressable>
                        )
                      )}

                      <Text
                        style={
                          styles.googleAttribution
                        }
                      >
                        Google
                      </Text>
                    </View>
                  )}

                  {selectedLocation && (
                    <View
                      style={
                        styles.selectedLocationRow
                      }
                    >
                      <MaterialIcons
                        name="check-circle"
                        size={15}
                        color={
                          colors.green
                        }
                      />

                      <Text
                        style={
                          styles.selectedLocationText
                        }
                      >
                        Location selected
                      </Text>
                    </View>
                  )}

                  {/* DESCRIPTION */}
                  <FormLabel text="DESCRIPTION" />

                  <TextInput
                    style={[
                      styles.input,
                      styles.descriptionInput,
                    ]}
                    value={
                      experienceDescription
                    }
                    onChangeText={
                      setExperienceDescription
                    }
                    placeholder="Tell the community what you're planning..."
                    placeholderTextColor="#A7AFBC"
                    autoCapitalize="sentences"
                    multiline
                    textAlignVertical="top"
                    editable={
                      !isCreating
                    }
                  />

                  {/* CREATE */}
                  <Pressable
                    style={({
                      pressed,
                    }) => [
                      styles.createButton,
                      isCreating &&
                        styles.createButtonDisabled,
                      pressed &&
                        !isCreating &&
                        styles.pressed,
                    ]}
                    onPress={
                      createExperience
                    }
                    disabled={
                      isCreating
                    }
                  >
                    {isCreating ? (
                      <ActivityIndicator
                        size="small"
                        color={
                          colors.white
                        }
                      />
                    ) : (
                      <>
                        <MaterialIcons
                          name="add"
                          size={20}
                          color={
                            colors.white
                          }
                        />

                        <Text
                          style={
                            styles.createButtonText
                          }
                        >
                          CREATE EXPERIENCE
                        </Text>
                      </>
                    )}
                  </Pressable>

                  <Text
                    style={
                      styles.createHint
                    }
                  >
                    Your experience
                    will appear in
                    Upcoming Experiences
                    for other Jimny
                    owners to discover
                    and register.
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* BOTTOM NAVIGATION */}
          <BottomNav
            selected="explore"
            onExplore={onExplore}
            onHibernate={onAdventures}
            onPassport={onPassport}
            onProfile={onProfile}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/*
 * FORM LABEL
 */
function FormLabel({
  text,
}: {
  text: string;
}) {
  return (
    <Text
      style={
        styles.fieldLabel
      }
    >
      {text}
    </Text>
  );
}

/*
 * EXPERIENCE CARD
 */
function ExperienceCard({
  experience,
  onLearnMore,
  onShare,
}: {
  experience: Experience;
  onLearnMore: () => void;
  onShare: () => void;
}) {
  return (
    <View
      style={
        styles.experienceCard
      }
    >
      <View
        style={
          styles.imagePlaceholder
        }
      >
        <MaterialIcons
          name="image"
          size={35}
          color={
            colors.textSecondary
          }
        />

        <Text
          style={
            styles.imagePlaceholderText
          }
        >
          EXPERIENCE IMAGE
        </Text>
      </View>

      <View
        style={
          styles.cardContent
        }
      >
        <View
          style={
            styles.cardTitleRow
          }
        >
          <Text
            style={
              styles.cardTitle
            }
            numberOfLines={2}
          >
            {experience.title}
          </Text>

          <View
            style={
              styles.categoryTag
            }
          >
            <Text
              style={
                styles.categoryTagText
              }
              numberOfLines={1}
            >
              {experience.category}
            </Text>
          </View>
        </View>

        <View
          style={
            styles.detailsRow
          }
        >
          <Text
            style={
              styles.dateText
            }
          >
            {experience.date}
          </Text>

          <Text
            style={
              styles.timeText
            }
          >
            {experience.time ??
              "Time TBC"}
          </Text>
        </View>

        <View
          style={
            styles.locationRow
          }
        >
          <MaterialIcons
            name="location-on"
            size={14}
            color={
              colors.textSecondary
            }
          />

          <Text
            style={
              styles.locationText
            }
            numberOfLines={2}
          >
            {experience.location}
          </Text>
        </View>

        <Text
          style={
            styles.description
          }
        >
          {experience.description}
        </Text>

        <Pressable
          style={({
            pressed,
          }) => [
            styles.learnMoreButton,
            pressed &&
              styles.pressed,
          ]}
          onPress={
            onLearnMore
          }
        >
          <Text
            style={
              styles.learnMoreText
            }
          >
            Learn More
          </Text>

          <MaterialIcons
            name="arrow-outward"
            size={13}
            color={
              colors.text
            }
          />
        </Pressable>

        <View
          style={
            styles.shareRow
          }
        >
          <Pressable
            style={({
              pressed,
            }) => [
              styles.shareButton,
              pressed &&
                styles.pressed,
            ]}
            onPress={onShare}
          >
            <MaterialIcons
              name="ios-share"
              size={19}
              color={
                colors.red
              }
            />

            <Text
              style={
                styles.shareButtonText
              }
            >
              Share with friends
            </Text>
          </Pressable>

          <Text
            style={
              styles.shareHint
            }
            numberOfLines={2}
          >
            Invite friends to
            register too
          </Text>
        </View>
      </View>
    </View>
  );
}

/*
 * TITLE CASE
 *
 * Example:
 * "sunday mountain cruise"
 * becomes
 * "Sunday Mountain Cruise"
 */
function toTitleCase(
  text: string
) {
  return text.replace(
    /\b\w/g,
    (letter) =>
      letter.toUpperCase()
  );
}

/*
 * DISPLAY DATE
 */
function formatDate(
  date: Date
) {
  return new Intl.DateTimeFormat(
    "en-ZA",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  ).format(date);
}

/*
 * DISPLAY TIME
 */
function formatTime(
  date: Date
) {
  return new Intl.DateTimeFormat(
    "en-ZA",
    {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  ).format(date);
}

/*
 * FIRESTORE / SORTING DATE
 *
 * Example:
 * 12 October 2026
 * becomes
 * 2026-10-12
 */
function toLocalDateKey(
  date: Date
) {
  const year =
    date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(
    2,
    "0"
  );

  const day = String(
    date.getDate()
  ).padStart(
    2,
    "0"
  );

  return `${year}-${month}-${day}`;
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        colors.background,
    },

    keyboardView: {
      flex: 1,
    },

    screen: {
      flex: 1,
      backgroundColor:
        colors.background,
    },

    header: {
      minHeight: 92,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal:
        spacing.screen,
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        colors.divider,
    },

    backButton: {
      width: 105,
      height: 44,
      flexDirection: "row",
      alignItems: "center",
    },

    backText: {
      marginLeft: 6,
      fontFamily:
        fonts.regular,
      fontSize: 16,
      color: colors.text,
    },

    headerTitle: {
      flex: 1,
      textAlign: "center",
      fontFamily:
        fonts.extraBold,
      fontSize: 16,
      lineHeight: 23,
      color: colors.red,
    },

    headerMenu: {
      width: 105,
      height: 44,
      alignItems: "flex-end",
      justifyContent:
        "center",
    },

    scrollView: {
      flex: 1,
    },

    scrollContent: {
      paddingBottom: 26,
    },

    content: {
      width: "100%",
      maxWidth: 520,
      alignSelf: "center",
      paddingHorizontal: 20,
      paddingTop: 23,
    },

    intro: {
      marginBottom: 25,
    },

    pageTitle: {
      fontFamily:
        fonts.extraBold,
      fontSize: 27,
      lineHeight: 33,
      color: colors.text,
    },

    pageSubtitle: {
      marginTop: 2,
      fontFamily:
        fonts.regular,
      fontSize: 17,
      lineHeight: 23,
      color:
        colors.textSecondary,
    },

    experienceList: {
      width: "100%",
      gap: 25,
    },

    experienceCard: {
      width: "100%",
      overflow: "hidden",
      borderWidth: 1.5,
      borderColor:
        colors.orange,
      borderRadius: 4,
      backgroundColor:
        colors.background,
      shadowColor:
        "#000000",
      shadowOffset: {
        width: 0,
        height: 3,
      },
      shadowOpacity: 0.16,
      shadowRadius: 4,
      elevation: 3,
    },

    imagePlaceholder: {
      width: "100%",
      aspectRatio: 2.25,
      alignItems: "center",
      justifyContent:
        "center",
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        colors.divider,
      backgroundColor:
        "#D9D9D9",
    },

    imagePlaceholderText: {
      marginTop: 5,
      fontFamily:
        fonts.semiBold,
      fontSize: 9,
      color:
        colors.textSecondary,
    },

    cardContent: {
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 18,
    },

    cardTitleRow: {
      flexDirection: "row",
      alignItems:
        "flex-start",
    },

    cardTitle: {
      flex: 1,
      minWidth: 0,
      paddingRight: 10,
      fontFamily:
        fonts.extraBold,
      fontSize: 18,
      lineHeight: 22,
      color: colors.text,
    },

    categoryTag: {
      flexShrink: 0,
      maxWidth: 130,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 2,
      backgroundColor:
        colors.green,
    },

    categoryTagText: {
      fontFamily:
        fonts.semiBold,
      fontSize: 10,
      color: colors.white,
    },

    detailsRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 10,
    },

    dateText: {
      flexShrink: 0,
      marginRight: 18,
      fontFamily:
        fonts.extraBold,
      fontSize: 13,
      color: colors.text,
    },

    timeText: {
      fontFamily:
        fonts.semiBold,
      fontSize: 13,
      color: colors.text,
    },

    locationRow: {
      flexDirection: "row",
      alignItems:
        "flex-start",
      marginTop: 5,
    },

    locationText: {
      flex: 1,
      marginLeft: 4,
      fontFamily:
        fonts.regular,
      fontSize: 13,
      lineHeight: 17,
      color:
        colors.textSecondary,
    },

    description: {
      marginTop: 11,
      fontFamily:
        fonts.regular,
      fontSize: 14,
      lineHeight: 19,
      color:
        colors.textSecondary,
    },

    learnMoreButton: {
      alignSelf:
        "flex-start",
      flexDirection: "row",
      alignItems: "center",
      marginTop: 14,
    },

    learnMoreText: {
      marginRight: 3,
      fontFamily:
        fonts.extraBold,
      fontSize: 14,
      color: colors.text,
    },

    shareRow: {
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      marginTop: 10,
    },

    shareButton: {
      flexShrink: 0,
      minHeight: 39,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "center",
      paddingHorizontal: 12,
      borderWidth: 1.5,
      borderColor: colors.red,
      borderRadius: 4,
      backgroundColor:
        colors.background,
      shadowColor:
        "#000000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.13,
      shadowRadius: 3,
      elevation: 2,
    },

    shareButtonText: {
      marginLeft: 7,
      fontFamily:
        fonts.semiBold,
      fontSize: 13,
      color: colors.red,
    },

    shareHint: {
      flex: 1,
      marginLeft: 10,
      fontFamily:
        fonts.regular,
      fontSize: 11,
      lineHeight: 15,
      color:
        colors.textSecondary,
    },

    loadingExperiences: {
      minHeight: 70,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "center",
      gap: 9,
    },

    loadingExperiencesText: {
      fontFamily:
        fonts.regular,
      fontSize: 12,
      color:
        colors.textSecondary,
    },

    createSection: {
      width: "100%",
      marginTop: 38,
      paddingBottom: 12,
    },

    createSectionLabel: {
      fontFamily:
        fonts.extraBold,
      fontSize: 13,
      color: colors.red,
    },

    createTitle: {
      marginTop: 7,
      fontFamily:
        fonts.extraBold,
      fontSize: 22,
      lineHeight: 27,
      color: colors.text,
    },

    createDescription: {
      marginTop: 5,
      marginBottom: 14,
      fontFamily:
        fonts.regular,
      fontSize: 14,
      lineHeight: 20,
      color:
        colors.textSecondary,
    },

    createCard: {
      width: "100%",
      paddingHorizontal: 15,
      paddingTop: 17,
      paddingBottom: 15,
      borderWidth: 1.5,
      borderColor:
        colors.green,
      borderRadius: 6,
      backgroundColor:
        colors.background,
    },

    fieldLabel: {
      marginTop: 2,
      marginBottom: 5,
      fontFamily:
        fonts.extraBold,
      fontSize: 10,
      color: colors.text,
    },

    input: {
      width: "100%",
      minHeight: 48,
      marginBottom: 13,
      paddingHorizontal: 11,
      paddingVertical: 10,
      borderWidth: 1.5,
      borderColor:
        colors.orange,
      borderRadius: 4,
      backgroundColor:
        colors.background,
      fontFamily:
        fonts.regular,
      fontSize: 14,
      color: colors.text,
    },

    descriptionInput: {
      minHeight: 92,
    },

    selector: {
      width: "100%",
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 13,
      paddingHorizontal: 11,
      borderWidth: 1.5,
      borderColor:
        colors.orange,
      borderRadius: 4,
      backgroundColor:
        colors.background,
    },

    selectorText: {
      flex: 1,
      marginLeft: 9,
      fontFamily:
        fonts.regular,
      fontSize: 14,
      color: colors.text,
    },

    placeholderText: {
      color: "#A7AFBC",
    },

    pickerWrap: {
      width: "100%",
      marginTop: -5,
      marginBottom: 13,
      overflow: "hidden",
      borderWidth: 1,
      borderColor:
        colors.divider,
      borderRadius: 4,
    },

    pickerDone: {
      alignSelf:
        "flex-end",
      paddingHorizontal: 14,
      paddingVertical: 10,
    },

    pickerDoneText: {
      fontFamily:
        fonts.extraBold,
      fontSize: 12,
      color: colors.green,
    },

    locationInputWrap: {
      width: "100%",
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 0,
      paddingHorizontal: 11,
      borderWidth: 1.5,
      borderColor:
        colors.orange,
      borderRadius: 4,
      backgroundColor:
        colors.background,
    },

    locationIcon: {
      marginRight: 7,
    },

    locationTextInput: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 10,
      fontFamily:
        fonts.regular,
      fontSize: 14,
      color: colors.text,
    },

    predictionsBox: {
      width: "100%",
      overflow: "hidden",
      marginTop: 4,
      marginBottom: 10,
      borderWidth: 1,
      borderColor:
        colors.divider,
      borderRadius: 4,
      backgroundColor:
        colors.surface,
    },

    predictionRow: {
      minHeight: 54,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 10,
      paddingVertical: 8,
    },

    predictionDivider: {
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        colors.divider,
    },

    predictionIcon: {
      marginRight: 8,
    },

    predictionTextWrap: {
      flex: 1,
      minWidth: 0,
    },

    predictionMainText: {
      fontFamily:
        fonts.semiBold,
      fontSize: 13,
      color: colors.text,
    },

    predictionSecondaryText: {
      marginTop: 2,
      fontFamily:
        fonts.regular,
      fontSize: 11,
      lineHeight: 15,
      color:
        colors.textSecondary,
    },

    googleAttribution: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      textAlign: "right",
      fontFamily:
        fonts.medium,
      fontSize: 9,
      color:
        colors.textSecondary,
    },

    selectedLocationRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 6,
      marginBottom: 12,
    },

    selectedLocationText: {
      marginLeft: 5,
      fontFamily:
        fonts.medium,
      fontSize: 11,
      color: colors.green,
    },

    createButton: {
      width: "100%",
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "center",
      gap: 7,
      marginTop: 2,
      borderRadius: 4,
      backgroundColor:
        colors.green,
      shadowColor:
        "#000000",
      shadowOffset: {
        width: 0,
        height: 3,
      },
      shadowOpacity: 0.18,
      shadowRadius: 3,
      elevation: 3,
    },

    createButtonDisabled: {
      opacity: 0.65,
    },

    createButtonText: {
      fontFamily:
        fonts.extraBold,
      fontSize: 14,
      color: colors.white,
    },

    createHint: {
      marginTop: 11,
      paddingHorizontal: 8,
      textAlign: "center",
      fontFamily:
        fonts.regular,
      fontSize: 11,
      lineHeight: 16,
      color:
        colors.textSecondary,
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
      shadowColor:
        "#000000",
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