# Release 2026-04-25 - valkey-stream-fixes

## Packages
- @charlybot/shared: 2.5.2 -> 2.5.3
- @charlybot/api: 2.6.3 -> 2.6.4

## @charlybot/shared (patch)
- Fix ValkeyClient stream parsing: handle dual field formats (tuple `[[k,v]]` and flat `[k,v,k,v]`) in `streamReadGroup` and `streamClaim`
- Fix `streamPending`: use ioredis array format `[id, consumer, time, count]` instead of assumed object format

## @charlybot/api (patch)
- Add Valkey behavioral tests S1-S7 (17 tests against real Valkey instance):
  - S1: Cache hit/miss tracking
  - S2: Pub/Sub delivery to multiple subscribers
  - S3: Stream consumer group initialization
  - S4: ACK-on-success semantics
  - S5: Reclaim PEL after timeout
  - S6: DLQ on max retries
  - S7: Idempotent reprocessing
- Updated dependency on @charlybot/shared@2.5.3
