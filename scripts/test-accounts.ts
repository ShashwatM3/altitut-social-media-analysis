import { getSocialAccounts } from "../lib/social/accounts";

async function run() {
  const results: { label: string; passed: boolean; detail: string }[] = [];

  // Wrapped response (actual Upload-Post shape).
  const wrapped = getSocialAccounts({
    success: true,
    profile: {
      username: "altitut",
      social_accounts: {
        linkedin: { display_name: "Shashwat Mahalanobis" },
        instagram: { username: "shash.m30" },
        facebook: null,
      },
    },
  });
  results.push({
    label: "wrapped response: linkedin connected",
    passed: Boolean(wrapped?.linkedin),
    detail: JSON.stringify(wrapped?.linkedin),
  });
  results.push({
    label: "wrapped response: facebook is null (not connected)",
    passed: wrapped?.facebook === null,
    detail: JSON.stringify(wrapped?.facebook),
  });

  // Legacy unwrapped response (defensive).
  const unwrapped = getSocialAccounts({
    username: "altitut",
    social_accounts: {
      linkedin: { display_name: "Shashwat Mahalanobis" },
      instagram: { username: "shash.m30" },
    },
  });
  results.push({
    label: "unwrapped response: still parsed",
    passed: Boolean(unwrapped?.linkedin && unwrapped?.instagram),
    detail: JSON.stringify(unwrapped),
  });

  // Empty / missing social_accounts.
  const missing = getSocialAccounts({ success: true, profile: { username: "altitut" } });
  results.push({
    label: "missing social_accounts handled",
    passed: missing === undefined,
    detail: JSON.stringify(missing),
  });

  console.log("--- Accounts Response Parsing ---");
  let allPassed = true;
  for (const r of results) {
    const icon = r.passed ? "PASS" : "FAIL";
    console.log(`${icon}: ${r.label}`);
    if (!r.passed) {
      console.log(`      detail: ${r.detail}`);
      allPassed = false;
    }
  }
  if (!allPassed) {
    console.error("\nAccount response parsing is broken.");
    process.exit(1);
  }
  console.log("\nAccount response parsing is GREEN.");
}

run();
