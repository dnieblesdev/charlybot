-- Convert economy persistence fields from float to whole integer amounts.
-- Safe to review without applying; do not run automatically from this artifact.

BEGIN;

ALTER TABLE "UserEconomy"
  ADD COLUMN "pocket_next" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "totalEarned_next" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "totalLost_next" INTEGER NOT NULL DEFAULT 0;

UPDATE "UserEconomy"
SET
  "pocket_next" = ROUND("pocket")::INTEGER,
  "totalEarned_next" = ROUND("totalEarned")::INTEGER,
  "totalLost_next" = ROUND("totalLost")::INTEGER;

ALTER TABLE "GlobalBank"
  ADD COLUMN "bank_next" INTEGER NOT NULL DEFAULT 0;

UPDATE "GlobalBank"
SET "bank_next" = ROUND("bank")::INTEGER;

ALTER TABLE "RouletteBet"
  ADD COLUMN "amount_next" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "winAmount_next" INTEGER;

UPDATE "RouletteBet"
SET
  "amount_next" = ROUND("amount")::INTEGER,
  "winAmount_next" = CASE
    WHEN "winAmount" IS NULL THEN NULL
    ELSE ROUND("winAmount")::INTEGER
  END;

ALTER TABLE "Leaderboard"
  ADD COLUMN "totalMoney_next" INTEGER NOT NULL DEFAULT 0;

UPDATE "Leaderboard"
SET "totalMoney_next" = ROUND("totalMoney")::INTEGER;

ALTER TABLE "UserEconomy"
  DROP COLUMN "pocket",
  DROP COLUMN "totalEarned",
  DROP COLUMN "totalLost";

ALTER TABLE "UserEconomy" RENAME COLUMN "pocket_next" TO "pocket";
ALTER TABLE "UserEconomy" RENAME COLUMN "totalEarned_next" TO "totalEarned";
ALTER TABLE "UserEconomy" RENAME COLUMN "totalLost_next" TO "totalLost";

ALTER TABLE "GlobalBank"
  DROP COLUMN "bank";

ALTER TABLE "GlobalBank" RENAME COLUMN "bank_next" TO "bank";

ALTER TABLE "RouletteBet"
  DROP COLUMN "amount",
  DROP COLUMN "winAmount";

ALTER TABLE "RouletteBet" RENAME COLUMN "amount_next" TO "amount";
ALTER TABLE "RouletteBet" RENAME COLUMN "winAmount_next" TO "winAmount";

ALTER TABLE "Leaderboard"
  DROP COLUMN "totalMoney";

ALTER TABLE "Leaderboard" RENAME COLUMN "totalMoney_next" TO "totalMoney";

CREATE INDEX "Leaderboard_guildId_totalMoney_joinedServerAt_idx"
  ON "Leaderboard"("guildId", "totalMoney", "joinedServerAt");

COMMIT;
