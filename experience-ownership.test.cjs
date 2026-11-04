
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");

const {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
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
    // Clears emulator data only, never production data.
    await env.clearFirestore();

    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();

      for (const uid of ["organiser", "other-member"]) {
        await setDoc(doc(db, "privateUserData", uid), {
          accountStatus: "active",
        });
      }
    });

    const organiserDb = env.authenticatedContext("organiser").firestore();
    const otherDb = env.authenticatedContext("other-member").firestore();

    const experienceRef = doc(
      organiserDb,
      "experiences",
      "ownership-test"
    );

    await test("Organiser can create an experience", async () => {
      await assertSucceeds(
        setDoc(experienceRef, {
          createdBy: "organiser",
          title: "Jimny Meet & Greet",
        })
      );
    });

    await test("Organiser can edit their experience", async () => {
      await assertSucceeds(
        updateDoc(experienceRef, {
          title: "Updated Jimny Meet & Greet",
        })
      );
    });

    await test("Organiser cannot transfer ownership", async () => {
      await assertFails(
        updateDoc(experienceRef, {
          createdBy: "other-member",
        })
      );
    });

    await test("Another member cannot edit the experience", async () => {
      await assertFails(
        updateDoc(
          doc(otherDb, "experiences", "ownership-test"),
          { title: "Unauthorized Edit" }
        )
      );
    });

    await test("Another member cannot delete the experience", async () => {
      await assertFails(
        deleteDoc(
          doc(otherDb, "experiences", "ownership-test")
        )
      );
    });

    await test("Organiser can delete their experience", async () => {
      await assertSucceeds(
        deleteDoc(experienceRef)
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
