
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");

const {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
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

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      for (const uid of ["active-user", "other-user"]) {
        await setDoc(doc(db, "privateUserData", uid), {
          accountStatus: "active",
        });
      }

      await setDoc(doc(db, "nearbyPresence", "active-user"), {
        uid: "active-user",
        enabled: false,
        updatedAt: new Date(),
      });

      await setDoc(doc(db, "nearbyPresence", "other-user"), {
        uid: "other-user",
        enabled: true,
        latitude: -25.76,
        longitude: 28.2,
        updatedAt: new Date(),
      });
    });

    const activeDb = testEnv
      .authenticatedContext("active-user")
      .firestore();

    const otherDb = testEnv
      .authenticatedContext("other-user")
      .firestore();

    const guestDb = testEnv
      .unauthenticatedContext()
      .firestore();

    await test("Nearby ON is visible to active members", async () => {
      const snap = await assertSucceeds(
        getDoc(doc(activeDb, "nearbyPresence", "other-user"))
      );
      if (!snap.exists()) throw new Error("Expected presence document.");
      if (snap.data().enabled !== true) {
        throw new Error("Expected Nearby to be enabled.");
      }
    });

    await test("Nearby OFF is hidden from other members", async () => {
      await assertFails(
        getDoc(doc(otherDb, "nearbyPresence", "active-user"))
      );
    });

    await test("Owner can read their own Nearby OFF document", async () => {
      const snap = await assertSucceeds(
        getDoc(doc(activeDb, "nearbyPresence", "active-user"))
      );
      if (!snap.exists()) throw new Error("Own presence document missing.");
    });

    await test("Nearby OFF document contains no coordinates", async () => {
      const snap = await getDoc(
        doc(activeDb, "nearbyPresence", "active-user")
      );
      const data = snap.data();

      if ("latitude" in data || "longitude" in data) {
        throw new Error("Coordinates were not cleared.");
      }
    });

    await test("Discovery query works with enabled filter", async () => {
      const snap = await assertSucceeds(
        getDocs(
          query(
            collection(activeDb, "nearbyPresence"),
            where("enabled", "==", true)
          )
        )
      );

      if (snap.docs.length !== 1) {
        throw new Error(
          `Expected 1 visible member, got ${snap.docs.length}.`
        );
      }

      if (snap.docs[0].id !== "other-user") {
        throw new Error("Unexpected member returned.");
      }
    });

    await test("Guest cannot discover Nearby members", async () => {
      await assertFails(
        getDocs(
          query(
            collection(guestDb, "nearbyPresence"),
            where("enabled", "==", true)
          )
        )
      );
    });

  } finally {
    await testEnv.cleanup();
  }

  console.log(`\n${passed} tests passed, ${failed} failed.`);

  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
