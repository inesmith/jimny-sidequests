import {initializeApp} from "firebase-admin/app";
import {getStorage} from "firebase-admin/storage";
import {defineSecret} from "firebase-functions/params";
import {setGlobalOptions} from "firebase-functions/v2";
import {
  HttpsError,
  onCall,
} from "firebase-functions/v2/https";
import sharp from "sharp";

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

    const expectedPath =
      `users/${uid}/passport/jimny-original.jpg`;

    if (storagePath !== expectedPath) {
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
