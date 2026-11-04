/* eslint-disable require-jsdoc */
/* eslint-disable max-len */
import {initializeApp} from "firebase-admin/app";
import {getStorage} from "firebase-admin/storage";
import {defineSecret} from "firebase-functions/params";
import {setGlobalOptions} from "firebase-functions/v2";
import {
  getFirestore,
  FieldValue,
} from "firebase-admin/firestore";
import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {getAuth} from "firebase-admin/auth";
import {
  HttpsError,
  onCall,
} from "firebase-functions/v2/https";
import sharp from "sharp";
import {randomUUID} from "node:crypto";

initializeApp();

setGlobalOptions({
  maxInstances: 10,
  region: "africa-south1",
});

const removeBgApiKey =
  defineSecret("REMOVE_BG_API_KEY");

export const removeJimnyBackground = onCall(
  {
    secrets: [removeBgApiKey],
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be signed in to process a Jimny photo."
      );
    }

    const uid = request.auth.uid;
    const member = await getFirestore().collection("privateUserData").doc(uid).get();
    if (!member.exists || (member.data()?.accountStatus ?? "active") !== "active") {
      throw new HttpsError("permission-denied", "Your account is not active.");
    }
    const storagePath =
      request.data?.storagePath;

    if (
      typeof storagePath !== "string" ||
      storagePath.trim().length === 0
    ) {
      throw new HttpsError(
        "invalid-argument",
        "A valid Storage path is required."
      );
    }

    const expectedFolder =
  `users/${uid}/passport/`;

    const isValidJimnyPhoto =
      storagePath.startsWith(expectedFolder) &&
      storagePath.endsWith(".jpg") &&
      !storagePath.includes("..");

    if (!isValidJimnyPhoto) {
      throw new HttpsError(
        "permission-denied",
        "You cannot process this image."
      );
    }

    try {
      const bucket =
        getStorage().bucket();

      const originalFile =
        bucket.file(storagePath);

      const [exists] =
        await originalFile.exists();

      if (!exists) {
        throw new HttpsError(
          "not-found",
          "The uploaded Jimny photo could not be found."
        );
      }

      const [metadata] =
        await originalFile.getMetadata();

      const contentType =
        metadata.contentType ||
        "image/jpeg";

      const [originalBuffer] =
        await originalFile.download();

      const formData =
        new FormData();

      const imageBytes =
        new Uint8Array(
          originalBuffer
        );

      const imageBlob =
        new Blob(
          [imageBytes],
          {
            type: contentType,
          }
        );

      formData.append(
        "image_file",
        imageBlob,
        "jimny-original.jpg"
      );

      formData.append("type", "car");
      formData.append("size", "preview");
      formData.append(
        "semitransparency",
        "true"
      );

      const response =
        await fetch(
          "https://api.remove.bg/v1.0/removebg",
          {
            method: "POST",
            headers: {
              "X-Api-Key":
                removeBgApiKey.value(),
            },
            body: formData,
          }
        );

      if (!response.ok) {
        const errorText =
          await response.text();

        console.error(
          "remove.bg error:",
          response.status,
          errorText
        );

        throw new HttpsError(
          "internal",
          "The Jimny background could not be removed."
        );
      }

      const processedArrayBuffer =
        await response.arrayBuffer();

      const transparentBuffer =
        Buffer.from(
          processedArrayBuffer
        );

      /*
       * CONVERT TRANSPARENT JIMNY
       * TO BLACK & WHITE
       *
       * Sharp's grayscale operation
       * changes the RGB channels while
       * preserving the PNG alpha channel.
       * The removed background therefore
       * stays transparent.
       */
      const blackAndWhiteBuffer =
        await sharp(
          transparentBuffer
        )
          .grayscale()
          .png()
          .toBuffer();

      const processedPath =
        `users/${uid}/passport/jimny-transparent.png`;

      const processedFile =
        bucket.file(
          processedPath
        );

      await processedFile.save(
        blackAndWhiteBuffer,
        {
          metadata: {
            contentType:
              "image/png",
            cacheControl:
              "public,max-age=3600",
          },
        }
      );

      return {
        processedPath,
      };
    } catch (error) {
      console.error(
        "Background removal failed:",
        error
      );

      if (
        error instanceof HttpsError
      ) {
        throw error;
      }

      throw new HttpsError(
        "internal",
        "Something went wrong while processing the Jimny photo."
      );
    }
  }
);

/*
 * MEET & GREET RSVP NOTIFICATIONS
 *
 * Automatically notifies the organiser when
 * a member accepts their Meet & Greet invitation.
 */

export const notifyMeetAndGreetRSVP = onDocumentWritten(
  {
    document: "experiences/{experienceId}/rsvps/{userId}",
    region: "africa-south1",
  },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    // Only notify when someone newly accepts.
    if (!after || after.status !== "accepted") {
      return;
    }

    if (before?.status === "accepted") {
      return;
    }

    const db = getFirestore();

    const experienceId = event.params.experienceId;
    const userId = event.params.userId;


    const memberAccountSnapshot = await db
      .collection("privateUserData")
      .doc(userId)
      .get();

    if (
      !memberAccountSnapshot.exists ||
  (memberAccountSnapshot.data()?.accountStatus ?? "active") !== "active"
    ) {
      console.log(
        "RSVP notification skipped: member account is not active.",
        userId
      );
      return;
    }


    const experienceSnapshot = await db
      .collection("experiences")
      .doc(experienceId)
      .get();

    if (!experienceSnapshot.exists) {
      return;
    }

    const experience = experienceSnapshot.data();

    if (
      !experience ||
      experience.eventType !== "meetAndGreet"
    ) {
      return;
    }

    const organiserId = experience.createdBy;

    if (
      typeof organiserId !== "string" ||
      organiserId === userId
    ) {
      return;
    }


    const organiserAccountSnapshot = await db
      .collection("privateUserData")
      .doc(organiserId)
      .get();

    if (
      !organiserAccountSnapshot.exists ||
  (organiserAccountSnapshot.data()?.accountStatus ?? "active") !== "active"
    ) {
      console.log(
        "RSVP notification skipped: organiser account is not active.",
        organiserId
      );
      return;
    }


    const notificationId =
      `rsvp_accepted_${experienceId}_${userId}`;


    const notificationRef = db
      .collection("users")
      .doc(organiserId)
      .collection("notifications")
      .doc(notificationId);


    const rsvpRef = db
      .collection("experiences")
      .doc(experienceId)
      .collection("rsvps")
      .doc(userId);


    const currentExperienceRef = db
      .collection("experiences")
      .doc(experienceId);


    await db.runTransaction(async (transaction) => {
      const memberPrivateRef = db
        .collection("privateUserData")
        .doc(userId);

      const organiserPrivateRef = db
        .collection("privateUserData")
        .doc(organiserId);

      const memberSnapshot =
    await transaction.get(memberPrivateRef);

      const organiserSnapshot =
    await transaction.get(organiserPrivateRef);


      const currentMemberProfile = await transaction.get(
        db.collection("users").doc(userId)
      );

      const currentMemberName =
  currentMemberProfile.data()?.fullName;

      const memberName =
  typeof currentMemberName === "string" &&
  currentMemberName.trim().length > 0 ?
    currentMemberName.trim() :
    "A Jimny owner";


      const currentRsvpSnapshot =
  await transaction.get(rsvpRef);

      const currentExperienceSnapshot =
  await transaction.get(currentExperienceRef);


      const currentExperienceTitle =
  currentExperienceSnapshot.data()?.title;

      const eventTitle =
  typeof currentExperienceTitle === "string" &&
  currentExperienceTitle.trim().length > 0 ?
    currentExperienceTitle.trim() :
    "your Meet & Greet";


      if (
        !currentExperienceSnapshot.exists ||
  currentExperienceSnapshot.data()?.eventType !==
    "meetAndGreet" ||
  currentExperienceSnapshot.data()?.createdBy !==
    organiserId
      ) {
        return;
      }


      if (
        !currentRsvpSnapshot.exists ||
  currentRsvpSnapshot.data()?.status !== "accepted"
      ) {
        return;
      }


      if (
        (memberSnapshot.data()?.accountStatus ?? "active") !== "active" ||
    (organiserSnapshot.data()?.accountStatus ?? "active") !== "active"
      ) {
        return;
      }


      const existingNotification =
  await transaction.get(notificationRef);

      if (existingNotification.exists) {
        return;
      }


      transaction.create(notificationRef, {
        type: "rsvp",
        label: "MEET & GREET",
        title: "Someone's joining the crew! 🚙",
        body:
      `${memberName} has accepted your invitation to ` +
      `${eventTitle}. One more Jimny joining the adventure!`,
        experienceId,
        senderId: userId,
        recipientId: organiserId,
        rsvpStatus: "accepted",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  }
);


/*
 * ACCOUNT MANAGEMENT
 *
 * Secure backend functions for:
 * - Deactivating an account
 * - Reactivating an account
 *
 * The Firebase Authentication account is
 * preserved during deactivation.
 */

/*
 * VERIFY RECENT AUTHENTICATION
 *
 * The user must have authenticated within
 * the last five minutes.
 *
 * The app reauthenticates the user with
 * their current password before calling
 * these functions.
 */
function requireRecentAuthentication(
  authTime: number | undefined
) {
  if (typeof authTime !== "number") {
    throw new HttpsError(
      "unauthenticated",
      "Please verify your password again."
    );
  }

  const fiveMinutes = 5 * 60;
  const currentTime = Math.floor(Date.now() / 1000);

  if (
    authTime > currentTime + 60 ||
    currentTime - authTime > fiveMinutes
  ) {
    throw new HttpsError(
      "unauthenticated",
      "Please verify your password again."
    );
  }
}

/*
 * DEACTIVATE MY ACCOUNT
 */


/*
 * VERIFY ACCOUNT CAN REQUEST DELETION
 *
 * Only an authenticated member with an
 * existing, non-deleted account may
 * request permanent account deletion.
 */
async function verifyAccountForDeletion(
  uid: string
) {
  const db = getFirestore();

  const privateRef = db
    .collection("privateUserData")
    .doc(uid);

  const snapshot = await privateRef.get();

  if (!snapshot.exists) {
    throw new HttpsError(
      "failed-precondition",
      "Your account information could not be found."
    );
  }

  const status = snapshot.data()?.accountStatus;

  if (status === "deletionPending") {
    throw new HttpsError(
      "failed-precondition",
      "Your account is already pending deletion."
    );
  }

  if (status === "deactivated") {
    throw new HttpsError(
      "failed-precondition",
      "Please reactivate your account before deleting it."
    );
  }

  return privateRef;
}


export const completeMemberRegistration = onCall(
  {region: "africa-south1"},
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Please sign in first.");
    }
    requireRecentAuthentication(request.auth.token.auth_time);
    const uid = request.auth.uid;
    const fullName = request.data?.fullName;
    const phone = request.data?.phone;
    const homeLocation = request.data?.homeLocation;
    if (typeof fullName !== "string" ||
        !fullName.trim() || fullName.trim().length > 150) {
      throw new HttpsError("invalid-argument", "Please provide a valid full name.");
    }
    if (phone != null && (typeof phone !== "string" || phone.length > 30)) {
      throw new HttpsError("invalid-argument", "Invalid phone number.");
    }
    if (homeLocation != null && (
      typeof homeLocation !== "object" || Array.isArray(homeLocation) ||
      typeof homeLocation.placeId !== "string" ||
      typeof homeLocation.formattedAddress !== "string" ||
      homeLocation.placeId.length > 255 ||
      homeLocation.formattedAddress.length > 500
    )) {
      throw new HttpsError("invalid-argument", "Invalid home location.");
    }
    const authUser = await getAuth().getUser(uid);
    if (!authUser.email || authUser.disabled) {
      throw new HttpsError("failed-precondition", "A valid account is required.");
    }
    const db = getFirestore();
    const privateRef = db.collection("privateUserData").doc(uid);
    const userRef = db.collection("users").doc(uid);
    const deletionRef = db.collection("accountDeletionJobs").doc(uid);
    await db.runTransaction(async (tx) => {
      const [privateSnap, userSnap, deletionSnap] = await Promise.all([
        tx.get(privateRef), tx.get(userRef), tx.get(deletionRef),
      ]);
      // Never reinstate an account for which deletion has been requested.
      if (deletionSnap.exists) {
        throw new HttpsError("failed-precondition", "This account cannot be registered again.");
      }
      if (privateSnap.exists) {
        const status = privateSnap.data()?.accountStatus ?? "active";
        if (status !== "active") {
          throw new HttpsError("failed-precondition", "This account is not active.");
        }
        // Idempotent retry, including recovery of a missing public profile.
        if (!userSnap.exists) {
          tx.create(userRef, {
            uid, fullName: fullName.trim(), profilePhotoURL: null,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
        return;
      }
      // A public profile without private data is ambiguous: never recreate status.
      if (userSnap.exists) {
        throw new HttpsError("failed-precondition", "Account setup requires support.");
      }
      tx.create(privateRef, {
        uid, email: authUser.email, phone: phone?.trim() || null,
        homeLocation: homeLocation ?? null, accountStatus: "active",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      tx.create(userRef, {
        uid, fullName: fullName.trim(), profilePhotoURL: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    return {success: true, status: "active"};
  }
);

export const deactivateMyAccount = onCall(
  {
    region: "africa-south1",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be signed in to deactivate your account."
      );
    }

    requireRecentAuthentication(
      request.auth.token.auth_time
    );

    const uid = request.auth.uid;

    const db = getFirestore();

    const privateRef = db
      .collection("privateUserData")
      .doc(uid);

    const presenceRef = db
      .collection("nearbyPresence")
      .doc(uid);

    const privateSnapshot = await privateRef.get();

    if (!privateSnapshot.exists) {
      throw new HttpsError(
        "failed-precondition",
        "Your account data could not be found."
      );
    }

    const status = privateSnapshot.data()?.accountStatus;

    if (status === "deletionPending") {
      throw new HttpsError(
        "failed-precondition",
        "This account is pending deletion."
      );
    }

    if (status === "deactivated") {
      return {
        success: true,
        status: "deactivated",
      };
    }

    /*
     * Update account status and disable
     * nearby discovery together.
     */

    const wasDeactivated = await db.runTransaction(
      async (transaction): Promise<boolean> => {
        const latestSnapshot =
    await transaction.get(privateRef);

        if (!latestSnapshot.exists) {
          throw new HttpsError(
            "not-found",
            "Your account could not be found."
          );
        }

        const latestStatus =
    latestSnapshot.data()?.accountStatus;

        if (latestStatus === "deletionPending") {
          throw new HttpsError(
            "failed-precondition",
            "This account is pending deletion."
          );
        }

        if (latestStatus !== "active" && latestStatus !== undefined) {
          throw new HttpsError(
            "failed-precondition",
            "Only active accounts can be deactivated."
          );
        }

        transaction.update(privateRef, {
          accountStatus: "deactivated",
          deactivatedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        transaction.delete(presenceRef);
        return true;
      });


    /*
     * Revoke existing refresh tokens.
     * Security rules must also check
     * account status to restrict access.
     */


    if (wasDeactivated) {
      const latestAccountSnapshot = await privateRef.get();

      if (
        latestAccountSnapshot.exists &&
    latestAccountSnapshot.data()?.accountStatus ===
      "deactivated"
      ) {
        await getAuth().revokeRefreshTokens(uid);
      }
    }


    return {
      success: true,
      status: "deactivated",
    };
  }
);

/*
 * REACTIVATE MY ACCOUNT
 *
 * Called after the user signs in and
 * explicitly confirms reactivation.
 */
export const reactivateMyAccount = onCall(
  {
    region: "africa-south1",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must sign in to reactivate your account."
      );
    }

    requireRecentAuthentication(
      request.auth.token.auth_time
    );

    const uid = request.auth.uid;
    const db = getFirestore();

    const privateRef = db
      .collection("privateUserData")
      .doc(uid);

    const privateSnapshot = await privateRef.get();

    if (!privateSnapshot.exists) {
      throw new HttpsError(
        "not-found",
        "Your account could not be found."
      );
    }

    const status = privateSnapshot.data()?.accountStatus;

    if (status === "deletionPending") {
      throw new HttpsError(
        "failed-precondition",
        "This account is pending deletion."
      );
    }

    if (status === "active") {
      return {
        success: true,
        status: "active",
      };
    }

    if (status !== "deactivated") {
      throw new HttpsError(
        "failed-precondition",
        "This account cannot be reactivated."
      );
    }


    await db.runTransaction(async (transaction) => {
      const latestSnapshot =
    await transaction.get(privateRef);

      if (!latestSnapshot.exists) {
        throw new HttpsError(
          "not-found",
          "Your account could not be found."
        );
      }

      const latestStatus =
    latestSnapshot.data()?.accountStatus;

      if (latestStatus === "deletionPending") {
        throw new HttpsError(
          "failed-precondition",
          "This account is pending deletion."
        );
      }

      if (latestStatus !== "deactivated") {
        return;
      }

      transaction.update(privateRef, {
        accountStatus: "active",
        deactivatedAt: FieldValue.delete(),
        reactivatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });


    /*
     * Nearby presence is not automatically
     * restored. The user can opt in again.
     */
    return {
      success: true,
      status: "active",
    };
  }
);


/*
 * DELETE PERSONAL MEMBER STORAGE FILES
 *
 * Remove all uploaded files belonging
 * to the departing member.
 *
 * Safe to retry if cleanup is interrupted.
 */
export async function deletePersonalMemberStorageFiles(
  uid: string
) {
  const bucket = getStorage().bucket();

  const userFolder = `users/${uid}/`;

  await bucket.deleteFiles({
    prefix: userFolder,
    force: true,
  });
}


/*
 * DELETE PERSONAL MEMBER FIRESTORE DATA
 *
 * Recursively remove the member's profile
 * and all nested personal collections.
 *
 * Community experiences are preserved
 * separately.
 *
 * Safe to retry after partial cleanup.
 */
export async function deletePersonalMemberFirestoreData(
  uid: string
) {
  const db = getFirestore();

  const userRef = db
    .collection("users")
    .doc(uid);

  const passportRef = db
    .collection("passports")
    .doc(uid);

  const presenceRef = db
    .collection("nearbyPresence")
    .doc(uid);

  // Remove the entire personal user tree,
  // including all nested subcollections.
  await db.recursiveDelete(userRef);

  // Remove the Adventure Passport.
  await db.recursiveDelete(passportRef);

  // Remove nearby location information.
  await presenceRef.delete();
}


/*
 * DELETE MEMBER EXPERIENCE RSVPS
 *
 * Remove the departing member's RSVP
 * records from community experiences.
 *
 * Other members' RSVPs remain untouched.
 */
export async function deleteMemberExperienceRSVPs(
  uid: string
) {
  const db = getFirestore();

  const snapshot = await db
    .collectionGroup("rsvps")
    .where("userId", "==", uid)
    .get();

  const writer = db.bulkWriter();

  for (const rsvp of snapshot.docs) {
    writer.delete(rsvp.ref);
  }

  await writer.close();
}


/*
 * DELETE SHARED MEMBER NOTIFICATIONS
 *
 * Remove notifications in other members'
 * accounts that reference the departing
 * member as sender or recipient.
 *
 * Also remove older RSVP notifications
 * that may contain the member's name.
 */
export async function deleteSharedMemberNotifications(
  uid: string
) {
  const db = getFirestore();

  const sentNotifications = await db
    .collectionGroup("notifications")
    .where("senderId", "==", uid)
    .get();

  const receivedNotifications = await db
    .collectionGroup("notifications")
    .where("recipientId", "==", uid)
    .get();

  const notificationRefs = new Map<
    string,
    FirebaseFirestore.DocumentReference
  >();

  for (const notification of [
    ...sentNotifications.docs,
    ...receivedNotifications.docs,
  ]) {
    notificationRefs.set(
      notification.ref.path,
      notification.ref
    );
  }

  const writer = db.bulkWriter();

  for (const ref of notificationRefs.values()) {
    writer.delete(ref);
  }

  await writer.close();
}


/*
 * DELETE MEMBER WAVES
 *
 * Remove all Waves and friendships where
 * the departing member is either the
 * sender or the recipient.
 *
 * Safe to run again if deletion is retried.
 */
export async function deleteMemberWaves(
  uid: string
) {
  const db = getFirestore();

  const sentWaves = await db
    .collection("waves")
    .where("senderId", "==", uid)
    .get();

  const receivedWaves = await db
    .collection("waves")
    .where("recipientId", "==", uid)
    .get();

  const waveRefs = new Map<
    string,
    FirebaseFirestore.DocumentReference
  >();

  for (const wave of [
    ...sentWaves.docs,
    ...receivedWaves.docs,
  ]) {
    waveRefs.set(wave.ref.path, wave.ref);
  }

  const bulkWriter = db.bulkWriter();

  for (const waveRef of waveRefs.values()) {
    bulkWriter.delete(waveRef);
  }

  await bulkWriter.close();
}


/*
 * ANONYMISE COMMUNITY EXPERIENCES
 *
 * Preserve community-created experiences
 * while removing the original creator's
 * account reference.
 *
 * Other members' RSVPs and registrations
 * remain untouched.
 */

export async function anonymiseCommunityExperiences(
  uid: string
): Promise<void> {
  const db = getFirestore();

  const snapshot = await db
    .collection("experiences")
    .where("createdBy", "==", uid)
    .get();

  for (const experienceDoc of snapshot.docs) {
    await experienceDoc.ref.update({
      createdBy: null,
      creatorName: "Former Jimny Member",
      creatorDeleted: true,
      message: "",
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}


/*
 * DELETE MY ACCOUNT
 *
 * Stage 1:
 * Securely mark the account as pending deletion.
 *
 * Personal data cleanup and Firebase Auth
 * deletion will be added in the next stages.
 */
export const deleteMyAccount = onCall(
  {
    region: "africa-south1",
    timeoutSeconds: 120,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be signed in to delete your account."
      );
    }

    requireRecentAuthentication(
      request.auth.token.auth_time
    );

    const uid = request.auth.uid;
    const db = getFirestore();

    const privateRef =
      await verifyAccountForDeletion(uid);


    const presenceRef = db
      .collection("nearbyPresence")
      .doc(uid);

    const deletionJobRef = db
      .collection("accountDeletionJobs")
      .doc(uid);


    await db.runTransaction(async (transaction) => {
      const privateSnapshot =
    await transaction.get(privateRef);

      const jobSnapshot =
    await transaction.get(deletionJobRef);

      if (!privateSnapshot.exists) {
        throw new HttpsError(
          "failed-precondition",
          "Your account information could not be found."
        );
      }

      const currentStatus =
    privateSnapshot.data()?.accountStatus;

      if (currentStatus === "deletionPending") {
        throw new HttpsError(
          "failed-precondition",
          "Your account is already pending deletion."
        );
      }

      if (currentStatus !== "active") {
        throw new HttpsError(
          "failed-precondition",
          "Your account must be active before deletion."
        );
      }

      if (jobSnapshot.exists) {
        throw new HttpsError(
          "failed-precondition",
          "An account deletion job already exists."
        );
      }

      transaction.create(deletionJobRef, {
        uid,
        stage: "requested",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      transaction.update(privateRef, {
        accountStatus: "deletionPending",
        deletionRequestedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      transaction.delete(presenceRef);
    });


    return {
      success: true,
      status: "deletionPending",
    };
  }
);


/*
 * RECORD ACCOUNT DELETION PROGRESS
 *
 * Create a deletion job if one does not
 * exist, or update its current stage.
 *
 * A repeated "requested" event must not
 * reset an existing deletion job.
 */
export async function recordAccountDeletionProgress(
  uid: string,
  stage: string
) {
  const db = getFirestore();

  const jobRef = db
    .collection("accountDeletionJobs")
    .doc(uid);

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(jobRef);


    if (snapshot.exists) {
      const existingStage = snapshot.data()?.stage;

      if (
        existingStage === "completed" ||
    stage === "requested"
      ) {
        return;
      }
    }


    transaction.set(
      jobRef,
      {
        uid,
        stage,
        updatedAt: FieldValue.serverTimestamp(),
      },
      {merge: true}
    );
  });
}


/*
 * CLAIM ACCOUNT DELETION JOB
 *
 * Give each worker a unique ownership ID.
 * Allow expired jobs to be reclaimed.
 */
export async function claimAccountDeletionJob(
  uid: string
): Promise<string | null> {
  const db = getFirestore();

  const jobRef = db
    .collection("accountDeletionJobs")
    .doc(uid);

  const workerId = randomUUID();


  return db.runTransaction(async (transaction) => {
    const privateRef = db
      .collection("privateUserData")
      .doc(uid);

    const privateSnapshot =
  await transaction.get(privateRef);

    const snapshot = await transaction.get(jobRef);

    if (!snapshot.exists) {
      return null;
    }

    const jobStage = snapshot.data()?.stage;

    const accountPending =
  privateSnapshot.exists &&
  privateSnapshot.data()?.accountStatus ===
    "deletionPending";

    const recoveringFinalisation =
  jobStage === "finalising" &&
  !privateSnapshot.exists;

    if (
      !accountPending &&
  !recoveringFinalisation
    ) {
      return null;
    }


    if (!snapshot.exists) {
      return null;
    }

    const data = snapshot.data();
    const stage = data?.stage;


    if (stage === "completed") {
      return null;
    }


    const now = Date.now();

    const leaseExpiresAt =
      data?.leaseExpiresAt?.toMillis?.();

    const isRequested =
      stage === "requested";


    const isExpired =
  (stage === "cleaning" ||
    stage === "finalising") &&
  (
    typeof leaseExpiresAt !== "number" ||
    leaseExpiresAt <= now
  );


    if (!isRequested && !isExpired) {
      return null;
    }


    transaction.update(jobRef, {
      stage: stage === "finalising" ?
        "finalising" :
        "cleaning",
      workerId,
      leaseExpiresAt:
    new Date(now + 10 * 60 * 1000),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return workerId;
  });
}


/*
 * VERIFY ACCOUNT DELETION WORKER
 *
 * Confirm that the worker still owns
 * the deletion job and its lease has
 * not expired.
 *
 * This helper only checks ownership.
 * It does not delete any data.
 */
export async function verifyDeletionWorker(
  uid: string,
  workerId: string
): Promise<boolean> {
  const db = getFirestore();

  const jobRef = db
    .collection("accountDeletionJobs")
    .doc(uid);

  const snapshot = await jobRef.get();

  if (!snapshot.exists) {
    return false;
  }

  const data = snapshot.data();

  if (
    data?.stage !== "cleaning" ||
    data?.workerId !== workerId
  ) {
    return false;
  }

  const leaseExpiresAt =
    data?.leaseExpiresAt?.toMillis?.();

  if (
    typeof leaseExpiresAt !== "number" ||
    leaseExpiresAt <= Date.now()
  ) {
    return false;
  }

  return true;
}


/*
 * RENEW ACCOUNT DELETION LEASE
 *
 * Extend a worker's lease only if
 * it still owns the deletion job.
 *
 * Prevents an older worker from
 * renewing another worker's lease.
 */
export async function renewDeletionWorkerLease(
  uid: string,
  workerId: string
): Promise<boolean> {
  const db = getFirestore();

  const jobRef = db
    .collection("accountDeletionJobs")
    .doc(uid);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(jobRef);

    if (!snapshot.exists) {
      return false;
    }

    const data = snapshot.data();


    if (
      (
        data?.stage !== "cleaning" &&
    data?.stage !== "finalising"
      ) ||
  data?.workerId !== workerId
    ) {
      return false;
    }


    const now = Date.now();

    const leaseExpiresAt =
      data?.leaseExpiresAt?.toMillis?.();

    if (
      typeof leaseExpiresAt !== "number" ||
      leaseExpiresAt <= now
    ) {
      return false;
    }

    transaction.update(jobRef, {
      leaseExpiresAt:
        new Date(now + 10 * 60 * 1000),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return true;
  });
}


/*
 * UPDATE ACCOUNT DELETION STAGE
 *
 * Only the worker holding a valid lease
 * may advance the deletion job.
 *
 * This prevents an outdated worker from
 * overwriting another worker's progress.
 */
export async function updateDeletionWorkerStage(
  uid: string,
  workerId: string,
  nextStage: string
): Promise<boolean> {
  const db = getFirestore();

  const jobRef = db
    .collection("accountDeletionJobs")
    .doc(uid);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(jobRef);

    if (!snapshot.exists) {
      return false;
    }

    const data = snapshot.data();

    if (
      data?.stage !== "cleaning" ||
      data?.workerId !== workerId
    ) {
      return false;
    }

    const leaseExpiresAt =
      data?.leaseExpiresAt?.toMillis?.();

    if (
      typeof leaseExpiresAt !== "number" ||
      leaseExpiresAt <= Date.now()
    ) {
      return false;
    }


    if (nextStage !== "finalising") {
      return false;
    }


    transaction.update(jobRef, {
      stage: nextStage,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return true;
  });
}


/*
 * RUN ACCOUNT DELETION CLEANUP
 *
 * Coordinates personal data cleanup
 * while preserving community experiences.
 *
 * Not connected to any trigger yet.
 */
export async function runAccountDeletionCleanup(
  uid: string,
  workerId: string
): Promise<void> {
  const isOwner = await verifyDeletionWorker(
    uid,
    workerId
  );

  if (!isOwner) {
    throw new Error(
      "Deletion worker no longer owns this job."
    );
  }


  const assertWorkerOwnership = async () => {
    const renewed = await renewDeletionWorkerLease(
      uid,
      workerId
    );

    if (!renewed) {
      throw new Error(
        "Deletion worker lost ownership during cleanup."
      );
    }
  };


  // Remove references in shared community data.
  await assertWorkerOwnership();
  await deleteMemberWaves(uid);

  await assertWorkerOwnership();
  await deleteSharedMemberNotifications(uid);

  await assertWorkerOwnership();
  await deleteMemberExperienceRSVPs(uid);

  // Preserve community experiences.
  await assertWorkerOwnership();
  await anonymiseCommunityExperiences(uid);

  // Remove the member's personal information.
  await assertWorkerOwnership();
  await deletePersonalMemberStorageFiles(uid);

  await assertWorkerOwnership();
  await deletePersonalMemberFirestoreData(uid);


  // Confirm ownership before moving forward.
  const stillOwner = await verifyDeletionWorker(
    uid,
    workerId
  );

  if (!stillOwner) {
    throw new Error(
      "Deletion worker lost ownership during cleanup."
    );
  }

  const updated = await updateDeletionWorkerStage(
    uid,
    workerId,
    "finalising"
  );

  if (!updated) {
    throw new Error(
      "Could not advance deletion job to finalising."
    );
  }
}


/*
 * VERIFY ACCOUNT DELETION FINALISATION
 *
 * Confirm that the deletion job is in
 * the finalising stage and belongs to
 * the expected worker.
 *
 * This helper does not delete anything.
 */
export async function verifyDeletionFinalisation(
  uid: string,
  workerId: string
): Promise<boolean> {
  const db = getFirestore();

  const jobRef = db
    .collection("accountDeletionJobs")
    .doc(uid);

  const snapshot = await jobRef.get();

  if (!snapshot.exists) {
    return false;
  }

  const data = snapshot.data();

  if (
    data?.stage !== "finalising" ||
    data?.workerId !== workerId
  ) {
    return false;
  }

  const leaseExpiresAt =
    data?.leaseExpiresAt?.toMillis?.();

  if (
    typeof leaseExpiresAt !== "number" ||
    leaseExpiresAt <= Date.now()
  ) {
    return false;
  }

  return true;
}


/*
 * FINALISE ACCOUNT DELETION
 *
 * Not connected to a trigger or scheduler.
 *
 * Firebase Authentication is deleted only
 * after the cleanup job reaches finalising.
 */
export async function finaliseAccountDeletion(
  uid: string,
  workerId: string
): Promise<void> {
  const canFinalise =
    await verifyDeletionFinalisation(uid, workerId);

  if (!canFinalise) {
    throw new Error(
      "Account deletion is not ready for finalisation."
    );
  }


  const leaseRenewed = await renewDeletionWorkerLease(
    uid,
    workerId
  );

  if (!leaseRenewed) {
    throw new Error(
      "Deletion worker lost ownership before finalisation."
    );
  }

  const db = getFirestore();

  const privateRef = db
    .collection("privateUserData")
    .doc(uid);


  // Remove the Firebase Authentication account.
  // A retry must tolerate an already-deleted user.
  try {
    await getAuth().deleteUser(uid);
  } catch (error) {
    const errorCode =
      (error as {code?: string})?.code;

    if (errorCode !== "auth/user-not-found") {
      throw error;
    }
  }

  // Remove the remaining private account record.
  await db.recursiveDelete(privateRef);

  // Record completion for recovery and auditing.
  const completed = await db.runTransaction(
    async (transaction) => {
      const jobRef = db
        .collection("accountDeletionJobs")
        .doc(uid);

      const snapshot =
        await transaction.get(jobRef);

      const data = snapshot.data();


      const leaseExpiresAt =
  data?.leaseExpiresAt?.toMillis?.();

      if (
        !snapshot.exists ||
  data?.stage !== "finalising" ||
  data?.workerId !== workerId ||
  typeof leaseExpiresAt !== "number" ||
  leaseExpiresAt <= Date.now()
      ) {
        return false;
      }


      transaction.update(jobRef, {
        stage: "completed",
        completedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        workerId: FieldValue.delete(),
        leaseExpiresAt: FieldValue.delete(),
      });

      return true;
    }
  );

  if (!completed) {
    throw new Error(
      "Account deletion completed but job status could not be confirmed."
    );
  }
}


/*
 * ACCOUNT DELETION TRIGGER
 *
 * Detect when an account enters
 * deletionPending status.
 *
 * Record the deletion request so
 * cleanup progress can be tracked.
 */
export const processAccountDeletion = onDocumentWritten(
  {
    document: "privateUserData/{userId}",
    region: "africa-south1",
    retry: true,
  },
  async (event) => {
    const beforeStatus =
      event.data?.before.data()?.accountStatus;

    const afterStatus =
      event.data?.after.data()?.accountStatus;

    if (
      beforeStatus === "deletionPending" ||
      afterStatus !== "deletionPending"
    ) {
      return;
    }

    const uid = event.params.userId;

    await recordAccountDeletionProgress(
      uid,
      "requested"
    );

    console.log(
      "Account deletion request recorded:",
      uid
    );
  }
);


/*
 * RECOVER UNFINISHED ACCOUNT DELETIONS
 *
 * Runs every 10 minutes to identify
 * deletion jobs that need processing.
 *
 * Currently logs jobs only.
 * No cleanup operations are performed.
 */
// Deletion workers are intentionally NOT enabled in this staged build.
// Do not enable irreversible deletion until Storage rules and end-to-end
// tests have been reviewed. The deleteMyAccount callable only marks pending.

/*
 * SEND NEARBY MEET & GREET INVITATIONS
 *
 * Sends one invitation per event to eligible
 * Jimny owners within approximately 10 km.
 *
 * Nearby locations are approximate and
 * must have been updated within 24 hours.
 */

export const sendNearbyMeetAndGreetInvites = onCall(
  {
    region: "africa-south1",
    timeoutSeconds: 120,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "You must be signed in."
      );
    }

    const senderId = request.auth.uid;
    const {experienceId, latitude, longitude} = request.data ?? {};

    if (
      typeof experienceId !== "string" ||
      !/^[A-Za-z0-9]{1,128}$/.test(experienceId) ||
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 ||
      Math.abs(longitude) > 180
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Valid event and location details are required."
      );
    }

    const db = getFirestore();

    const member = await db
      .collection("privateUserData")
      .doc(senderId)
      .get();

    if (
      !member.exists ||
      (member.data()?.accountStatus ?? "active") !== "active"
    ) {
      throw new HttpsError(
        "permission-denied",
        "Your account is not active."
      );
    }

    const eventRef = db.collection("experiences").doc(experienceId);
    const eventSnap = await eventRef.get();

    if (!eventSnap.exists) {
      throw new HttpsError("not-found", "Meet & Greet not found.");
    }

    const event = eventSnap.data()!;

    if (
      event.createdBy !== senderId ||
      event.eventType !== "meetAndGreet"
    ) {
      throw new HttpsError(
        "permission-denied",
        "You cannot send invitations for this event."
      );
    }

    if (
      !event.startsAt ||
      typeof event.startsAt.toMillis !== "function" ||
      event.startsAt.toMillis() <= Date.now()
    ) {
      throw new HttpsError(
        "failed-precondition",
        "The Meet & Greet must be in the future."
      );
    }

    const rad = (value: number) => value * Math.PI / 180;

    const distanceKm = (
      lat1: number,
      lon1: number,
      lat2: number,
      lon2: number
    ) => {
      const dLat = rad(lat2 - lat1);
      const dLon = rad(lon2 - lon1);

      const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(rad(lat1)) *
        Math.cos(rad(lat2)) *
        Math.sin(dLon / 2) ** 2;

      return 6371 * 2 * Math.atan2(
        Math.sqrt(h),
        Math.sqrt(Math.max(0, 1 - h))
      );
    };

    // Match the existing approximate-location grid.
    const grid = 0.02;
    const originLat = Math.round(latitude / grid) * grid;
    const originLon = Math.round(longitude / grid) * grid;

    const presenceSnapshot = await db
      .collection("nearbyPresence")
      .where("enabled", "==", true)
      .get();

    const cutoff = Date.now() - 24 * 60 * 60 * 1000;

    const recipients = presenceSnapshot.docs.filter((snapshot) => {
      if (snapshot.id === senderId) return false;

      const presence = snapshot.data();

      if (
        typeof presence.latitude !== "number" ||
        typeof presence.longitude !== "number" ||
        !presence.updatedAt ||
        typeof presence.updatedAt.toMillis !== "function" ||
        presence.updatedAt.toMillis() < cutoff
      ) {
        return false;
      }

      return distanceKm(
        originLat,
        originLon,
        presence.latitude,
        presence.longitude
      ) <= 10;
    });

    const senderSnap = await db
      .collection("users")
      .doc(senderId)
      .get();

    const organiserName =
      senderSnap.data()?.fullName || "A Jimny owner";

    let sent = 0;

    // Deterministic IDs prevent duplicate invitations on retry.
    // create() never overwrites an existing RSVP response.
    for (const recipient of recipients) {
      const recipientId = recipient.id;

      const recipientAccount = await db
        .collection("privateUserData")
        .doc(recipientId)
        .get();

      if (
        !recipientAccount.exists ||
        (recipientAccount.data()?.accountStatus ?? "active") !== "active"
      ) {
        continue;
      }

      const notificationRef = db
        .collection("users")
        .doc(recipientId)
        .collection("notifications")
        .doc(`invite_${experienceId}`);

      try {
        await notificationRef.create({
          type: "invite",
          senderId,
          recipientId,
          experienceId,
          title: "You're invited to a Meet & Greet! 🚙",
          body: `${organiserName} invited you to ${event.title} at ${event.location}.`,
          rsvpStatus: "pending",
          isRead: false,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        sent++;
      } catch (error: unknown) {
        // Existing invitations must never be overwritten.
        const code = (error as {code?: number | string})?.code;

        if (code === 6 || code === "already-exists") {
          continue;
        }

        throw error;
      }
    }

    return {
      success: true,
      sent,
      eligible: recipients.length,
    };
  }
);
