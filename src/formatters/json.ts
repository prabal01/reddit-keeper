import type { ThreadData } from "../reddit/types.js";

/**
 * Format a complete thread as pretty-printed JSON
 */
export function formatAsJson(thread: ThreadData): string {
    return JSON.stringify(thread, null, 2);
}
