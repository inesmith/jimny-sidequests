
const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");

const {
  doc,
  setDoc,
} = require("firebase/firestore");

const {
  ref,
  uploadBytes,
  getBytes,
} = require("firebase/storage");

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
    storage: {
      host: "127.0.0.1",
      port: 9199,
      rules: fs.readFileSync("storage.rules", "utf8"),
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
      }
    });

    const activeStorage = testEnv
      .authenticatedContext("active-user")
      .storage();

    const otherStorage = testEnv
      .authenticatedContext("other-user")
      .storage();

    const inactiveStorage = testEnv
      .authenticatedContext("inactive-user")
      .storage();

    const guestStorage = testEnv
      .unauthenticatedContext()
      .storage();

    const testFile = new Uint8Array([1, 2, 3, 4]);

    await test("Active member can upload own profile image", async () => {
      await assertSucceeds(
        uploadBytes(
          ref(activeStorage, "users/active-user/profile"),
          testFile
        )
      );
    });

    await test("Active member can read own image", async () => {
      await assertSucceeds(
        getBytes(ref(activeStorage, "users/active-user/profile"))
      );
    });

    await test("Other active member can read image", async () => {
      await assertSucceeds(
        getBytes(ref(otherStorage, "users/active-user/profile"))
      );
    });

    await test("Member cannot upload to another member's folder", async () => {
      await assertFails(
        uploadBytes(
          ref(otherStorage, "users/active-user/unauthorized"),
          testFile
        )
      );
    });

    await test("Deactivated member cannot read images", async () => {
      await assertFails(
        getBytes(ref(inactiveStorage, "users/active-user/profile"))
      );
    });

    await test("Deactivated member cannot upload images", async () => {
      await assertFails(
        uploadBytes(
          ref(inactiveStorage, "users/inactive-user/profile"),
          testFile
        )
      );
    });

    await test("Guest cannot read images", async () => {
      await assertFails(
        getBytes(ref(guestStorage, "users/active-user/profile"))
      );
    });

    await test("Guest cannot upload images", async () => {
      await assertFails(
        uploadBytes(
          ref(guestStorage, "users/active-user/profile"),
          testFile
        )
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
