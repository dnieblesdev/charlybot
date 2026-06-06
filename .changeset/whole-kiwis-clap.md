---
"@charlybot/shared": minor
"@charlybot/bot": minor
---

- Normalize economy money persistence to whole integer amounts while preserving existing field names.
- Add shared money validation and formatting helpers for configurable server currencies.
- Harden bot economy repositories, services, and commands against decimal and negative amount bugs.
- Improve database migration wrappers with blocking backups and consistent environment loading.
