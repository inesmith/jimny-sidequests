import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  onAuthStateChanged,
  type User,
} from "firebase/auth";

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

import type {
  NotificationItem,
} from "../screens/NotificationsScreen";

type ExperienceNotificationData = {
  id: string;
  title: string;
  category: string;
  date: string;
  time: string;
  eventDate: string;
  location: string;
  description: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

type NotificationState = {
  notificationId: string;
  isRead: boolean;
  lastSeenUpdatedAt: Timestamp | null;
};

export type BackendNotificationItem =
  NotificationItem & {
    createdAt: Timestamp | null;
    updatedAt: Timestamp | null;
  };

export default function useNotifications() {
  const [
    currentUser,
    setCurrentUser,
  ] = useState<User | null>(
    auth.currentUser
  );

  const [
    experiences,
    setExperiences,
  ] = useState<
    ExperienceNotificationData[]
  >([]);

  const [
    notificationStates,
    setNotificationStates,
  ] = useState<
    Record<
      string,
      NotificationState
    >
  >({});

  const [
    isLoadingNotifications,
    setIsLoadingNotifications,
  ] = useState(true);

  /*
   * LISTEN FOR AUTH CHANGES
   */
  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        (user) => {
          setCurrentUser(
            user
          );

          if (!user) {
            setExperiences(
              []
            );

            setNotificationStates(
              {}
            );

            setIsLoadingNotifications(
              false
            );
          } else {
            setIsLoadingNotifications(
              true
            );
          }
        }
      );

    return unsubscribe;
  }, []);

  /*
   * LISTEN TO REAL EXPERIENCES
   */
  useEffect(() => {
    if (!currentUser) {
      setExperiences(
        []
      );

      return;
    }

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

    const unsubscribe =
      onSnapshot(
        experiencesQuery,
        (snapshot) => {
          const loadedExperiences =
            snapshot.docs.map(
              (
                experienceDoc
              ) => {
                const data =
                  experienceDoc.data();

                const location =
                  typeof data.location ===
                  "string"
                    ? data.location
                    : data.location
                        ?.formattedAddress ??
                      "";

                return {
                  id:
                    experienceDoc.id,

                  title:
                    data.title ??
                    "",

                  category:
                    data.category ??
                    "",

                  date:
                    data.date ??
                    "",

                  time:
                    data.time ??
                    data.eventTime ??
                    "Time TBC",

                  eventDate:
                    data.eventDate ??
                    "",

                  location,

                  description:
                    data.description ??
                    "",

                  createdAt:
                    data.createdAt instanceof
                    Timestamp
                      ? data.createdAt
                      : null,

                  updatedAt:
                    data.updatedAt instanceof
                    Timestamp
                      ? data.updatedAt
                      : null,
                };
              }
            );

          setExperiences(
            loadedExperiences
          );

          setIsLoadingNotifications(
            false
          );
        },
        (error) => {
          console.error(
            "Unable to listen to experiences:",
            error
          );

          setIsLoadingNotifications(
            false
          );
        }
      );

    return unsubscribe;
  }, [currentUser]);

  /*
   * LISTEN TO THIS USER'S
   * READ / UNREAD STATE
   */
  useEffect(() => {
    if (!currentUser) {
      setNotificationStates(
        {}
      );

      return;
    }

    const statesRef =
      collection(
        db,
        "users",
        currentUser.uid,
        "notificationStates"
      );

    const unsubscribe =
      onSnapshot(
        statesRef,
        (snapshot) => {
          const states: Record<
            string,
            NotificationState
          > = {};

          snapshot.docs.forEach(
            (stateDoc) => {
              const data =
                stateDoc.data();

              states[
                stateDoc.id
              ] = {
                notificationId:
                  stateDoc.id,

                isRead:
                  data.isRead ===
                  true,

                lastSeenUpdatedAt:
                  data.lastSeenUpdatedAt instanceof
                  Timestamp
                    ? data.lastSeenUpdatedAt
                    : null,
              };
            }
          );

          setNotificationStates(
            states
          );
        },
        (error) => {
          console.error(
            "Unable to listen to notification states:",
            error
          );
        }
      );

    return unsubscribe;
  }, [currentUser]);

  /*
   * TURN BACKEND EXPERIENCES
   * INTO NOTIFICATIONS
   */
  const notifications =
    useMemo<
      BackendNotificationItem[]
    >(() => {
      const now =
        new Date();

      const today =
        new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate()
        );

      return experiences
        .filter(
          (experience) => {
            if (
              !experience.eventDate
            ) {
              return true;
            }

            const eventDate =
              new Date(
                `${experience.eventDate}T00:00:00`
              );

            return (
              eventDate >=
              today
            );
          }
        )
        .map(
          (experience) => {
            const notificationId =
              `experience_${experience.id}`;

            const state =
              notificationStates[
                notificationId
              ];

            const hasBeenUpdated =
              !!state
                ?.lastSeenUpdatedAt &&
              !!experience.updatedAt &&
              experience.updatedAt.toMillis() >
                state.lastSeenUpdatedAt.toMillis();

            const notificationDate =
              hasBeenUpdated
                ? experience.updatedAt
                : experience.createdAt;

            return {
              id:
                notificationId,

              section:
                getSection(
                  notificationDate
                ),

              type:
                hasBeenUpdated
                  ? "eventUpdate"
                  : "experience",

              label:
                hasBeenUpdated
                  ? "EVENT UPDATE"
                  : "NEW EXPERIENCE",

              title:
                experience.title,

              body:
                buildExperienceBody(
                  experience
                ),

              time:
                formatNotificationTime(
                  notificationDate
                ),

              isRead:
                hasBeenUpdated
                  ? false
                  : state
                      ?.isRead ===
                    true,

              experienceId:
                experience.id,

              createdAt:
                experience.createdAt,

              updatedAt:
                experience.updatedAt,
            } satisfies BackendNotificationItem;
          }
        )
        .sort(
          (a, b) =>
            getTimestampMillis(
              b.updatedAt ??
                b.createdAt
            ) -
            getTimestampMillis(
              a.updatedAt ??
                a.createdAt
            )
        );
    }, [
      experiences,
      notificationStates,
    ]);

  const unreadCount =
    notifications.filter(
      (notification) =>
        !notification.isRead
    ).length;

  /*
   * MARK ONE AS READ
   */
  const markNotificationAsRead =
    async (
      notification: BackendNotificationItem
    ) => {
      if (!currentUser) {
        return;
      }

      try {
        const stateRef =
          doc(
            db,
            "users",
            currentUser.uid,
            "notificationStates",
            notification.id
          );

        await setDoc(
          stateRef,
          {
            notificationId:
              notification.id,

            isRead: true,

            experienceId:
              notification.experienceId ??
              null,

            lastSeenUpdatedAt:
              notification.updatedAt ??
              notification.createdAt ??
              Timestamp.now(),

            readAt:
              serverTimestamp(),

            updatedAt:
              serverTimestamp(),
          },
          {
            merge: true,
          }
        );
      } catch (error) {
        console.error(
          "Unable to mark notification as read:",
          error
        );
      }
    };

  /*
   * MARK EVERYTHING AS READ
   */
  const markAllAsRead =
    async () => {
      if (!currentUser) {
        return;
      }

      const unread =
        notifications.filter(
          (notification) =>
            !notification.isRead
        );

      if (
        unread.length === 0
      ) {
        return;
      }

      try {
        const batch =
          writeBatch(db);

        unread.forEach(
          (notification) => {
            const stateRef =
              doc(
                db,
                "users",
                currentUser.uid,
                "notificationStates",
                notification.id
              );

            batch.set(
              stateRef,
              {
                notificationId:
                  notification.id,

                isRead: true,

                experienceId:
                  notification.experienceId ??
                  null,

                lastSeenUpdatedAt:
                  notification.updatedAt ??
                  notification.createdAt ??
                  Timestamp.now(),

                readAt:
                  serverTimestamp(),

                updatedAt:
                  serverTimestamp(),
              },
              {
                merge: true,
              }
            );
          }
        );

        await batch.commit();
      } catch (error) {
        console.error(
          "Unable to mark all notifications as read:",
          error
        );
      }
    };

  /*
   * LOAD REAL EXPERIENCE
   * WHEN NOTIFICATION IS OPENED
   */
  const getExperienceFromNotification =
    async (
      notification: BackendNotificationItem
    ) => {
      if (
        !notification.experienceId
      ) {
        return null;
      }

      try {
        const experienceRef =
          doc(
            db,
            "experiences",
            notification.experienceId
          );

        const snapshot =
          await getDoc(
            experienceRef
          );

        if (!snapshot.exists()) {
          return null;
        }

        const data =
          snapshot.data();

        return {
          id:
            snapshot.id,

          title:
            data.title ??
            "",

          category:
            data.category ??
            "",

          date:
            data.date ??
            "",

          eventDate:
            data.eventDate ??
            "",

          time:
            data.time ??
            data.eventTime ??
            "Time TBC",

          location:
            typeof data.location ===
            "string"
              ? data.location
              : data.location
                  ?.formattedAddress ??
                "",

          description:
            data.description ??
            "",

          locationPlaceId:
            data.location
              ?.placeId ??
            null,

          latitude:
            data.location
              ?.latitude ??
            null,

          longitude:
            data.location
              ?.longitude ??
            null,
        };
      } catch (error) {
        console.error(
          "Unable to load notification experience:",
          error
        );

        return null;
      }
    };

  return {
    notifications,
    unreadCount,
    isLoadingNotifications,
    markNotificationAsRead,
    markAllAsRead,
    getExperienceFromNotification,
  };
}

/*
 * BUILD CARD BODY
 */
function buildExperienceBody(
  experience: ExperienceNotificationData
) {
  const firstLine = [
    experience.date,
    experience.time,
  ]
    .filter(Boolean)
    .join(" • ");

  const secondLine =
    experience.location;

  const thirdLine =
    experience.description;

  return [
    firstLine,
    secondLine,
    thirdLine,
  ]
    .filter(Boolean)
    .join("\n");
}

/*
 * TODAY / YESTERDAY / EARLIER
 */
function getSection(
  timestamp: Timestamp | null
): NotificationItem["section"] {
  if (!timestamp) {
    return "EARLIER";
  }

  const date =
    timestamp.toDate();

  const now =
    new Date();

  const today =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

  const notificationDay =
    new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );

  const difference =
    today.getTime() -
    notificationDay.getTime();

  const oneDay =
    24 *
    60 *
    60 *
    1000;

  if (
    difference <
    oneDay
  ) {
    return "TODAY";
  }

  if (
    difference <
    oneDay * 2
  ) {
    return "YESTERDAY";
  }

  return "EARLIER";
}

/*
 * DISPLAY NOTIFICATION TIME
 */
function formatNotificationTime(
  timestamp: Timestamp | null
) {
  if (!timestamp) {
    return "";
  }

  const date =
    timestamp.toDate();

  const now =
    new Date();

  const difference =
    Math.max(
      0,
      now.getTime() -
        date.getTime()
    );

  const minutes =
    Math.floor(
      difference /
        60000
    );

  if (
    minutes < 1
  ) {
    return "Just now";
  }

  if (
    minutes < 60
  ) {
    return `${minutes} min ago`;
  }

  const hours =
    Math.floor(
      minutes / 60
    );

  if (
    hours < 24
  ) {
    return `${hours} ${
      hours === 1
        ? "hour"
        : "hours"
    } ago`;
  }

  return new Intl.DateTimeFormat(
    "en-ZA",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  ).format(date);
}

function getTimestampMillis(
  timestamp: Timestamp | null
) {
  return timestamp
    ? timestamp.toMillis()
    : 0;
}