# SAAS PROMPT 2 — DATABASE ROLLBACK & RESTORATION GUIDE

## 1. Rollback Strategy Overview
Rollback is designed as a non-destructive reverse operation:
- Unsets `workspaceId` added by this migration checkpoint without touching documents belonging to other users or workspaces.
- Preserves all original `ownerId` values and historical business fields.
- Reverts `owner.defaultWorkspaceId` if needed.
- Updates `MigrationCheckpoint` to status `ROLLED_BACK`.

---

## 2. Automated Rollback Command
To execute a rollback of the latest migration:
```bash
npm run saas:migration:rollback
```
To rollback a specific checkpoint:
```bash
node backend/src/scripts/migrateM2WWorkspace.js --rollback --migration-id <id>
```

---

## 3. Verified Backup Restoration Procedure
If full database restoration is necessary due to unexpected external failures:
1. Locate the verified timestamped backup folder in `backups/mongodb/backup_<dbName>_<timestamp>/`.
2. Inspect `manifest.json` to verify total document counts and collection list.
3. Verify integrity using the built-in verification helper:
   ```javascript
   import { verifyDatabaseBackup } from './src/services/databaseBackupService.js';
   await verifyDatabaseBackup('<backup_folder_path>');
   ```
4. Restore collections and indexes cleanly.
