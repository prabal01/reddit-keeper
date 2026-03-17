### Cause of the Issue
The `ERR max requests limit exceeded` from Upstash is due to BullMQ hitting its high-frequency background checks:
1. **Stalled Job Checks**: By default, BullMQ checks for stalled jobs every 30 seconds for *every* worker using a Lua script (`evalsha`). With 3 workers, that's 6 checks/min = 260,000 requests/month just checking stalled jobs!
2. **Empty Queue Polling**: The original code had `drainDelay: 10000`. BullMQ takes this in seconds, meaning it was telling Redis to block for ~2.7 hours. Upstash drops idle connections after 5 minutes, leading to connection failures, aggressive reconnections, and retries.

### Changes Made
I updated `src/server.ts` to dramatically reduce Redis command usage:
- **`stalledInterval: 300000`**: Stalled jobs are now only checked every 5 minutes instead of every 30 seconds.
- **`drainDelay: 300`**: Set to exactly 5 minutes (300 seconds) so that the blocking pop matches Upstash's timeout naturally, preventing sudden connection drops and retry loops.
- **Shared Connection Profile**: Ensured that the queues and workers use `maxRetriesPerRequest: null`, `enableReadyCheck: false`, and `family: 0` to align with Upstash recommended practices.

These changes should stop BullMQ from eating up your requests limit while idle. 
