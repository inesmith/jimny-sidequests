import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  doc,
  getDoc,
  Timestamp,
} from "firebase/firestore";

import { auth, db } from "../firebase/firebase";
import { colors, fonts } from "../theme/theme";
import BottomNav from "../components/BottomNav";

/*
 * PASSPORT BACKGROUNDS
 */
const passportOneImage = require("../../assets/images/passport1.png");
const passportTwoImage = require("../../assets/images/passport2.png");

const passportOneSource =
  Image.resolveAssetSource(passportOneImage);

const passportTwoSource =
  Image.resolveAssetSource(passportTwoImage);

const passportOneAspectRatio =
  passportOneSource.width /
  passportOneSource.height;

const passportTwoAspectRatio =
  passportTwoSource.width /
  passportTwoSource.height;

type MyPassportScreenProps = {
  onBack?: () => void;
  onExplore?: () => void;
  onAdventures?: () => void;
  onProfile?: () => void;
};

type PassportVehicle = {
  make?: string;
  model?: string;
  year?: number;
  colour?: string;
  nickname?: string | null;
  photoURL?: string | null;
};

type PassportStamp = {
  id?: string;
  questId?: string;
  name?: string;
  title?: string;
  earnedAt?: Timestamp | null;
};

type PassportData = {
  uid?: string;
  passportNumber?: string;
  ownerName?: string;
  profilePhotoURL?: string | null;
  vehicle?: PassportVehicle;
  stamps?: PassportStamp[];
  stampCount?: number;
  firstAdventureAt?: Timestamp | null;
  lastAdventureAt?: Timestamp | null;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
};

type StampSlot = {
  id: string;
  name: string;
};

const PASSPORT_STAMP_TOTAL = 9;

const stampSlots: StampSlot[] = [
  {
    id: "get-it-dirty",
    name: "Get It Dirty",
  },
  {
    id: "convoy-coffee",
    name: "Convoy & Coffee",
  },
  {
    id: "sleep-under-stars",
    name: "Stars Night",
  },
  {
    id: "parking-buddies",
    name: "Park Buddies",
  },
  {
    id: "spot-the-wild",
    name: "Spot The Wild",
  },
  {
    id: "find-your-twin",
    name: "Twin Finder",
  },
  { id: "future-stamp-7", name: "Coming Soon" },
  { id: "future-stamp-8", name: "Coming Soon" },
  { id: "future-stamp-9", name: "Coming Soon" },
];

export default function MyPassportScreen({
  onBack,
  onExplore,
  onAdventures,
  onProfile,
}: MyPassportScreenProps) {
  const [passport, setPassport] =
    useState<PassportData | null>(null);

  const [isLoading, setIsLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [contentSize, setContentSize] = useState({ width: 0, height: 0 });
  const [stampPage, setStampPage] = useState(0);

  // Keep both passport images visible without vertical scrolling.
  const passportWidth = contentSize.width > 0 && contentSize.height > 0
    ? Math.max(0, Math.min(
        520,
        contentSize.width - 32,
        (contentSize.height - 24 - 17) /
          (1 / passportOneAspectRatio + 1 / passportTwoAspectRatio)
      ))
    : 0;

  const handleStampSwipe = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!passportWidth) return;
    const page = Math.round(event.nativeEvent.contentOffset.x / passportWidth);
    setStampPage(Math.max(0, Math.min(1, page)));
  };

  /*
   * LOAD PASSPORT FROM FIREBASE
   */
  useEffect(() => {
    const loadPassport = async () => {
      const user = auth.currentUser;

      if (!user) {
        setErrorMessage(
          "Please log in to view your Adventure Passport."
        );

        setIsLoading(false);
        return;
      }

      try {
        const passportRef = doc(
          db,
          "passports",
          user.uid
        );

        const passportSnapshot =
          await getDoc(passportRef);

        if (!passportSnapshot.exists()) {
          setErrorMessage(
            "You haven't created an Adventure Passport yet."
          );

          return;
        }

        setPassport(
          passportSnapshot.data() as PassportData
        );
      } catch (error) {
        console.error(
          "Unable to load passport:",
          error
        );

        setErrorMessage(
          "We couldn't load your Adventure Passport."
        );
      } finally {
        setIsLoading(false);
      }
    };

    loadPassport();
  }, []);

  /*
   * DATE HELPERS
   */
  const formatDate = (
    timestamp?: Timestamp | null
  ) => {
    if (!timestamp) {
      return "—";
    }

    try {
      return timestamp
        .toDate()
        .toLocaleDateString("en-ZA", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
        .toUpperCase();
    } catch {
      return "—";
    }
  };

  const issueDate = useMemo(
    () => formatDate(passport?.createdAt),
    [passport?.createdAt]
  );

  const firstAdventureDate = useMemo(
    () =>
      formatDate(
        passport?.firstAdventureAt
      ),
    [passport?.firstAdventureAt]
  );

  const lastAdventureDate = useMemo(
    () =>
      formatDate(
        passport?.lastAdventureAt
      ),
    [passport?.lastAdventureAt]
  );

  /*
   * STAMP INFORMATION
   */
  const earnedStamps =
    passport?.stamps ?? [];

  const stampCount =
    passport?.stampCount ??
    earnedStamps.length;

  const getEarnedStamp = (
    slotId: string
  ) => {
    return earnedStamps.find(
      (stamp) =>
        stamp.id === slotId ||
        stamp.questId === slotId
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
            Opening your passport...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /*
   * ERROR
   */
  if (!passport || errorMessage) {
    return (
      <SafeAreaView
        style={styles.safeArea}
        edges={["top", "bottom"]}
      >
        <View style={styles.screen}>
          <Header onBack={onBack} />

          <View style={styles.errorContainer}>
            <MaterialIcons
              name="menu-book"
              size={44}
              color={colors.green}
            />

            <Text style={styles.errorTitle}>
              Passport unavailable
            </Text>

            <Text style={styles.errorBody}>
              {errorMessage}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const vehicle =
    passport.vehicle ?? {};

  const vehicleName =
    vehicle.nickname?.trim() ||
    "MY JIMNY";

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={["top", "bottom"]}
    >
      <View style={styles.screen}>
        <Header onBack={onBack} />

        <View
          style={styles.passportViewport}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setContentSize((previous) =>
              previous.width === width && previous.height === height
                ? previous
                : { width, height }
            );
          }}
        >
          {passportWidth > 0 && (
          <View style={[styles.passportContent, { width: passportWidth }]}>
            {/* ================================= */}
            {/* PASSPORT IDENTITY PAGE */}
            {/* ================================= */}

            <ImageBackground
              source={passportOneImage}
              resizeMode="contain"
              style={[
                styles.passportOne,
                {
                  aspectRatio:
                    passportOneAspectRatio,
                },
              ]}
              imageStyle={styles.backgroundImage}
            >
              {/* ADVENTURE PASSPORT */}
              <Text
                style={
                  styles.adventurePassportTitle
                }
                numberOfLines={1}
              >
                Adventure Passport
              </Text>

              {/* BRAND */}
              <Text
                style={styles.passportBrand}
                numberOfLines={1}
              >
                SUZUKI JIMNY SIDE QUESTS
              </Text>

              {/* JIMNY */}
              <View style={styles.jimnyImageArea}>
                {vehicle.photoURL ? (
                  <Image
                    source={{
                      uri: vehicle.photoURL,
                    }}
                    style={styles.jimnyImage}
                    resizeMode="contain"
                  />
                ) : (
                  <MaterialIcons
                    name="directions-car"
                    size={50}
                    color={colors.green}
                  />
                )}
              </View>

              {/* MAKE */}
              <PassportDetail
                style={styles.makeField}
                label="Make"
                value={vehicle.make || "—"}
              />

              {/* MODEL */}
              <PassportDetail
                style={styles.modelField}
                label="Model"
                value={vehicle.model || "—"}
              />

              {/* PASSPORT NUMBER */}
              <PassportDetail
                style={
                  styles.passportNumberField
                }
                label="Passport No"
                value={
                  passport.passportNumber ||
                  "—"
                }
              />

              {/* VEHICLE NAME */}
              <PassportDetail
                style={
                  styles.vehicleNameField
                }
                label="Vehicle Name"
                value={vehicleName}
              />

              {/* COLOUR */}
              <PassportDetail
                style={styles.colourField}
                label="Colour"
                value={vehicle.colour || "—"}
              />

              {/* COUNTRY */}
              <PassportDetail
                style={styles.countryField}
                label="Country"
                value="SOUTH AFRICA"
              />

              {/* DATE OF ISSUE */}
              <PassportDetail
                style={styles.issueDateField}
                label="Date Of Issue"
                value={issueDate}
              />

              {/* YEAR */}
              <PassportDetail
                style={styles.yearField}
                label="Year Model"
                value={
                  vehicle.year
                    ? String(vehicle.year)
                    : "—"
                }
              />

              {/* OWNER */}
              <PassportDetail
                style={styles.ownerField}
                label="Owner"
                value={
                  passport.ownerName ||
                  "—"
                }
              />

              {/* ================================= */}
              {/* MACHINE-READABLE AREA */}
              {/* ================================= */}

              <View
                style={styles.machineDivider}
              />

              {/* LINE 1 */}
              <View
                style={styles.machineLineOne}
              >
                <Text
                  style={styles.machineText}
                  numberOfLines={1}
                >
                  ADVENTURES&lt;COMPLETED/STAMPS&lt;COLLECTED&lt;&lt;
                  {String(stampCount).padStart(
                    2,
                    "0"
                  )}
                </Text>

                <Text
                  style={styles.machineFiller}
                  numberOfLines={1}
                >
                  {
                    "<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<"
                  }
                </Text>
              </View>

              {/* LINE 2 */}
              <View
                style={styles.machineLineTwo}
              >
                <Text
                  style={styles.machineText}
                  numberOfLines={1}
                >
                  FIRST&lt;ADVENTURE&lt;DATE;&lt;
                  {firstAdventureDate}
                  &lt;&lt;LAST&lt;ADVENTURE&lt;DATE;&lt;
                  {lastAdventureDate}
                </Text>

                <Text
                  style={styles.machineFiller}
                  numberOfLines={1}
                >
                  {
                    "<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<"
                  }
                </Text>
              </View>
            </ImageBackground>

            {/* ================================= */}
            {/* STAMP PAGE */}
            {/* ================================= */}

            <ScrollView
              horizontal
              pagingEnabled
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={handleStampSwipe}
              style={styles.stampCarousel}
              contentContainerStyle={{ width: passportWidth * 2 }}
            >
              {[0, 1].map((pageIndex) => (
                <ImageBackground
                  key={pageIndex}
                  source={passportTwoImage}
                  resizeMode="contain"
                  style={[
                    styles.passportTwo,
                    { width: passportWidth, aspectRatio: passportTwoAspectRatio },
                  ]}
                  imageStyle={styles.backgroundImage}
                >
                  <Text style={styles.pageNumber}>
                    PAGE {pageIndex + 1} OF 2
                  </Text>

                  <Text style={styles.securedCounter}>
                    {stampCount} / {PASSPORT_STAMP_TOTAL} SECURED
                  </Text>

                  <View style={styles.stampHeaderDivider} />

                  <View style={styles.stampGrid}>
                    {stampSlots.slice(pageIndex * 6, pageIndex * 6 + 6).map((slot) => (
                      <StampPosition
                        key={slot.id}
                        slot={slot}
                        stamp={getEarnedStamp(slot.id)}
                      />
                    ))}
                  </View>

                  <View style={styles.pageDots}>
                    {[0, 1].map((dotIndex) => (
                      <View
                        key={dotIndex}
                        style={dotIndex === stampPage ? styles.pageDotActive : styles.pageDot}
                      />
                    ))}
                  </View>
                </ImageBackground>
              ))}
            </ScrollView>
          </View>
          )}
        </View>

        {/* ================================= */}
        {/* BOTTOM NAVIGATION */}
        {/* ================================= */}

        <BottomNav
          selected="passport"
          onExplore={onExplore}
          onHibernate={onAdventures}
          onPassport={() => {}}
          onProfile={onProfile}
        />
      </View>
    </SafeAreaView>
  );
}

/*
 * HEADER
 */
function Header({
  onBack,
}: {
  onBack?: () => void;
}) {
  return (
    <View style={styles.header}>
      <Pressable
        style={styles.headerSide}
        onPress={onBack}
        hitSlop={10}
      >
        <MaterialIcons
          name="arrow-back"
          size={22}
          color={colors.text}
        />

        <Text style={styles.backText}>
          Back
        </Text>
      </Pressable>

      <Text style={styles.headerTitle}>
        My Passport
      </Text>

      <Pressable
        style={[
          styles.headerSide,
          styles.headerRight,
        ]}
        hitSlop={10}
      >
        <MaterialIcons
          name="more-horiz"
          size={25}
          color={colors.text}
        />
      </Pressable>
    </View>
  );
}

/*
 * PASSPORT DETAIL
 */
function PassportDetail({
  label,
  value,
  style,
}: {
  label: string;
  value: string;
  style?: any;
}) {
  return (
    <View
      style={[
        styles.passportDetail,
        style,
      ]}
    >
      <Text
        style={styles.passportLabel}
        numberOfLines={1}
      >
        {label}
      </Text>

      <Text
        style={styles.passportValue}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.65}
      >
        {value}
      </Text>
    </View>
  );
}

/*
 * STAMP POSITION
 */
function StampPosition({
  slot,
  stamp,
}: {
  slot: StampSlot;
  stamp?: PassportStamp;
}) {
  const earned =
    Boolean(stamp);

  const earnedDate =
    stamp?.earnedAt
      ? formatStampDate(
          stamp.earnedAt
        )
      : "";

  return (
    <View style={styles.stampPosition}>
      {earned ? (
        <View style={styles.earnedStamp}>
          <MaterialIcons
            name="verified"
            size={31}
            color={colors.orange}
          />
        </View>
      ) : (
        <View style={styles.lockedStamp}>
          <MaterialIcons
            name="lock-outline"
            size={22}
            color="#9CA3AF"
          />
        </View>
      )}

      <Text
        style={styles.stampName}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {slot.name}
      </Text>

      {earnedDate ? (
        <Text style={styles.stampDate}>
          {earnedDate}
        </Text>
      ) : (
        <View
          style={styles.stampDateSpace}
        />
      )}
    </View>
  );
}

function formatStampDate(
  timestamp: Timestamp
) {
  try {
    return timestamp
      .toDate()
      .toLocaleDateString(
        "en-ZA",
        {
          day: "numeric",
          month: "short",
          year: "numeric",
        }
      );
  } catch {
    return "";
  }
}

const styles =
  StyleSheet.create({
    /*
     * SCREEN
     */

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
      minHeight: 92,
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
      width: 90,
      flexDirection: "row",
      alignItems: "center",
    },

    headerRight: {
      justifyContent:
        "flex-end",
    },

    backText: {
      marginLeft: 5,
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
      marginTop: 13,
      fontFamily:
        fonts.extraBold,
      fontSize: 18,
      color: colors.text,
    },

    errorBody: {
      marginTop: 7,
      maxWidth: 280,
      textAlign: "center",
      fontFamily:
        fonts.regular,
      fontSize: 12,
      lineHeight: 18,
      color:
        colors.textSecondary,
    },

    /*
     * SCROLL AREA
     */

    passportViewport: {
      flex: 1,
      width: "100%",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },

    passportContent: {
      alignSelf: "center",
    },

    stampCarousel: {
      width: "100%",
      marginTop: 17,
      flexGrow: 0,
    },

    backgroundImage: {
      width: "100%",
      height: "100%",
    },

    /*
     * PASSPORT ONE
     */

    passportOne: {
      position: "relative",
      width: "100%",
      overflow: "hidden",
    },

    adventurePassportTitle: {
      position: "absolute",
      left: "6.2%",
      top: "6.2%",
      width: "34%",

      fontFamily:
          fonts.regularItalic,
      fontSize: 14,
      color: colors.red,
    },

    passportBrand: {
      position: "absolute",
      left: "42%",
      top: "6.3%",
      width: "50%",

      fontFamily:
        fonts.extraBold,
      fontSize: 12,
      color: colors.text,
    },

    /*
     * JIMNY PHOTO
     */

    jimnyImageArea: {
      position: "absolute",
      left: "4%",
      top: "25%",
      width: "36%",
      height: "39%",

      alignItems: "center",
      justifyContent:
        "center",
    },

    jimnyImage: {
      width: "100%",
      height: "100%",
    },

    /*
     * PASSPORT DETAILS
     */

    passportDetail: {
      position: "absolute",
    },

    passportLabel: {
      fontFamily:
        fonts.regular,
      fontSize: 10,
      lineHeight: 12,
      color: colors.red,
    },

    passportValue: {
      marginTop: 1,

      fontFamily:
        fonts.extraBold,
      fontSize: 10,
      lineHeight: 12,

      color: colors.text,

      textTransform:
        "uppercase",
    },

    makeField: {
      left: "42%",
      top: "14%",
      width: "11%",
    },

    modelField: {
      left: "54%",
      top: "14%",
      width: "18%",
    },

    passportNumberField: {
      left: "72%",
      top: "14%",
      width: "23%",
    },

    vehicleNameField: {
      left: "42%",
      top: "25%",
      width: "42%",
    },

    colourField: {
      left: "42%",
      top: "36%",
      width: "45%",
    },

    countryField: {
      left: "42%",
      top: "47%",
      width: "52%",
    },

    issueDateField: {
      left: "42%",
      top: "58%",
      width: "25%",
    },

    yearField: {
      left: "72%",
      top: "58%",
      width: "22%",
    },

    ownerField: {
      left: "42%",
      top: "69%",
      width: "52%",
    },

    /*
     * MACHINE READABLE AREA
     */

    machineDivider: {
      position: "absolute",
      left: "6.8%",
      top: "82%",
      width: "86%",
      height: 1,
      backgroundColor:
        colors.green,
    },

    /*
     * Both machine-readable lines use the
     * exact same width as the divider.
     */
    machineLineOne: {
      position: "absolute",
      left: "6.8%",
      top: "85.2%",
      width: "86%",

      flexDirection: "row",
      alignItems: "center",
      overflow: "hidden",
    },

    machineLineTwo: {
      position: "absolute",
      left: "6.8%",
      top: "90%",
      width: "86%",

      flexDirection: "row",
      alignItems: "center",
      overflow: "hidden",
    },

    /*
     * The real information keeps its natural width.
     */
    machineText: {
      flexShrink: 0,

      fontFamily:
        fonts.extraBold,
      fontSize: 8,
      lineHeight: 10,

      color: colors.text,
    },

    /*
     * The remaining space is automatically
     * filled with < characters.
     */
    machineFiller: {
      flex: 1,
      overflow: "hidden",

      fontFamily:
        fonts.extraBold,
      fontSize: 8,
      lineHeight: 10,

      color: colors.text,
    },

    /*
     * PASSPORT TWO
     */

    passportTwo: {
      position: "relative",
      width: "100%",
      overflow: "hidden",
    },

    pageNumber: {
      position: "absolute",
      left: "5%",
      top: "5.2%",

      fontFamily:
        fonts.extraBold,
      fontSize: 15,
      color: colors.text,
    },

    securedCounter: {
      position: "absolute",
      right: "5%",
      top: "5.2%",

      fontFamily:
        fonts.extraBold,
      fontSize: 15,
      color:
        colors.textSecondary,
    },

    stampHeaderDivider: {
      position: "absolute",
      left: "5%",
      top: "12%",
      width: "90%",
      height: 1,
      backgroundColor:
        colors.green,
    },

    /*
     * 3 x 2 STAMP GRID
     */

    stampGrid: {
      position: "absolute",

      left: "5%",
      right: "5%",

      top: "17%",
      bottom: "11%",

      flexDirection: "row",
      flexWrap: "wrap",

      justifyContent:
        "space-between",

      alignContent:
        "space-between",
    },

    stampPosition: {
      width: "30%",
      height: "45%",

      alignItems: "center",
      justifyContent:
        "flex-start",
    },

    lockedStamp: {
      width: "82%",
      aspectRatio: 1,

      alignItems: "center",
      justifyContent:
        "center",

      borderWidth: 2,
      borderStyle: "dashed",
      borderColor:
        "#9CA3AF",

      borderRadius: 999,
    },

    earnedStamp: {
      width: "82%",
      aspectRatio: 1,

      alignItems: "center",
      justifyContent:
        "center",

      borderWidth: 2,
      borderColor:
        colors.orange,

      borderRadius: 999,

      backgroundColor:
        "rgba(255,255,255,0.25)",
    },

    stampName: {
      width: "100%",
      marginTop: 6,

      textAlign: "center",

      fontFamily:
        fonts.semiBold,

      fontSize: 11,
      lineHeight: 14,

      color: colors.text,
    },

    stampDate: {
      marginTop: 1,

      textAlign: "center",

      fontFamily:
        fonts.regular,

      fontSize: 9,

      color:
        colors.textSecondary,
    },

    stampDateSpace: {
      height: 11,
    },

    /*
     * PAGE DOTS
     */

    pageDots: {
      position: "absolute",

      bottom: "4.2%",
      left: 0,
      right: 0,

      flexDirection: "row",

      alignItems: "center",
      justifyContent:
        "center",

      gap: 6,
    },

    pageDotActive: {
      width: 8,
      height: 8,

      borderRadius: 4,

      backgroundColor:
        colors.text,
    },

    pageDot: {
      width: 8,
      height: 8,

      borderRadius: 4,

      backgroundColor:
        "#AEB3B8",
    },

    /*
     * FOOTER
     */

    footerPattern: {
      width: "100%",
      height: 27,
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
      borderTopWidth: 2,
      borderTopColor: colors.green,
    },

    navImage: {
      width: 28,
      height: 28,
      tintColor: colors.text,
    },

    navImageSelected: {
      tintColor: colors.green,
    },

    navProfileCircle: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 2,
      borderColor: colors.text,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
    },

    navProfileImage: {
      width: "100%",
      height: "100%",
    },

    navText: {
      fontFamily:
        fonts.medium,

      fontSize: 10,

      color: colors.text,

      textAlign: "center",
    },

    navTextSelected: {
      fontFamily: fonts.extraBold,
      color: colors.green,
    },
  });