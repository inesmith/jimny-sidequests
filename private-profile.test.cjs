
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");

const {
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
} = require("firebase/firestore");

const fs = require("node:fs");

async function main() {
  const env = await initializeTestEnvironment({
    projectId: "jimny-side-quests",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: fs.readFileSync("firestore.rules", "utf8"),
    },
  });

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log("PASS:", name);
      passed++;
    } catch (error) {
      console.error("FAIL:", name, error.message);
      failed++;
    }
  }

  try {
    // Only clears local emulator data.
    await env.clearFirestore();

    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(
        doc(context.firestore(), "privateUserData", "test-user"),
        {
          uid: "test-user",
          email: "original@example.com",
          phone: null,
          homeLocation: null,
          accountStatus: "active",
          updatedAt: new Date(),
        }
      );
    });

    const db = env.authenticatedContext("test-user").firestore();
    const ref = doc(db, "privateUserData", "test-user");

    await test("Member can update phone", async () => {
      await assertSucceeds(
        updateDoc(ref, {
          phone: "0821234567",
          updatedAt: serverTimestamp(),
        })
      );
    });

    await test("Member can update home location", async () => {
      await assertSucceeds(
        updateDoc(ref, {
          homeLocation: {
            placeId: "test-place",
            formattedAddress: "Pretoria, South Africa",
          },
          updatedAt: serverTimestamp(),
        })
      );
    });

    await test("Member can update email field", async () => {
      await assertSucceeds(
        updateDoc(ref, {
          email: "updated@example.com",
          updatedAt: serverTimestamp(),
        })
      );
    });

    await test("Member cannot change account status", async () => {
      await assertFails(
        updateDoc(ref, {
          accountStatus: "deactivated",
          updatedAt: serverTimestamp(),
        })
      );
    });

    await test("Member cannot modify deletion fields", async () => {
      await assertFails(
        updateDoc(ref, {
          deletionRequestedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      );
    });

    await test("Member cannot add arbitrary private fields", async () => {
      await assertFails(
        updateDoc(ref, {
          isAdmin: true,
          updatedAt: serverTimestamp(),
        })
      );
    });

  } finally {
    await env.cleanup();
  }

  console.log(`\n${passed} passed, ${failed} failed.`);
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
