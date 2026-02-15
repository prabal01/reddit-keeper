import { useState, useCallback } from "react";
import { fetchThread, type FetchOptions, type FetchResult, type ThreadMetadata } from "../lib/api";

interface UseRedditThreadReturn {
    thread: FetchResult | null;
    metadata: ThreadMetadata | null;
    loading: boolean;
    error: string | null;
    fetch: (options: FetchOptions) => Promise<void>;
    clear: () => void;
}

export function useRedditThread(): UseRedditThreadReturn {
    const [thread, setThread] = useState<FetchResult | null>(null);
    const [metadata, setMetadata] = useState<ThreadMetadata | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async (options: FetchOptions) => {
        setLoading(true);
        setError(null);
        setThread(null);
        setMetadata(null);

        try {
            const data = await fetchThread(options);
            setThread(data);
            setMetadata(data.metadata);
        } catch (err: any) {
            setError(err.message || "Failed to fetch thread");
        } finally {
            setLoading(false);
        }
    }, []);

    const clear = useCallback(() => {
        setThread(null);
        setMetadata(null);
        setError(null);
    }, []);

    return { thread, metadata, loading, error, fetch: fetchData, clear };
}
