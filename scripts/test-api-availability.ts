import { ApiConnectionError, apiFetch } from "../lib/api";

const originalFetch = global.fetch;

async function run() {
  global.fetch = (async () => {
    throw new TypeError("Failed to fetch");
  }) as typeof fetch;

  try {
    await apiFetch("/api/autopost/accounts", { method: "POST" });
    console.error("FAIL: a refused backend connection was treated as success.");
    process.exitCode = 1;
  } catch (error) {
    const passed =
      error instanceof ApiConnectionError &&
      error.message.includes("npm run dev") &&
      error.message.includes("8000");
    console.log(
      `${passed ? "PASS" : "FAIL"}: refused API connections become an actionable UI error.`,
    );
    if (!passed) {
      console.error(error);
      process.exitCode = 1;
    }
  } finally {
    global.fetch = originalFetch;
  }
}

void run();
