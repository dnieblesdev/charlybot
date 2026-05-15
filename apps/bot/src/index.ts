// Dynamic import so we can catch startup errors
import("./app/core/index.ts").catch((err) => {
  console.error("BOT STARTUP ERROR:", err);
  process.exit(1);
});
