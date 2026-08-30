# Prompt for New Chat Session

Copy and paste this entire prompt into a new chat session:

---

**I need you to implement Docker container creation for db_manager service. Read the following files to get caught up:**

1. **START_HERE.md** - `worker/db_manager/START_HERE.md` - Quick start guide
2. **Implementation Plan** - `worker/db_manager/IMPLEMENTATION_PLAN.md` - Detailed implementation guide
3. **Agent Prompt** - `worker/db_manager/AGENT_PROMPT.md` - Comprehensive context
4. **Plan** - `worker/db_manager/plan.md` - Complete implementation plan

**Key files to understand the pattern:**
- `worker/docker/ServiceManager.js` - See how worker creates containers using dockerode
- `worker/db_manager/api/services/DatabaseService.js` - Current implementation (creates records, doesn't create containers yet)
- `worker/db_manager/api/services/EncryptionService.js` - Already uses key_manager for encryption

**What needs to be done:**
1. Create `InstanceService.js` - Uses dockerode to create/start/stop/delete Docker containers (follow pattern from `worker/docker/ServiceManager.js`)
2. Create `api/services/databases/postgresql.js` - PostgreSQL-specific container configuration
3. Update `DatabaseService.js` - Integrate InstanceService to actually create containers when `createDatabase()` is called
4. Update API routes - Make start/stop/restart endpoints actually work

**Key points:**
- db_manager runs on worker - has direct Docker access via `/var/run/docker.sock`
- Use dockerode (same as worker's ServiceManager)
- Container naming: `aerekos-db-{database-name}`
- Volume naming: `aerekos-db-{database-name}-data`
- Support custom username/password/port in API (schema already updated)
- EncryptionService already implemented - uses key_manager (no changes needed)
- storage_manager integration for backups is future work

**Start with PostgreSQL**, then we can add other database types later.

**Read all the files above, then implement InstanceService and PostgreSQL handler. Test that you can create a PostgreSQL container with custom username/password/port via the API.**

---

