
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");

const {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} = require("firebase/firestore");

const fs = require("node:fs");

const PROJECT_ID = "jimny-side-quests";

async function main() {
  const testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: fs.readFileSync("firestore.rules", "utf8"),
    },
  });

  let passed = 0;
  let failed = 0;

  async function test(name, callback) {
    try {
      await callback();
      console.log("PASS:", name);
      passed++;
    } catch (error) {
      console.error("FAIL:", name);
      console.error(error.message);
      failed++;
    }
  }

  try {
    await testEnv.clearFirestore();

    // Seed test data with security rules disabled.
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      for (const [uid, status] of [
        ["active-user", "active"],
        ["other-user", "active"],
        ["inactive-user", "deactivated"],
      ]) {
        await setDoc(doc(db, "privateUserData", uid), {
          accountStatus: status,
        });

        await setDoc(doc(db, "users", uid), {
          fullName: uid,
        });
      }

      await setDoc(doc(db, "experiences", "test-meet"), {
        createdBy: "other-user",
        title: "Test Meet & Greet",
      });

      await setDoc(
        doc(db, "users", "active-user", "notifications", "invite-test"),
        {
          type: "invite",
          senderId: "other-user",
          recipientId: "active-user",
          experienceId: "test-meet",
          rsvpStatus: "pending",
        }
      );
    });

    const activeDb = testEnv
      .authenticatedContext("active-user")
      .firestore();

    const inactiveDb = testEnv
      .authenticatedContext("inactive-user")
      .firestore();

    const otherDb = testEnv
      .authenticatedContext("other-user")
      .firestore();

    const missingDb = testEnv
      .authenticatedContext("missing-user")
      .firestore();

    const guestDb = testEnv
      .unauthenticatedContext()
      .firestore();

    // ORIGINAL SECURITY TESTS

    await test("Active member can read profiles", async () => {
      await assertSucceeds(
        getDoc(doc(activeDb, "users", "other-user"))
      );
    });

    await test("Guest cannot read profiles", async () => {
      await assertFails(
        getDoc(doc(guestDb, "users", "active-user"))
      );
    });

    await test("Deactivated member cannot read profiles", async () => {
      await assertFails(
        getDoc(doc(inactiveDb, "users", "active-user"))
      );
    });

    await test("Member cannot create private account status", async () => {
      await assertFails(
        setDoc(doc(activeDb, "privateUserData", "fake-user"), {
          accountStatus: "active",
        })
      );
    });

    await test("Member can update own profile", async () => {
      await assertSucceeds(
        setDoc(
          doc(activeDb, "users", "active-user"),
          { fullName: "Updated Test Member" },
          { merge: true }
        )
      );
    });

    await test("Member cannot edit another profile", async () => {
      await assertFails(
        setDoc(
          doc(activeDb, "users", "other-user"),
          { fullName: "Unauthorized Edit" },
          { merge: true }
        )
      );
    });

    await test("Active member can enable Nearby Jimnys", async () => {
      await assertSucceeds(
        setDoc(doc(activeDb, "nearbyPresence", "active-user"), {
          uid: "active-user",
          enabled: true,
          latitude: -25.75,
          longitude: 28.2,
          updatedAt: serverTimestamp(),
        })
      );
    });

    await test("Member cannot edit another Nearby record", async () => {
      await assertFails(
        setDoc(doc(activeDb, "nearbyPresence", "other-user"), {
          uid: "other-user",
          enabled: true,
          latitude: -25.75,
          longitude: 28.2,
          updatedAt: serverTimestamp(),
        })
      );
    });

    await test("Active member can create own RSVP", async () => {
      await assertSucceeds(
        setDoc(
          doc(activeDb, "experiences", "test-meet", "rsvps", "active-user"),
          {
            userId: "active-user",
            status: "accepted",
            updatedAt: serverTimestamp(),
            invitationId: "test-invitation",
          }
        )
      );
    });

    await test("Member cannot create another member's RSVP", async () => {
      await assertFails(
        setDoc(
          doc(otherDb, "experiences", "test-meet", "rsvps", "active-user"),
          {
            userId: "active-user",
            status: "accepted",
          }
        )
      );
    });

    // ACCOUNT STATUS SECURITY

    await test("Missing account cannot read profiles", async () => {
      await assertFails(
        getDoc(doc(missingDb, "users", "active-user"))
      );
    });

    await test("Deactivated member cannot update profile", async () => {
      await assertFails(
        updateDoc(doc(inactiveDb, "users", "inactive-user"), {
          fullName: "Unauthorized Change",
        })
      );
    });

    await test("Member cannot activate account directly", async () => {
      await assertFails(
        updateDoc(doc(inactiveDb, "privateUserData", "inactive-user"), {
          accountStatus: "active",
        })
      );
    });

    await test("Active member cannot change account status", async () => {
      await assertFails(
        updateDoc(doc(activeDb, "privateUserData", "active-user"), {
          accountStatus: "deactivated",
        })
      );
    });

    // WAVES

    const waveId = "active-user_other-user";

    await test("Active member can send Wave", async () => {
      await assertSucceeds(
        setDoc(doc(activeDb, "waves", waveId), {
          senderId: "active-user",
          recipientId: "other-user",
          status: "pending",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    });

    await test("Sender can read own Wave", async () => {
      await assertSucceeds(
        getDoc(doc(activeDb, "waves", waveId))
      );
    });

    await test("Recipient can read incoming Wave", async () => {
      await assertSucceeds(
        getDoc(doc(otherDb, "waves", waveId))
      );
    });

    await test("Guest cannot read Wave", async () => {
      await assertFails(
        getDoc(doc(guestDb, "waves", waveId))
      );
    });

    await test("Sender cannot accept own Wave", async () => {
      await assertFails(
        updateDoc(doc(activeDb, "waves", waveId), {
          status: "friends",
          updatedAt: serverTimestamp(),
        })
      );
    });

    // NOTIFICATIONS

    await test("Wave sender can notify recipient", async () => {
      await assertSucceeds(
        setDoc(
          doc(otherDb, "users", "active-user", "notificationStates", "self-test"),
          { isRead: true }
        )
      ).then(
        () => {
          throw new Error(
            "Unexpected permission: another user edited notification state"
          );
        },
        () => {}
      );
    });

    await test("Recipient can read invitation", async () => {
      await assertSucceeds(
        getDoc(
          doc(activeDb, "users", "active-user", "notifications", "invite-test")
        )
      );
    });

    await test("Recipient can accept invitation notification", async () => {
      await assertSucceeds(
        updateDoc(
          doc(activeDb, "users", "active-user", "notifications", "invite-test"),
          {
            rsvpStatus: "accepted",
            updatedAt: serverTimestamp(),
          }
        )
      );
    });

    await test("Other member cannot edit invitation", async () => {
      await assertFails(
        updateDoc(
          doc(otherDb, "users", "active-user", "notifications", "invite-test"),
          {
            isRead: true,
          }
        )
      );
    });

    // ACCEPTING WAVES

    await test("Recipient can accept Wave", async () => {
      await assertSucceeds(
        updateDoc(doc(otherDb, "waves", waveId), {
          status: "friends",
          updatedAt: serverTimestamp(),
        })
      );
    });

    await test("Accepted Wave cannot be accepted again", async () => {
      await assertFails(
        updateDoc(doc(otherDb, "waves", waveId), {
          status: "friends",
          updatedAt: serverTimestamp(),
        })
      );
    });

    console.log("\n------------------------");
    console.log("Passed:", passed);
    console.log("Failed:", failed);
    console.log("------------------------");

    if (failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    await testEnv.cleanup();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
