import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import MapView, {
  Marker,
  type Region,
} from "react-native-maps";
import * as Location from "expo-location";

import { colors, fonts } from "../theme/theme";

type HibernateTab =
  | "popular"
  | "jimnys";

type TrailDifficulty =
  | "Easy"
  | "Medium"
  | "Hard";

type Trail = {
  id: string;
  name: string;
  trailDistance: number;
  duration: string;
  terrain: string;
  difficulty: TrailDifficulty;
  latitude: number;
  longitude: number;
};

type NearbyJimny = {
  id: string;
  name: string;
  jimnyName: string;
  model: string;
  year: string;
  latitudeOffset: number;
  longitudeOffset: number;
};

type HibernateScreenProps = {
  onBack: () => void;
  onTrailSelected: (
    trailName: string
  ) => Promise<void> | void;
  onExplore: () => void;
  onAdventures: () => void;
  onPassport: () => void;
};

const TRAILS: Trail[] = [
  {
    id: "highveld-ridge",
    name: "Highveld Ridge",
    trailDistance: 4.8,
    duration: "1.5 hrs",
    terrain: "Gravel",
    difficulty: "Easy",
    latitude: -25.8645,
    longitude: 28.2107,
  },
  {
    id: "riverbed-loop",
    name: "Riverbed Loop",
    trailDistance: 6.2,
    duration: "2.2 hrs",
    terrain: "Sand / Rock",
    difficulty: "Medium",
    latitude: -25.883,
    longitude: 28.226,
  },
  {
    id: "granite-pass",
    name: "Granite Pass",
    trailDistance: 8.5,
    duration: "3.0 hrs",
    terrain: "Rock / Steep",
    difficulty: "Hard",
    latitude: -25.895,
    longitude: 28.192,
  },
  {
    id: "valley-wash",
    name: "Valley Wash",
    trailDistance: 3.1,
    duration: "1.1 hrs",
    terrain: "Sand",
    difficulty: "Easy",
    latitude: -25.849,
    longitude: 28.238,
  },
];

const NEARBY_JIMNYS: NearbyJimny[] = [
  {
    id: "sarah",
    name: "Sarah M.",
    jimnyName: "Muddy",
    model: "JC",
    year: "2024",
    latitudeOffset: 0.012,
    longitudeOffset: -0.012,
  },
  {
    id: "james",
    name: "James K.",
    jimnyName: "Beast",
    model: "GLX",
    year: "2020",
    latitudeOffset: -0.016,
    longitudeOffset: -0.009,
  },
  {
    id: "thandi",
    name: "Thandi N.",
    jimnyName: "Sunny",
    model: "GA",
    year: "2023",
    latitudeOffset: 0.006,
    longitudeOffset: 0.018,
  },
  {
    id: "david",
    name: "David R.",
    jimnyName: "Rocky",
    model: "GLX",
    year: "2022",
    latitudeOffset: -0.012,
    longitudeOffset: 0.017,
  },
];

function degreesToRadians(
  degrees: number
) {
  return (degrees * Math.PI) / 180;
}

function calculateDistanceKm(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number
) {
  const earthRadiusKm = 6371;

  const latitudeDifference =
    degreesToRadians(
      latitude2 - latitude1
    );

  const longitudeDifference =
    degreesToRadians(
      longitude2 - longitude1
    );

  const a =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(
      degreesToRadians(latitude1)
    ) *
      Math.cos(
        degreesToRadians(latitude2)
      ) *
      Math.sin(
        longitudeDifference / 2
      ) **
        2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return earthRadiusKm * c;
}

export default function HibernateScreen({
  onBack,
  onTrailSelected,
  onExplore,
  onAdventures,
  onPassport,
}: HibernateScreenProps) {
  const mapRef =
    useRef<MapView | null>(null);

  const [activeTab, setActiveTab] =
    useState<HibernateTab>("popular");

  const [userLocation, setUserLocation] =
    useState<{
      latitude: number;
      longitude: number;
    } | null>(null);

  const [locationError, setLocationError] =
    useState("");

  const [isLoadingLocation, setIsLoadingLocation] =
    useState(true);

  const [travelRadius, setTravelRadius] =
    useState(10);

  const [sliderWidth, setSliderWidth] =
    useState(0);

  const [expandedTrail, setExpandedTrail] =
    useState<string | null>(null);

  const [isSelectingTrail, setIsSelectingTrail] =
    useState(false);

  const [wavedOwners, setWavedOwners] =
    useState<string[]>([]);

  const [meetLocation, setMeetLocation] =
    useState("");

  const [meetDate, setMeetDate] =
    useState("");

  const [meetMessage, setMeetMessage] =
    useState("");

  useEffect(() => {
    const loadLocation = async () => {
      try {
        setIsLoadingLocation(true);
        setLocationError("");

        const permission =
          await Location.requestForegroundPermissionsAsync();

        if (
          permission.status !== "granted"
        ) {
          setLocationError(
            "Location access is needed to find trails near you."
          );

          return;
        }

        const location =
          await Location.getCurrentPositionAsync(
            {
              accuracy:
                Location.Accuracy.Balanced,
            }
          );

        const coordinates = {
          latitude:
            location.coords.latitude,
          longitude:
            location.coords.longitude,
        };

        setUserLocation(coordinates);
      } catch (error) {
        console.error(
          "Unable to load location:",
          error
        );

        setLocationError(
          "We couldn't find your current location."
        );
      } finally {
        setIsLoadingLocation(false);
      }
    };

    loadLocation();
  }, []);

  const mapRegion: Region | undefined =
    userLocation
      ? {
          latitude:
            userLocation.latitude,
          longitude:
            userLocation.longitude,
          latitudeDelta: 0.09,
          longitudeDelta: 0.09,
        }
      : undefined;

  const trailsWithDistance =
    useMemo(() => {
      if (!userLocation) {
        return [];
      }

      return TRAILS.map((trail) => ({
        ...trail,
        distanceFromUser:
          calculateDistanceKm(
            userLocation.latitude,
            userLocation.longitude,
            trail.latitude,
            trail.longitude
          ),
      })).sort(
        (a, b) =>
          a.distanceFromUser -
          b.distanceFromUser
      );
    }, [userLocation]);

  const visibleTrails =
    trailsWithDistance.filter(
      (trail) =>
        trail.distanceFromUser <=
        travelRadius
    );

  const nearbyJimnys =
    useMemo(() => {
      if (!userLocation) {
        return [];
      }

      return NEARBY_JIMNYS.map(
        (owner) => {
          const latitude =
            userLocation.latitude +
            owner.latitudeOffset;

          const longitude =
            userLocation.longitude +
            owner.longitudeOffset;

          return {
            ...owner,
            latitude,
            longitude,
            distanceFromUser:
              calculateDistanceKm(
                userLocation.latitude,
                userLocation.longitude,
                latitude,
                longitude
              ),
          };
        }
      ).sort(
        (a, b) =>
          a.distanceFromUser -
          b.distanceFromUser
      );
    }, [userLocation]);

  const changeTab = (
    tab: HibernateTab
  ) => {
    setActiveTab(tab);

    if (
      userLocation &&
      mapRef.current
    ) {
      mapRef.current.animateToRegion(
        {
          latitude:
            userLocation.latitude,
          longitude:
            userLocation.longitude,
          latitudeDelta: 0.09,
          longitudeDelta: 0.09,
        },
        350
      );
    }
  };

  const updateRadiusFromPress = (
    locationX: number
  ) => {
    if (sliderWidth <= 0) {
      return;
    }

    const percentage = Math.min(
      1,
      Math.max(
        0,
        locationX / sliderWidth
      )
    );

    let nextRadius =
      Math.round(
        (percentage * 1000) / 10
      ) * 10;

    if (nextRadius < 10) {
      nextRadius = 10;
    }

    setTravelRadius(nextRadius);
  };

  const selectTrail = async (
    trail: Trail
  ) => {
    if (isSelectingTrail) {
      return;
    }

    try {
      setIsSelectingTrail(true);

      await onTrailSelected(
        trail.name
      );
    } catch (error) {
      console.error(
        "Unable to select trail:",
        error
      );

      Alert.alert(
        "Something went wrong",
        "We couldn't save this trail. Please try again."
      );
    } finally {
      setIsSelectingTrail(false);
    }
  };

  const waveAtOwner = (
    ownerId: string
  ) => {
    setWavedOwners((current) =>
      current.includes(ownerId)
        ? current
        : [...current, ownerId]
    );
  };

  const sendMeetUpInvite = () => {
    if (
      !meetLocation.trim() ||
      !meetDate.trim()
    ) {
      Alert.alert(
        "Missing details",
        "Add a location and date before sending your Meet & Greet invite."
      );

      return;
    }

    Alert.alert(
      "Meet & Greet ready",
      "Your Meet & Greet has been created for the prototype."
    );

    setMeetLocation("");
    setMeetDate("");
    setMeetMessage("");
  };

  const renderMap = () => {
    if (isLoadingLocation) {
      return (
        <View style={styles.mapLoading}>
          <ActivityIndicator
            color={colors.green}
          />

          <Text style={styles.mapLoadingText}>
            Finding your location...
          </Text>
        </View>
      );
    }

    if (
      locationError ||
      !userLocation ||
      !mapRegion
    ) {
      return (
        <View style={styles.mapLoading}>
          <MaterialIcons
            name="location-off"
            size={30}
            color={colors.red}
          />

          <Text style={styles.mapErrorText}>
            {locationError ||
              "Location unavailable."}
          </Text>
        </View>
      );
    }

    return (
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={mapRegion}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
      >
        {activeTab === "popular"
          ? visibleTrails.map(
              (trail) => (
                <Marker
                  key={trail.id}
                  coordinate={{
                    latitude:
                      trail.latitude,
                    longitude:
                      trail.longitude,
                  }}
                  title={trail.name}
                  description={`${trail.difficulty} • ${trail.terrain}`}
                  pinColor={colors.red}
                />
              )
            )
          : nearbyJimnys.map(
              (owner) => (
                <Marker
                  key={owner.id}
                  coordinate={{
                    latitude:
                      owner.latitude,
                    longitude:
                      owner.longitude,
                  }}
                  title={owner.name}
                  description={`${owner.jimnyName} • ${owner.model} ${owner.year}`}
                  pinColor={colors.red}
                />
              )
            )}
      </MapView>
    );
  };

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top", "bottom"]}
    >
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={
            styles.scrollContent
          }
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={
            false
          }
        >
          <View style={styles.content}>
            {/* HEADER */}
            <View style={styles.header}>
              <Pressable
                onPress={onBack}
                hitSlop={10}
                style={
                  styles.backButton
                }
              >
                <MaterialIcons
                  name="arrow-back"
                  size={27}
                  color={colors.text}
                />
              </Pressable>

              <Text
                style={
                  styles.headerTitle
                }
              >
                Hibernate
              </Text>
            </View>

            <Text
              style={styles.subtitle}
            >
              {activeTab === "popular"
                ? "Find the most popular trails near you."
                : "Find fellow Jimny owners near you."}
            </Text>

            {/* MAP */}
            <View
              style={styles.mapContainer}
            >
              {renderMap()}
            </View>

            {/* TABS */}
            <View
              style={styles.tabContainer}
            >
              <Pressable
                onPress={() =>
                  changeTab("popular")
                }
                style={[
                  styles.tab,
                  activeTab ===
                    "popular" &&
                    styles.activeTab,
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab ===
                      "popular" &&
                      styles.activeTabText,
                  ]}
                >
                  Popular Locations
                </Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  changeTab("jimnys")
                }
                style={[
                  styles.tab,
                  activeTab ===
                    "jimnys" &&
                    styles.activeTab,
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    activeTab ===
                      "jimnys" &&
                      styles.activeTabText,
                  ]}
                >
                  Jimny’s Near You
                </Text>
              </Pressable>
            </View>

            {activeTab === "popular" ? (
              <>
                {/* TRAVEL RADIUS */}
                <View
                  style={
                    styles.radiusCard
                  }
                >
                  <View
                    style={
                      styles.radiusHeadingRow
                    }
                  >
                    <Text
                      style={
                        styles.radiusHeading
                      }
                    >
                      Travel radius
                    </Text>

                    <Text
                      style={
                        styles.radiusMeta
                      }
                    >
                      Max distance
                    </Text>
                  </View>

                  <View
                    style={
                      styles.radiusSelectedRow
                    }
                  >
                    <Text
                      style={
                        styles.radiusMeta
                      }
                    >
                      Selected distance
                    </Text>

                    <Text
                      style={
                        styles.radiusValue
                      }
                    >
                      {travelRadius.toLocaleString()}{" "}
                      km
                    </Text>
                  </View>

                  <Pressable
                    style={
                      styles.sliderTouchArea
                    }
                    onLayout={(event) =>
                      setSliderWidth(
                        event.nativeEvent
                          .layout.width
                      )
                    }
                    onPress={(event) =>
                      updateRadiusFromPress(
                        event.nativeEvent
                          .locationX
                      )
                    }
                  >
                    <View
                      style={
                        styles.sliderTrack
                      }
                    />

                    <View
                      pointerEvents="none"
                      style={[
                        styles.sliderThumb,
                        {
                          left:
                            sliderWidth > 0
                              ? Math.min(
                                  sliderWidth -
                                    20,
                                  Math.max(
                                    0,
                                    (travelRadius /
                                      1000) *
                                      sliderWidth -
                                      10
                                  )
                                )
                              : 0,
                        },
                      ]}
                    />
                  </Pressable>

                  <View
                    style={
                      styles.sliderLabels
                    }
                  >
                    <Text
                      style={
                        styles.sliderLabel
                      }
                    >
                      0 km
                    </Text>

                    <Text
                      style={
                        styles.sliderLabel
                      }
                    >
                      1,000 km
                    </Text>
                  </View>

                  <Text
                    style={
                      styles.radiusDescription
                    }
                  >
                    Showing trails within{" "}
                    {travelRadius.toLocaleString()}{" "}
                    km of your current
                    location.
                  </Text>
                </View>

                <Text
                  style={
                    styles.sectionHeading
                  }
                >
                  POPULAR TRAILS NEAR YOU
                </Text>

                <Text
                  style={
                    styles.sectionDescription
                  }
                >
                  Compare difficulty,
                  distance, duration,
                  terrain, and distance
                  from your current
                  location.
                </Text>

                <View
                  style={
                    styles.trailList
                  }
                >
                  {visibleTrails.length ===
                  0 ? (
                    <View
                      style={
                        styles.emptyCard
                      }
                    >
                      <Text
                        style={
                          styles.emptyText
                        }
                      >
                        No trails found
                        within this travel
                        radius.
                      </Text>
                    </View>
                  ) : (
                    visibleTrails.map(
                      (trail) => {
                        const isExpanded =
                          expandedTrail ===
                          trail.id;

                        return (
                          <View
                            key={
                              trail.id
                            }
                            style={
                              styles.trailCard
                            }
                          >
                            <View
                              style={
                                styles.trailTopRow
                              }
                            >
                              <View
                                style={
                                  styles.trailTitleArea
                                }
                              >
                                <Text
                                  style={
                                    styles.trailTitle
                                  }
                                >
                                  {
                                    trail.name
                                  }
                                </Text>

                                <Text
                                  style={
                                    styles.trailSummary
                                  }
                                >
                                  {
                                    trail.trailDistance
                                  }{" "}
                                  km •{" "}
                                  {
                                    trail.duration
                                  }
                                </Text>
                              </View>

                              <View
                                style={[
                                  styles.difficultyBadge,
                                  trail.difficulty ===
                                    "Easy" &&
                                    styles.easyBadge,
                                  trail.difficulty ===
                                    "Medium" &&
                                    styles.mediumBadge,
                                  trail.difficulty ===
                                    "Hard" &&
                                    styles.hardBadge,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.difficultyText,
                                    trail.difficulty ===
                                      "Easy" &&
                                      styles.easyText,
                                    trail.difficulty ===
                                      "Medium" &&
                                      styles.mediumText,
                                    trail.difficulty ===
                                      "Hard" &&
                                      styles.hardText,
                                  ]}
                                >
                                  {
                                    trail.difficulty
                                  }
                                </Text>
                              </View>
                            </View>

                            <View
                              style={
                                styles.metricsRow
                              }
                            >
                              <MetricBox
                                label="Distance"
                                value={`${trail.trailDistance} km`}
                              />

                              <MetricBox
                                label="Duration"
                                value={
                                  trail.duration
                                }
                              />

                              <MetricBox
                                label="Terrain"
                                value={
                                  trail.terrain
                                }
                              />
                            </View>

                            <View
                              style={
                                styles.trailBottomRow
                              }
                            >
                              <Text
                                style={
                                  styles.distanceFromUser
                                }
                              >
                                {trail.distanceFromUser.toFixed(
                                  1
                                )}{" "}
                                km from you
                              </Text>

                              <Pressable
                                onPress={() =>
                                  setExpandedTrail(
                                    isExpanded
                                      ? null
                                      : trail.id
                                  )
                                }
                                style={
                                  styles.detailsButton
                                }
                              >
                                <Text
                                  style={
                                    styles.detailsText
                                  }
                                >
                                  {isExpanded
                                    ? "Hide details"
                                    : "View details"}
                                </Text>

                                <MaterialIcons
                                  name={
                                    isExpanded
                                      ? "keyboard-arrow-up"
                                      : "arrow-forward"
                                  }
                                  size={21}
                                  color={
                                    colors.green
                                  }
                                />
                              </Pressable>
                            </View>

                            {isExpanded && (
                              <View
                                style={
                                  styles.expandedArea
                                }
                              >
                                <Text
                                  style={
                                    styles.expandedText
                                  }
                                >
                                  Ready to make{" "}
                                  {
                                    trail.name
                                  }{" "}
                                  your trail for
                                  this Side Quest?
                                </Text>

                                <Pressable
                                  disabled={
                                    isSelectingTrail
                                  }
                                  onPress={() =>
                                    selectTrail(
                                      trail
                                    )
                                  }
                                  style={
                                    styles.selectTrailButton
                                  }
                                >
                                  {isSelectingTrail ? (
                                    <ActivityIndicator
                                      color={
                                        colors.white
                                      }
                                    />
                                  ) : (
                                    <Text
                                      style={
                                        styles.selectTrailButtonText
                                      }
                                    >
                                      SELECT THIS
                                      TRAIL
                                    </Text>
                                  )}
                                </Pressable>
                              </View>
                            )}
                          </View>
                        );
                      }
                    )
                  )}
                </View>
              </>
            ) : (
              <View
                style={styles.ownerList}
              >
                {nearbyJimnys.map(
                  (owner) => {
                    const waved =
                      wavedOwners.includes(
                        owner.id
                      );

                    return (
                      <View
                        key={owner.id}
                        style={
                          styles.ownerCard
                        }
                      >
                        <View
                          style={
                            styles.avatar
                          }
                        >
                          <MaterialIcons
                            name="person"
                            size={34}
                            color={
                              colors.textSecondary
                            }
                          />
                        </View>

                        <View
                          style={
                            styles.ownerInfo
                          }
                        >
                          <Text
                            style={
                              styles.ownerName
                            }
                          >
                            {owner.name}
                          </Text>

                          <Text
                            style={
                              styles.ownerDetails
                            }
                            numberOfLines={
                              2
                            }
                          >
                            {
                              owner.jimnyName
                            }{" "}
                            • {owner.model}{" "}
                            {owner.year} •{" "}
                            {owner.distanceFromUser.toFixed(
                              1
                            )}{" "}
                            km
                          </Text>
                        </View>

                        <Pressable
                          onPress={() =>
                            waveAtOwner(
                              owner.id
                            )
                          }
                          style={[
                            styles.waveButton,
                            waved &&
                              styles.waveButtonActive,
                          ]}
                        >
                          <Text
                            style={
                              styles.waveButtonText
                            }
                          >
                            {waved
                              ? "Waved ✓"
                              : "Wave"}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  }
                )}
              </View>
            )}

            {/* MEET & GREET */}
            <View
              style={styles.meetCard}
            >
              <Text
                style={styles.meetTitle}
              >
                Start a Meet & Greet
              </Text>

              <TextInput
                value={meetLocation}
                onChangeText={
                  setMeetLocation
                }
                placeholder="Enter location (e.g. Pretoria Dirt Track)"
                placeholderTextColor="#A7ADBA"
                style={styles.input}
              />

              <TextInput
                value={meetDate}
                onChangeText={
                  setMeetDate
                }
                placeholder="Select date and time"
                placeholderTextColor="#A7ADBA"
                style={styles.input}
              />

              <TextInput
                value={meetMessage}
                onChangeText={
                  setMeetMessage
                }
                placeholder="Add invite message..."
                placeholderTextColor="#A7ADBA"
                multiline
                textAlignVertical="top"
                style={[
                  styles.input,
                  styles.messageInput,
                ]}
              />

              <Pressable
                onPress={
                  sendMeetUpInvite
                }
                style={
                  styles.sendButton
                }
              >
                <Text
                  style={
                    styles.sendButtonText
                  }
                >
                  SEND MEET-UP INVITE
                </Text>
              </Pressable>

              <Text
                style={styles.meetNote}
              >
                Nearby Jimny owners will
                be notified.
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* BOTTOM NAV */}
        <View style={styles.bottomNav}>
          <Pressable
            style={[
              styles.navItem,
              styles.navItemSelected,
            ]}
            onPress={onExplore}
          >
            <MaterialIcons
              name="explore"
              size={29}
              color={colors.text}
            />

            <Text
              style={[
                styles.navText,
                styles.navTextSelected,
              ]}
            >
              Explore
            </Text>
          </Pressable>

          <Pressable
            style={styles.navItem}
            onPress={onAdventures}
          >
            <MaterialIcons
              name="monitor-heart"
              size={29}
              color={colors.text}
            />

            <Text
              style={styles.navText}
            >
              Adventures
            </Text>
          </Pressable>

          <Pressable
            style={styles.navItem}
            onPress={onPassport}
          >
            <MaterialIcons
              name="menu-book"
              size={28}
              color={colors.text}
            />

            <Text
              style={styles.navText}
            >
              Passport
            </Text>
          </Pressable>

          <Pressable
            style={styles.navItem}
          >
            <MaterialIcons
              name="account-circle"
              size={30}
              color={colors.text}
            />

            <Text
              style={styles.navText}
            >
              My Profile
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type MetricBoxProps = {
  label: string;
  value: string;
};

function MetricBox({
  label,
  value,
}: MetricBoxProps) {
  return (
    <View style={styles.metricBox}>
      <Text style={styles.metricLabel}>
        {label}
      </Text>

      <Text
        style={styles.metricValue}
        numberOfLines={2}
      >
        {value}
      </Text>
    </View>
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

  scroll: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: 30,
  },

  content: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 17,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
  },

  backButton: {
    width: 30,
    minHeight: 38,
    justifyContent: "center",
  },

  headerTitle: {
    marginLeft: 2,
    fontFamily: fonts.extraBold,
    fontSize: 30,
    lineHeight: 36,
    color: colors.text,
  },

  subtitle: {
    marginTop: 4,
    fontFamily: fonts.regular,
    fontSize: 18,
    lineHeight: 24,
    color: colors.textSecondary,
  },

  mapContainer: {
    width: "100%",
    aspectRatio: 1.78,
    marginTop: 17,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: colors.green,
    borderRadius: 10,
    backgroundColor: "#E8E8E2",
  },

  map: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },

  mapLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },

  mapLoadingText: {
    marginTop: 9,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },

  mapErrorText: {
    marginTop: 8,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    color: colors.textSecondary,
  },

  tabContainer: {
    width: "100%",
    minHeight: 51,
    flexDirection: "row",
    marginTop: 22,
    padding: 4,
    borderWidth: 1.5,
    borderColor: colors.orange,
    borderRadius: 10,
    backgroundColor: colors.background,
  },

  tab: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    borderRadius: 8,
  },

  activeTab: {
    backgroundColor: colors.orange,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },

  tabText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    textAlign: "center",
    color: colors.textSecondary,
  },

  activeTabText: {
    fontFamily: fonts.extraBold,
    color: colors.white,
  },

  radiusCard: {
    width: "100%",
    marginTop: 28,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: colors.green,
    borderRadius: 8,
  },

  radiusHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  radiusHeading: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
    color: colors.text,
  },

  radiusMeta: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.textSecondary,
  },

  radiusSelectedRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 11,
  },

  radiusValue: {
    fontFamily: fonts.extraBold,
    fontSize: 17,
    color: colors.green,
  },

  sliderTouchArea: {
    width: "100%",
    height: 30,
    justifyContent: "center",
    marginTop: 5,
  },

  sliderTrack: {
    width: "100%",
    height: 5,
    borderRadius: 3,
    backgroundColor: "#DEDCD5",
  },

  sliderThumb: {
    position: "absolute",
    width: 20,
    height: 20,
    top: 5,
    borderWidth: 2,
    borderColor: colors.green,
    borderRadius: 10,
    backgroundColor: colors.background,
  },

  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  sliderLabel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textSecondary,
  },

  radiusDescription: {
    marginTop: 10,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },

  sectionHeading: {
    marginTop: 19,
    fontFamily: fonts.extraBold,
    fontSize: 15,
    color: colors.red,
  },

  sectionDescription: {
    marginTop: 5,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 17,
    color: colors.textSecondary,
  },

  trailList: {
    width: "100%",
    marginTop: 15,
    gap: 13,
  },

  trailCard: {
    width: "100%",
    padding: 14,
    borderWidth: 1.5,
    borderColor: colors.green,
    borderRadius: 8,
  },

  trailTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },

  trailTitleArea: {
    flex: 1,
    minWidth: 0,
  },

  trailTitle: {
    fontFamily: fonts.extraBold,
    fontSize: 17,
    lineHeight: 21,
    color: colors.text,
  },

  trailSummary: {
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },

  difficultyBadge: {
    flexShrink: 0,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: 20,
  },

  easyBadge: {
    borderColor: colors.green,
    backgroundColor: "#E3F4E8",
  },

  mediumBadge: {
    borderColor: colors.orange,
    backgroundColor: "#FFF0DE",
  },

  hardBadge: {
    borderColor: colors.red,
    backgroundColor: "#FFE7E3",
  },

  difficultyText: {
    fontFamily: fonts.extraBold,
    fontSize: 11,
  },

  easyText: {
    color: colors.green,
  },

  mediumText: {
    color: "#B74C00",
  },

  hardText: {
    color: colors.red,
  },

  metricsRow: {
    width: "100%",
    flexDirection: "row",
    gap: 9,
    marginTop: 12,
  },

  metricBox: {
    flex: 1,
    minWidth: 0,
    minHeight: 55,
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: colors.green,
    borderRadius: 5,
  },

  metricLabel: {
    fontFamily: fonts.medium,
    fontSize: 10,
    color: colors.textSecondary,
  },

  metricValue: {
    marginTop: 2,
    fontFamily: fonts.extraBold,
    fontSize: 12,
    lineHeight: 15,
    color: colors.text,
  },

  trailBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 11,
  },

  distanceFromUser: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
  },

  detailsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },

  detailsText: {
    fontFamily: fonts.extraBold,
    fontSize: 12,
    color: colors.green,
  },

  expandedArea: {
    marginTop: 13,
    paddingTop: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },

  expandedText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },

  selectTrailButton: {
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    borderRadius: 4,
    backgroundColor: colors.green,
  },

  selectTrailButtonText: {
    fontFamily: fonts.extraBold,
    fontSize: 13,
    color: colors.white,
  },

  emptyCard: {
    padding: 20,
    borderWidth: 1.5,
    borderColor: colors.green,
    borderRadius: 8,
  },

  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    textAlign: "center",
    color: colors.textSecondary,
  },

  ownerList: {
    width: "100%",
    marginTop: 27,
    gap: 12,
  },

  ownerCard: {
    width: "100%",
    minHeight: 84,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: colors.green,
    borderRadius: 8,
  },

  avatar: {
    width: 52,
    height: 52,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.red,
    borderRadius: 26,
    backgroundColor: "#EEEAE2",
  },

  ownerInfo: {
    flex: 1,
    minWidth: 0,
    marginLeft: 14,
    marginRight: 8,
  },

  ownerName: {
    fontFamily: fonts.extraBold,
    fontSize: 18,
    color: colors.text,
  },

  ownerDetails: {
    marginTop: 3,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 18,
    color: colors.textSecondary,
  },

  waveButton: {
    minWidth: 76,
    minHeight: 43,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: colors.orange,
    borderRadius: 7,
    backgroundColor: colors.background,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.17,
    shadowRadius: 4,
    elevation: 3,
  },

  waveButtonActive: {
    backgroundColor: "#FFF0DE",
  },

  waveButtonText: {
    fontFamily: fonts.extraBold,
    fontSize: 14,
    color: colors.text,
  },

  meetCard: {
    width: "100%",
    marginTop: 28,
    paddingHorizontal: 19,
    paddingTop: 22,
    paddingBottom: 21,
    borderWidth: 1.5,
    borderColor: colors.green,
    borderRadius: 9,
  },

  meetTitle: {
    marginBottom: 18,
    fontFamily: fonts.extraBold,
    fontSize: 21,
    lineHeight: 26,
    color: colors.text,
  },

  input: {
    width: "100%",
    minHeight: 54,
    marginBottom: 13,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: colors.orange,
    borderRadius: 5,
    backgroundColor: colors.background,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.text,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },

  messageInput: {
    minHeight: 86,
  },

  sendButton: {
    width: "100%",
    minHeight: 57,
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
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 3,
  },

  sendButtonText: {
    fontFamily: fonts.extraBold,
    fontSize: 15,
    color: colors.white,
  },

  meetNote: {
    marginTop: 17,
    fontFamily: fonts.regular,
    fontSize: 13,
    textAlign: "center",
    color: colors.textSecondary,
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
});