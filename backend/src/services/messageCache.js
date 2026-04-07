/**
 * Redis-backed message ID dedup cache.
 *
 * Prevents re-processing Gmail/IMAP message IDs that were already
 * scored in a recent scan. TTL is 7 days — enough to cover monthly cycles
 * without permanently blacklisting messages.
 *
 * Only active when QUEUE_ENABLED=true (ioredis lazy-loaded).
 */

const TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

let _redis = null;

async function getRedis() {
  if (_redis) return _redis;
  const { default: Redis } = await import('ioredis');
  _redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 2,
    lazyConnect: true,
    enableOfflineQueue: false,
  });
  _redis.on('error', (err) => {
    // Non-fatal — dedup fails open (all messages processed)
    console.warn('[messageCache] Redis error:', err.message);
  });
  await _redis.connect().catch(() => {});
  return _redis;
}

function cacheKey(userId) {
  return `scan:processed:${userId}`;
}

/**
 * Filter a list of message IDs to those NOT already in the cache.
 * On Redis failure, returns all IDs (fail open — better to re-process than miss).
 */
export async function filterUnprocessedIds(userId, messageIds) {
  if (!messageIds?.length) return [];
  try {
    const redis = await getRedis();
    const key   = cacheKey(userId);
    const pipeline = redis.pipeline();
    for (const id of messageIds) pipeline.sismember(key, id);
    const results = await pipeline.exec();
    return messageIds.filter((_, i) => results[i][1] === 0);
  } catch {
    return messageIds; // fail open
  }
}

/**
 * Mark message IDs as processed. Refreshes TTL on the set.
 * On Redis failure, silently skips (next scan may reprocess — acceptable).
 */
export async function markProcessedIds(userId, messageIds) {
  if (!messageIds?.length) return;
  try {
    const redis = await getRedis();
    const key   = cacheKey(userId);
    const pipeline = redis.pipeline();
    if (messageIds.length) pipeline.sadd(key, ...messageIds);
    pipeline.expire(key, TTL_SECONDS);
    await pipeline.exec();
  } catch {
    // non-fatal
  }
}
