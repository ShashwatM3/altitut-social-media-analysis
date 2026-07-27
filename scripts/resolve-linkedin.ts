import "dotenv/config";
import { resolveSocialAccount } from "../lib/social/accounts";

async function run() {
  const profile = process.env.UPLOAD_POST_PROFILE ?? "altitut";
  const account = await resolveSocialAccount("linkedin", profile);
  console.log(JSON.stringify(account, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
