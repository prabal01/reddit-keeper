/**
 * Safely extract error message from unknown catch value.
 */
export function errMsg(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return String(err);
}

/**
 * Safely extract error code from unknown catch value (e.g., Firebase errors).
 */
export function errCode(err: unknown): string | undefined {
    if (typeof err === 'object' && err !== null && 'code' in err) {
        return (err as { code: string }).code;
    }
    return undefined;
}
