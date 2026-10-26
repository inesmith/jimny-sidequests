import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  useEffect,
  useState,
} from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import BottomNav from "../components/BottomNav";
import * as ImagePicker from "expo-image-picker";
import {
  deleteDoc,
  doc,
  Timestamp,
  updateDoc,
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
import { colors, fonts } from "../theme/theme";
import type { Quest } from "./HomeScreen";

export type QuestProgress = {
  questId: string;
  status: "active" | "completed";
  currentStep: number;
  completedSteps: number[];
  startedAt: Timestamp | null;
  selectedTrail: string | null;

  driveStatus:
    | "ready"
    | "driving"
    | "stopped";

  driveStartedAt: Timestamp | null;
  driveStoppedAt: Timestamp | null;

  proofPhotoURL: string | null;
  completedAt: Timestamp | null;
};

type QuestTrackerScreenProps = {
  quest: Quest;
  progress: QuestProgress;
  onProgressChange: (
    progress: QuestProgress
  ) => void;
  onQuestCompleted: (
    progress: QuestProgress
  ) => void;
  onBackToExplore: () => void;
  onPassport: () => void;
  onAdventures: () => void;
  onProfile: () => void;
  onAbandon: () => void;
  onFindTrail: () => void;
};

function formatStartedAt(
  startedAt: Timestamp | null
) {
  if (!startedAt) {
    return "Today";
  }

  const date = startedAt.toDate();

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getElapsedTime(
  startedAt: Timestamp | null
) {
  if (!startedAt) {
    return "0m";
  }

  const milliseconds =
    Date.now() -
    startedAt.toDate().getTime();

  const totalMinutes = Math.max(
    0,
    Math.floor(milliseconds / 60000)
  );

  const hours =
    Math.floor(totalMinutes / 60);

  const minutes =
    totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
}

function getDriveElapsedMilliseconds(
  startedAt: Timestamp | null,
  stoppedAt: Timestamp | null
) {
  if (!startedAt) {
    return 0;
  }

  const start =
    startedAt.toDate().getTime();

  const end = stoppedAt
    ? stoppedAt.toDate().getTime()
    : Date.now();

  return Math.max(0, end - start);
}

function formatDriveElapsed(
  milliseconds: number
) {
  const totalSeconds = Math.max(
    0,
    Math.floor(milliseconds / 1000)
  );

  const hours = Math.floor(
    totalSeconds / 3600
  );

  const minutes = Math.floor(
    (totalSeconds % 3600) / 60
  );

  const seconds =
    totalSeconds % 60;

  const hoursText = String(
    hours
  ).padStart(2, "0");

  const minutesText = String(
    minutes
  ).padStart(2, "0");

  const secondsText = String(
    seconds
  ).padStart(2, "0");

  return `${hoursText}:${minutesText}:${secondsText}`;
}

export default function QuestTrackerScreen({
  quest,
  progress,
  onProgressChange,
  onQuestCompleted,
  onBackToExplore,
  onPassport,
  onAdventures,
  onProfile,
  onAbandon,
  onFindTrail,
}: QuestTrackerScreenProps) {
  const user = auth.currentUser;

  const [
    isUpdatingDrive,
    setIsUpdatingDrive,
  ] = useState(false);

  const [
    isUploadingPhoto,
    setIsUploadingPhoto,
  ] = useState(false);

  const [
    selectedProofPhoto,
    setSelectedProofPhoto,
  ] = useState<string | null>(
    null
  );

  const [
    driveElapsedMilliseconds,
    setDriveElapsedMilliseconds,
  ] = useState(
    getDriveElapsedMilliseconds(
      progress.driveStartedAt,
      progress.driveStoppedAt
    )
  );

  useEffect(() => {
    setDriveElapsedMilliseconds(
      getDriveElapsedMilliseconds(
        progress.driveStartedAt,
        progress.driveStoppedAt
      )
    );

    if (
      progress.driveStatus !==
        "driving" ||
      !progress.driveStartedAt
    ) {
      return;
    }

    const interval = setInterval(() => {
      setDriveElapsedMilliseconds(
        getDriveElapsedMilliseconds(
          progress.driveStartedAt,
          null
        )
      );
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [
    progress.driveStatus,
    progress.driveStartedAt,
    progress.driveStoppedAt,
  ]);

  const isComplete =
    progress.completedSteps.length >=
    quest.steps.length;

  const progressPercentage =
    quest.steps.length > 0
      ? Math.min(
          100,
          (progress.completedSteps.length /
            quest.steps.length) *
            100
        )
      : 0;

  const currentStep = Math.min(
    quest.steps.length,
    Math.max(
      1,
      progress.currentStep
    )
  );

  const startDrive = async () => {
    if (
      !user ||
      !progress.selectedTrail ||
      isUpdatingDrive
    ) {
      return;
    }

    setIsUpdatingDrive(true);

    try {
      const driveStartedAt =
        Timestamp.now();

      const updatedProgress: QuestProgress =
        {
          ...progress,
          driveStatus: "driving",
          driveStartedAt,
          driveStoppedAt: null,
        };

      await updateDoc(
        doc(
          db,
          "users",
          user.uid,
          "quests",
          quest.id
        ),
        {
          driveStatus: "driving",
          driveStartedAt,
          driveStoppedAt: null,
        }
      );

      onProgressChange(
        updatedProgress
      );
    } catch (error) {
      console.error(
        "Unable to start drive:",
        error
      );

      Alert.alert(
        "Something went wrong",
        "We couldn't start your drive timer. Please try again."
      );
    } finally {
      setIsUpdatingDrive(false);
    }
  };

  const confirmStartDrive = () => {
    if (
      !progress.selectedTrail ||
      progress.driveStatus !== "ready"
    ) {
      return;
    }

    Alert.alert(
      "Ready to start your drive?",
      `Your timer will start as soon as you press START DRIVE.\n\nDrive ${progress.selectedTrail}, then return here and stop the timer when you've finished. You'll then need to upload a photo of your Jimny as proof.`,
      [
        {
          text: "Not Yet",
          style: "cancel",
        },
        {
          text: "Start Drive",
          onPress: startDrive,
        },
      ]
    );
  };

  const stopDrive = async () => {
    if (
      !user ||
      !progress.driveStartedAt ||
      isUpdatingDrive
    ) {
      return;
    }

    setIsUpdatingDrive(true);

    try {
      const driveStoppedAt =
        Timestamp.now();

      const completedSteps =
        Array.from(
          new Set([
            ...progress.completedSteps,
            2,
          ])
        ).sort((a, b) => a - b);

      const nextStep = Math.min(
        quest.steps.length,
        3
      );

      const updatedProgress: QuestProgress =
        {
          ...progress,
          driveStatus: "stopped",
          driveStoppedAt,
          completedSteps,
          currentStep: nextStep,
        };

      await updateDoc(
        doc(
          db,
          "users",
          user.uid,
          "quests",
          quest.id
        ),
        {
          driveStatus: "stopped",
          driveStoppedAt,
          completedSteps,
          currentStep: nextStep,
        }
      );

      onProgressChange(
        updatedProgress
      );

      setDriveElapsedMilliseconds(
        getDriveElapsedMilliseconds(
          progress.driveStartedAt,
          driveStoppedAt
        )
      );
    } catch (error) {
      console.error(
        "Unable to stop drive:",
        error
      );

      Alert.alert(
        "Something went wrong",
        "We couldn't stop your drive timer. Please try again."
      );
    } finally {
      setIsUpdatingDrive(false);
    }
  };

  const confirmStopDrive = () => {
    if (
      progress.driveStatus !==
      "driving"
    ) {
      return;
    }

    Alert.alert(
      "Finish this drive?",
      "Only stop the timer once you've finished the trail. After stopping, you'll need to upload a photo of your Jimny as proof.",
      [
        {
          text: "Keep Driving",
          style: "cancel",
        },
        {
          text: "End Drive",
          onPress: stopDrive,
        },
      ]
    );
  };

  const choosePhotoFromLibrary =
    async () => {
      try {
        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permission.granted) {
          Alert.alert(
            "Photo permission needed",
            "Please allow access to your photos so you can choose a proof photo."
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
              aspect: [4, 3],
              quality: 0.8,
            }
          );

        if (
          !result.canceled &&
          result.assets.length > 0
        ) {
          setSelectedProofPhoto(
            result.assets[0].uri
          );
        }
      } catch (error) {
        console.error(
          "Unable to choose photo:",
          error
        );

        Alert.alert(
          "Something went wrong",
          "We couldn't open your photo library. Please try again."
        );
      }
    };

  const takePhoto = async () => {
    try {
      const permission =
        await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Camera permission needed",
          "Please allow camera access so you can take your proof photo."
        );
        return;
      }

      const result =
        await ImagePicker.launchCameraAsync(
          {
            mediaTypes: [
              "images",
            ],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 0.8,
          }
        );

      if (
        !result.canceled &&
        result.assets.length > 0
      ) {
        setSelectedProofPhoto(
          result.assets[0].uri
        );
      }
    } catch (error) {
      console.error(
        "Unable to take photo:",
        error
      );

      Alert.alert(
        "Something went wrong",
        "We couldn't open your camera. Please try again."
      );
    }
  };

  const chooseProofPhoto = () => {
    Alert.alert(
      "Add your proof photo",
      "Take a photo of your Jimny on the trail, or choose one from your photo library.",
      [
        {
          text: "Take Photo",
          onPress: takePhoto,
        },
        {
          text: "Choose from Library",
          onPress:
            choosePhotoFromLibrary,
        },
        {
          text: "Cancel",
          style: "cancel",
        },
      ]
    );
  };

  const uploadProofPhoto =
    async () => {
      if (
        !user ||
        !selectedProofPhoto ||
        isUploadingPhoto
      ) {
        return;
      }

      setIsUploadingPhoto(true);

      try {
        const response =
          await fetch(
            selectedProofPhoto
          );

        const blob =
          await response.blob();

        const photoRef = ref(
          storage,
          `users/${user.uid}/quests/${quest.id}/proof-${Date.now()}.jpg`
        );

        await uploadBytes(
          photoRef,
          blob,
          {
            contentType:
              "image/jpeg",
          }
        );

        const proofPhotoURL =
          await getDownloadURL(
            photoRef
          );

        const completedSteps =
          Array.from(
            new Set([
              ...progress.completedSteps,
              3,
            ])
          ).sort(
            (a, b) => a - b
          );

        const nextStep = Math.min(
          quest.steps.length,
          3
        );

        const updatedProgress: QuestProgress =
          {
            ...progress,
            proofPhotoURL,
            completedSteps,
            currentStep:
              nextStep,
          };

        await updateDoc(
          doc(
            db,
            "users",
            user.uid,
            "quests",
            quest.id
          ),
          {
            proofPhotoURL,
            completedSteps,
            currentStep:
              nextStep,
          }
        );

        onProgressChange(
          updatedProgress
        );

        setSelectedProofPhoto(
          null
        );
      } catch (error) {
        console.error(
          "Unable to upload proof photo:",
          error
        );

        Alert.alert(
          "Upload failed",
          "We couldn't upload your proof photo. Please try again."
        );
      } finally {
        setIsUploadingPhoto(
          false
        );
      }
    };

  const handleStepPress = (
    stepNumber: number,
    current: boolean
  ) => {
    if (!current) {
      return;
    }

    if (stepNumber === 1) {
      onFindTrail();
      return;
    }

    if (stepNumber === 2) {
      if (
        progress.driveStatus ===
        "driving"
      ) {
        confirmStopDrive();
      } else {
        confirmStartDrive();
      }

      return;
    }

    if (stepNumber === 3) {
      chooseProofPhoto();
    }
  };

  const abandonQuest = () => {
    Alert.alert(
      "Abandon Side Quest?",
      `Your progress for ${quest.title} will be removed.`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Abandon Quest",
          style: "destructive",
          onPress: async () => {
            if (!user) {
              return;
            }

            try {
              await deleteDoc(
                doc(
                  db,
                  "users",
                  user.uid,
                  "quests",
                  quest.id
                )
              );

              onAbandon();
            } catch (error) {
              console.error(
                "Unable to abandon quest:",
                error
              );

              Alert.alert(
                "Something went wrong",
                "We couldn't abandon this quest. Please try again."
              );
            }
          },
        },
      ]
    );
  };

  const completeQuest = async () => {
    if (!user || !isComplete) {
      return;
    }

    try {
      const completedAt =
        Timestamp.now();

      const completedProgress: QuestProgress =
        {
          ...progress,
          status: "completed",
          completedAt,
        };

      await updateDoc(
        doc(
          db,
          "users",
          user.uid,
          "quests",
          quest.id
        ),
        {
          status: "completed",
          completedAt,
        }
      );

      onProgressChange(
        completedProgress
      );

      onQuestCompleted(
        completedProgress
      );
    } catch (error) {
      console.error(
        "Unable to complete quest:",
        error
      );

      Alert.alert(
        "Something went wrong",
        "We couldn't complete this quest. Please try again."
      );
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
          <View
            style={styles.headerSide}
          />

          <Text
            style={styles.headerTitle}
          >
            Quest Tracker
          </Text>

          <Pressable
            style={styles.menuButton}
            hitSlop={10}
          >
            <MaterialIcons
              name="more-horiz"
              size={26}
              color={colors.text}
            />
          </Pressable>
        </View>

        {/* CONTENT */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={
            styles.scrollContent
          }
          showsVerticalScrollIndicator={
            false
          }
        >
          <View style={styles.content}>
            <Text
              style={
                styles.activeQuestLabel
              }
            >
              ACTIVE QUEST
            </Text>

            <Text
              style={styles.questTitle}
            >
              {quest.title}
            </Text>

            <Text
              style={styles.startedText}
            >
              Started: Today,{" "}
              {formatStartedAt(
                progress.startedAt
              )}{" "}
              | Time elapsed:{" "}
              {getElapsedTime(
                progress.startedAt
              )}
            </Text>

            {/* PROGRESS */}
            <View
              style={
                styles.progressHeadingRow
              }
            >
              <Text
                style={
                  styles.progressHeading
                }
              >
                Quest Progress
              </Text>

              <Text
                style={
                  styles.progressHeading
                }
              >
                Step {currentStep} of{" "}
                {quest.steps.length}
              </Text>
            </View>

            <View
              style={styles.progressTrack}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${progressPercentage}%`,
                  },
                ]}
              />
            </View>

            {/* CHECKLIST */}
            <Text
              style={
                styles.checklistHeading
              }
            >
              REQUIREMENT CHECKLIST
            </Text>

            <View
              style={styles.checklist}
            >
              {quest.steps.map(
                (step, index) => {
                  const stepNumber =
                    index + 1;

                  const completed =
                    progress.completedSteps.includes(
                      stepNumber
                    );

                  const current =
                    !completed &&
                    stepNumber ===
                      currentStep;

                  const locked =
                    !completed &&
                    !current;

                  const isInteractive =
                    current &&
                    (stepNumber === 1 ||
                      stepNumber === 2 ||
                      stepNumber === 3);

                  return (
                    <Pressable
                      key={`${quest.id}-${stepNumber}`}
                      disabled={
                        !isInteractive ||
                        isUpdatingDrive ||
                        isUploadingPhoto
                      }
                      onPress={() =>
                        handleStepPress(
                          stepNumber,
                          current
                        )
                      }
                      style={[
                        styles.step,
                        completed &&
                          styles.completedStep,
                        current &&
                          styles.currentStep,
                        locked &&
                          styles.lockedStep,
                      ]}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          locked &&
                            styles.checkboxLocked,
                        ]}
                      >
                        {completed && (
                          <MaterialIcons
                            name="check"
                            size={22}
                            color={
                              colors.text
                            }
                          />
                        )}
                      </View>

                      <View
                        style={
                          styles.stepContent
                        }
                      >
                        <Text
                          style={[
                            styles.stepTitle,
                            current &&
                              styles.currentStepTitle,
                            locked &&
                              styles.lockedStepText,
                          ]}
                        >
                          {step}
                        </Text>

                        {current &&
                          stepNumber ===
                            2 &&
                          progress.selectedTrail && (
                            <>
                              <Text
                                style={
                                  styles.stepSubtitle
                                }
                              >
                                Selected trail:{" "}
                                {
                                  progress.selectedTrail
                                }
                              </Text>

                              {progress.driveStatus ===
                                "ready" && (
                                <Text
                                  style={
                                    styles.driveActionText
                                  }
                                >
                                  Tap to start
                                  your drive
                                </Text>
                              )}

                              {progress.driveStatus ===
                                "driving" && (
                                <View
                                  style={
                                    styles.driveStatusRow
                                  }
                                >
                                  <View
                                    style={
                                      styles.driveLiveDot
                                    }
                                  />

                                  <View
                                    style={
                                      styles.driveStatusContent
                                    }
                                  >
                                    <Text
                                      style={
                                        styles.driveStatusLabel
                                      }
                                    >
                                      DRIVE IN
                                      PROGRESS
                                    </Text>

                                    <Text
                                      style={
                                        styles.driveTimer
                                      }
                                    >
                                      {formatDriveElapsed(
                                        driveElapsedMilliseconds
                                      )}
                                    </Text>

                                    <Text
                                      style={
                                        styles.stopDriveText
                                      }
                                    >
                                      Tap to stop
                                      drive
                                    </Text>
                                  </View>
                                </View>
                              )}
                            </>
                          )}

                        {completed &&
                          stepNumber ===
                            2 &&
                          progress.selectedTrail &&
                          progress.driveStartedAt && (
                            <Text
                              style={
                                styles.stepSubtitle
                              }
                            >
                              {
                                progress.selectedTrail
                              }{" "}
                              •{" "}
                              {formatDriveElapsed(
                                getDriveElapsedMilliseconds(
                                  progress.driveStartedAt,
                                  progress.driveStoppedAt
                                )
                              )}
                            </Text>
                          )}

                        {current &&
                          stepNumber ===
                            3 && (
                            <>
                              {!selectedProofPhoto && (
                                <Text
                                  style={
                                    styles.driveActionText
                                  }
                                >
                                  Tap to add
                                  your proof photo
                                </Text>
                              )}

                              {selectedProofPhoto && (
                                <View
                                  style={
                                    styles.photoPreviewSection
                                  }
                                >
                                  <Image
                                    source={{
                                      uri: selectedProofPhoto,
                                    }}
                                    style={
                                      styles.photoPreview
                                    }
                                    resizeMode="cover"
                                  />

                                  <Pressable
                                    style={
                                      styles.uploadPhotoButton
                                    }
                                    onPress={
                                      uploadProofPhoto
                                    }
                                    disabled={
                                      isUploadingPhoto
                                    }
                                  >
                                    {isUploadingPhoto ? (
                                      <ActivityIndicator
                                        size="small"
                                        color={
                                          colors.white
                                        }
                                      />
                                    ) : (
                                      <Text
                                        style={
                                          styles.uploadPhotoButtonText
                                        }
                                      >
                                        UPLOAD PHOTO
                                      </Text>
                                    )}
                                  </Pressable>

                                  {!isUploadingPhoto && (
                                    <Pressable
                                      onPress={
                                        chooseProofPhoto
                                      }
                                      hitSlop={
                                        8
                                      }
                                    >
                                      <Text
                                        style={
                                          styles.changePhotoText
                                        }
                                      >
                                        Choose a different photo
                                      </Text>
                                    </Pressable>
                                  )}
                                </View>
                              )}
                            </>
                          )}

                        {completed &&
                          stepNumber ===
                            3 &&
                          progress.proofPhotoURL && (
                            <View
                              style={
                                styles.uploadedPhotoRow
                              }
                            >
                              <Image
                                source={{
                                  uri: progress.proofPhotoURL,
                                }}
                                style={
                                  styles.uploadedPhotoThumbnail
                                }
                                resizeMode="cover"
                              />

                              <Text
                                style={
                                  styles.photoUploadedText
                                }
                              >
                                Proof photo uploaded
                              </Text>
                            </View>
                          )}

                        {isUpdatingDrive &&
                          current &&
                          stepNumber ===
                            2 && (
                            <ActivityIndicator
                              size="small"
                              color={
                                colors.green
                              }
                              style={
                                styles.driveLoader
                              }
                            />
                          )}
                      </View>
                    </Pressable>
                  );
                }
              )}
            </View>
          </View>

          {/* PUSH ACTIONS DOWN ON TALL SCREENS */}
          <View
            style={styles.flexSpacer}
          />

          <View style={styles.actions}>
            <Pressable
              disabled={!isComplete}
              style={[
                styles.completeButton,
                !isComplete &&
                  styles.completeButtonDisabled,
              ]}
              onPress={completeQuest}
            >
              <Text
                style={[
                  styles.completeButtonText,
                  !isComplete &&
                    styles.completeButtonTextDisabled,
                ]}
              >
                COMPLETE QUEST
              </Text>
            </Pressable>

            <Pressable
              onPress={abandonQuest}
              hitSlop={10}
            >
              <Text
                style={
                  styles.abandonText
                }
              >
                Abandon Quest
              </Text>
            </Pressable>
          </View>
        </ScrollView>

        {/* BOTTOM NAV */}
        <BottomNav selected="hibernate" onExplore={onBackToExplore} onHibernate={onAdventures} onPassport={onPassport} onProfile={onProfile} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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

  header: {
    minHeight: 92,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    borderBottomWidth:
      StyleSheet.hairlineWidth,
    borderBottomColor:
      colors.divider,
    backgroundColor:
      colors.background,
  },

  headerSide: {
    width: 60,
  },

  headerTitle: {
    flex: 1,
    fontFamily: fonts.extraBold,
    fontSize: 16,
    lineHeight: 23,
    textAlign: "center",
    color: colors.red,
  },

  menuButton: {
    width: 60,
    minHeight: 44,
    alignItems: "flex-end",
    justifyContent: "center",
  },

  scroll: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
  },

  content: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 22,
  },

  activeQuestLabel: {
    fontFamily: fonts.extraBold,
    fontSize: 12,
    lineHeight: 17,
    color: colors.red,
  },

  questTitle: {
    marginTop: 7,
    fontFamily: fonts.extraBold,
    fontSize: 28,
    lineHeight: 34,
    color: colors.text,
  },

  startedText: {
    marginTop: 5,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 21,
    color: colors.textSecondary,
  },

  progressHeadingRow: {
    flexDirection: "row",
    justifyContent:
      "space-between",
    alignItems: "center",
    marginTop: 25,
  },

  progressHeading: {
    fontFamily: fonts.extraBold,
    fontSize: 14,
    lineHeight: 18,
    color: colors.text,
  },

  progressTrack: {
    width: "100%",
    height: 10,
    overflow: "hidden",
    marginTop: 8,
    borderRadius: 6,
    backgroundColor: "#E4E1D9",
  },

  progressFill: {
    height: "100%",
    borderRadius: 6,
    backgroundColor:
      colors.orange,
  },

  checklistHeading: {
    marginTop: 27,
    marginBottom: 16,
    fontFamily: fonts.extraBold,
    fontSize: 12,
    lineHeight: 17,
    color: colors.red,
  },

  checklist: {
    gap: 11,
  },

  step: {
    width: "100%",
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: 4,
  },

  completedStep: {
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: "#F3F4F6",
  },

  currentStep: {
    borderWidth: 1.5,
    borderColor: colors.orange,
    backgroundColor:
      colors.background,
    shadowColor: "#000000",
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.17,
    shadowRadius: 4,
    elevation: 3,
  },

  lockedStep: {
    backgroundColor:
      colors.background,
  },

  checkbox: {
    width: 27,
    height: 27,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: colors.text,
    borderRadius: 2,
  },

  checkboxLocked: {
    borderColor: "#C5C8CE",
  },

  stepContent: {
    flex: 1,
    marginLeft: 14,
  },

  stepTitle: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 21,
    color: colors.textSecondary,
  },

  currentStepTitle: {
    fontFamily: fonts.extraBold,
    color: colors.text,
  },

  lockedStepText: {
    color: "#C7CAD0",
  },

  stepSubtitle: {
    marginTop: 2,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },

  driveActionText: {
    marginTop: 5,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.orange,
  },

  driveStatusRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "flex-start",
  },

  driveLiveDot: {
    width: 8,
    height: 8,
    marginTop: 5,
    marginRight: 8,
    borderRadius: 4,
    backgroundColor: colors.red,
  },

  driveStatusContent: {
    flex: 1,
  },

  driveStatusLabel: {
    fontFamily: fonts.extraBold,
    fontSize: 11,
    lineHeight: 14,
    color: colors.red,
  },

  driveTimer: {
    marginTop: 1,
    fontFamily: fonts.extraBold,
    fontSize: 20,
    lineHeight: 25,
    color: colors.text,
  },

  stopDriveText: {
    marginTop: 2,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.orange,
  },

  driveLoader: {
    marginTop: 8,
    alignSelf: "flex-start",
  },

  photoPreviewSection: {
    marginTop: 10,
    width: "100%",
  },

  photoPreview: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 4,
    backgroundColor: "#E4E1D9",
  },

  uploadPhotoButton: {
    width: "100%",
    minHeight: 44,
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    backgroundColor: colors.green,
  },

  uploadPhotoButtonText: {
    fontFamily: fonts.extraBold,
    fontSize: 13,
    color: colors.white,
  },

  changePhotoText: {
    alignSelf: "center",
    marginTop: 8,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    textDecorationLine:
      "underline",
    color: colors.textSecondary,
  },

  uploadedPhotoRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },

  uploadedPhotoThumbnail: {
    width: 42,
    height: 42,
    borderRadius: 3,
    backgroundColor: "#E4E1D9",
  },

  photoUploadedText: {
    flex: 1,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },

  flexSpacer: {
    flex: 1,
    minHeight: 100,
  },

  actions: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingBottom: 20,
  },

  completeButton: {
    width: "100%",
    minHeight: 61,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    backgroundColor:
      colors.green,
  },

  completeButtonDisabled: {
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: "#F2F3F5",
  },

  completeButtonText: {
    fontFamily: fonts.extraBold,
    fontSize: 16,
    color: colors.white,
  },

  completeButtonTextDisabled: {
    color: "#A6ADBA",
  },

  abandonText: {
    alignSelf: "center",
    marginTop: 14,
    fontFamily: fonts.semiBold,
    fontSize: 14,
    textDecorationLine:
      "underline",
    color: "#A6ADBA",
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
    justifyContent: "center",
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
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.text,
    textAlign: "center",
  },

  navTextSelected: {
    fontFamily: fonts.extraBold,
  },
});