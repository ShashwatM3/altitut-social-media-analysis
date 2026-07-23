"use client";

import { getDownloadURL, getStorage, ref, uploadBytesResumable } from "firebase/storage";
import { firebaseApp } from "./firebase";

export type StorageUploadResult = {
  url: string;
  path: string;
};

export function uploadToStorage(
  file: File,
  onProgress: (pct: number) => void,
): Promise<StorageUploadResult> {
  const path = `autopost/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const task = uploadBytesResumable(ref(getStorage(firebaseApp), path), file, {
    contentType: file.type,
  });

  return new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => {
        onProgress(
          Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
        );
      },
      (error) => reject(error),
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve({ url, path });
      },
    );
  });
}
