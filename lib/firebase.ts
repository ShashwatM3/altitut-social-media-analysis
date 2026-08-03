import { getApps, initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Public web-app config for the altitut-sma-dashboard Firebase project
// (mirrors firebase.js at the repo root). Firestore rules are open, so the
// same client SDK is used from both the browser and Next.js API routes.
const firebaseConfig = {
  apiKey: "AIzaSyDlKlMMqjqesb_wbXtN9qvpW85Ux7rjlck",
  authDomain: "altitut-sma-dashboard.firebaseapp.com",
  projectId: "altitut-sma-dashboard",
  storageBucket: "altitut-sma-dashboard.firebasestorage.app",
  messagingSenderId: "623308619945",
  appId: "1:623308619945:web:655e3d50d0a6068873e9b8",
};

export const firebaseApp =
  getApps()[0] ?? initializeApp(firebaseConfig);

export const db = getFirestore(firebaseApp);

/** Firestore collection names used across the dashboard. */
export const COLLECTIONS = {
  competitors: "competitors",
  contentPacks: "contentPacks",
  ragChunks: "ragChunks",
  scoutRuns: "scoutRuns",
  telegramUpdates: "telegramUpdates",
  socialPosts: "socialPosts",
  socialAccounts: "socialAccounts",
  postCampaigns: "postCampaigns",
  campaignPosts: "campaignPosts",
} as const;
