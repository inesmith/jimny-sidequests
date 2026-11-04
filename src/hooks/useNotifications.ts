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
  isRegistrationInProgress,
  subscribeToRegistrationState,
} from "../services/registrationState";

import {
  collection,
  doc,
  getDoc,
  runTransaction,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  writeBatch,
  where,
} from "firebase/firestore";

import {
  auth,
  db,
} from "../firebase/firebase";

import type {
  NotificationItem,
} from "../screens/NotificationsScreen";

function eventStart(data: Record<string, any>): Date | null {
  const timestamp = data.startsAt ?? data.startAt;
  if (timestamp instanceof Timestamp) return timestamp.toDate();
  if (timestamp && typeof timestamp.toDate === "function") return timestamp.toDate();
  const value = data.eventDate || data.date;
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function eventExpiry(data: Record<string, any>): number | null {
  const start = eventStart(data);
  if (!start) return null;
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return end.getTime();
}

function eventDisplay(data: Record<string, any>) {
  const start = eventStart(data);
  const date = typeof data.date === "string" && data.date.trim()
    ? data.date
    : start?.toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" }) ?? "";
  const time = typeof data.time === "string" && data.time.trim()
    ? data.time
    : typeof data.eventTime === "string" && data.eventTime.trim()
      ? data.eventTime
      : data.startsAt instanceof Timestamp
        ? start!.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false })
        : "Time TBC";
  return { date, time, eventDate: start ? `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,"0")}-${String(start.getDate()).padStart(2,"0")}` : "" };
}

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
  expiresAt: number | null;
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

    const [registrationInProgress, setRegistrationState] =
    useState(isRegistrationInProgress);

  useEffect(() => {
    return subscribeToRegistrationState(() => {
      setRegistrationState(isRegistrationInProgress());
    });
  }, []);

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

  const [directNotifications, setDirectNotifications] = useState<BackendNotificationItem[]>([]);

  const [activeUserId, setActiveUserId] = useState<string | null>(null);

  useEffect(() => {
    setActiveUserId(null);
    if (!currentUser || registrationInProgress) return;

    return onSnapshot(
      doc(db, "privateUserData", currentUser.uid),
      (snapshot) => {
        setActiveUserId(
          snapshot.exists() && snapshot.data().accountStatus === "active"
            ? currentUser.uid
            : null
        );
      },
      (error) => {
        setActiveUserId(null);
        console.error("Unable to verify notification account status:", error);
      }
    );
  }, [currentUser, registrationInProgress]);

  const [registeredIds, setRegisteredIds] = useState<string[]>([]);
  const [acceptedRsvpIds, setAcceptedRsvpIds] = useState<string[]>([]);

  useEffect(() => {
    if (!currentUser || activeUserId !== currentUser.uid) { setRegisteredIds([]); return; }
    return onSnapshot(collection(db, "users", currentUser.uid, "experienceRegistrations"), snapshot => {
      setRegisteredIds(snapshot.docs.filter(item => item.data().status === "registered").map(item => item.id));
    }, error => console.error("Unable to track registrations:", error));
  }, [currentUser, activeUserId]);

  useEffect(() => {
    if (!currentUser || activeUserId !== currentUser.uid) { setAcceptedRsvpIds([]); return; }
    let unsubs: Array<() => void> = [];
    const stop = onSnapshot(query(collection(db, "experiences"), where("eventType", "==", "meetAndGreet")), snapshot => {
      unsubs.forEach(unsub => unsub());
      unsubs = snapshot.docs.map(event => onSnapshot(doc(db, "experiences", event.id, "rsvps", currentUser.uid), rsvp => {
        setAcceptedRsvpIds(previous => {
          const next = new Set(previous);
          if (rsvp.data()?.status === "accepted") next.add(event.id);
          else next.delete(event.id);
          return [...next];
        });
      }, error => console.error("Unable to track RSVP:", error)));
    }, error => console.error("Unable to track experiences for RSVP:", error));
    return () => { stop(); unsubs.forEach(unsub => unsub()); };
  }, [currentUser, activeUserId]);

  const [acceptedWaveIds, setAcceptedWaveIds] = useState<string[]>([]);

useEffect(() => {
  if (!currentUser || activeUserId !== currentUser.uid) {
    setAcceptedWaveIds([]);
    return;
  }

  const wavesQuery = query(
    collection(db, "waves"),
    where("recipientId", "==", currentUser.uid)
  );

  return onSnapshot(
    wavesQuery,
    (snapshot) => {
      setAcceptedWaveIds(
        snapshot.docs
          .filter((wave) => wave.data().status === "friends")
          .map((wave) => wave.id)
      );
    },
    (error) => {
      console.error("Unable to track accepted waves:", error);
    }
  );
}, [currentUser, activeUserId]);

  const [
    isLoadingNotifications,
    setIsLoadingNotifications,
  ] = useState(true);

  /*
   * LISTEN FOR AUTH CHANGES
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setActiveUserId(null);

      if (!user) {
        setExperiences([]);
        setNotificationStates({});
        setDirectNotifications([]);
        setRegisteredIds([]);
        setAcceptedRsvpIds([]);
        setAcceptedWaveIds([]);
        setIsLoadingNotifications(false);
      } else {
        setIsLoadingNotifications(true);
      }
    });

    return unsubscribe;
  }, []);

  /*
   * LISTEN TO REAL EXPERIENCES
   */
  useEffect(() => {
    if (!currentUser || activeUserId !== currentUser.uid) {
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

                  ...eventDisplay(data),
                  expiresAt: eventExpiry(data),

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
  }, [currentUser, activeUserId]);

  /*
   * LISTEN TO THIS USER'S
   * READ / UNREAD STATE
   */
  useEffect(() => {
    if (!currentUser || activeUserId !== currentUser.uid) {
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
  }, [currentUser, activeUserId]);

  /* PERSONAL INVITATIONS AND RSVP UPDATES */
  useEffect(() => {
    if (!currentUser || activeUserId !== currentUser.uid) { setDirectNotifications([]); return; }
    return onSnapshot(collection(db, "users", currentUser.uid, "notifications"), (snapshot) => {
      const items: BackendNotificationItem[] = snapshot.docs.map((item) => {
        const data = item.data();
        const createdAt = data.createdAt instanceof Timestamp ? data.createdAt : null;
        const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt : null;
        const state = notificationStates[`direct_${item.id}`];
        return {
          id: `direct_${item.id}`,
          section: getSection(createdAt),
          type:
            data.type === "invite"
              ? "invite"
              : data.type === "wave" || data.type === "waveAccepted"
                ? "wave"
                : "eventUpdate",
          waveId: typeof data.waveId === "string" ? data.waveId : undefined,
          senderId: typeof data.senderId === "string" ? data.senderId : undefined,
          waveAccepted:
            data.type === "waveAccepted" ||
            (typeof data.waveId === "string" &&
              acceptedWaveIds.includes(data.waveId)),
          label: typeof data.label === "string" ? data.label : "MEET & GREET",
          title: typeof data.title === "string" ? data.title : "Meet & Greet",
          body: typeof data.body === "string" ? data.body : "",
          time: formatNotificationTime(createdAt),
          isRead: state?.isRead === true,
          experienceId: typeof data.experienceId === "string" ? data.experienceId : undefined,
          invitationId: data.type === "invite" ? item.id : undefined,
          rsvpStatus: data.rsvpStatus === "accepted" || data.rsvpStatus === "declined" ? data.rsvpStatus : "pending",
          createdAt, updatedAt,
        };
      });
      setDirectNotifications(items);
    }, (error) => console.error("Unable to load personal notifications:", error));
  }, [currentUser, activeUserId, notificationStates, acceptedWaveIds, acceptedRsvpIds, registeredIds, experiences]);

  /*
   * TURN BACKEND EXPERIENCES
   * INTO NOTIFICATIONS
   */
  const notifications =
    useMemo<
      BackendNotificationItem[]
    >(() => {
      const experienceItems = experiences
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
              actionStatus: experience.expiresAt !== null && experience.expiresAt < Date.now()
                ? "expired" as const : registeredIds.includes(experience.id)
                  ? "registered" as const : acceptedRsvpIds.includes(experience.id)
                    ? "attending" as const : undefined,

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
      return [...directNotifications, ...experienceItems].sort((a,b) => getTimestampMillis(b.updatedAt ?? b.createdAt) - getTimestampMillis(a.updatedAt ?? a.createdAt));
    }, [
      experiences,
      directNotifications,
      notificationStates,
      registeredIds,
      acceptedRsvpIds,
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

          ...eventDisplay(data),
          eventType: typeof data.eventType === "string" ? data.eventType : undefined,

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

  const respondToInvite = async (
    notification: BackendNotificationItem,
    response: "accepted" | "declined"
  ) => {
    if (!currentUser || !notification.invitationId || !notification.experienceId) {
      throw new Error("Invitation unavailable");
    }

    const invitationRef = doc(db, "users", currentUser.uid, "notifications", notification.invitationId);
    const experienceRef = doc(db, "experiences", notification.experienceId);
    const rsvpRef = doc(db, "experiences", notification.experienceId, "rsvps", currentUser.uid);

    await runTransaction(db, async (transaction) => {
      const invitation = await transaction.get(invitationRef);
      const experience = await transaction.get(experienceRef);

      if (!invitation.exists() || invitation.data().type !== "invite" ||
          invitation.data().experienceId !== notification.experienceId) {
        throw new Error("Invitation no longer available");
      }
      if (!experience.exists()) {
        throw new Error("Experience no longer available");
      }

      transaction.set(rsvpRef, {
        userId: currentUser.uid,
        status: response,
        updatedAt: serverTimestamp(),
        invitationId: notification.invitationId,
      }, { merge: true });

      transaction.update(invitationRef, {
        rsvpStatus: response,
        updatedAt: serverTimestamp(),
      });
      // The deployed notifyMeetAndGreetRSVP Cloud Function notifies the organiser.
    });
  };

  return {
    notifications,
    unreadCount,
    isLoadingNotifications,
    markNotificationAsRead,
    markAllAsRead,
    getExperienceFromNotification,
    respondToInvite,
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