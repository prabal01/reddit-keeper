import { useState, type FormEvent } from "react";

interface UrlInputProps {
    onFetch: (url: string, sort: string) => void;
    loading: boolean;
}

const SORT_OPTIONS = [
    { value: "confidence", label: "Best" },
    { value: "top", label: "Top" },
    { value: "new", label: "New" },
    { value: "controversial", label: "Controversial" },
    { value: "old", label: "Old" },
];

export function UrlInput({ onFetch, loading }: UrlInputProps) {
    const [url, setUrl] = useState("");
    const [sort, setSort] = useState("confidence");

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (url.trim() && !loading) {
            onFetch(url.trim(), sort);
        }
    };

    return (
        <form className="url-input-form" onSubmit={handleSubmit} role="search">
            <div className="url-input-wrapper">
                <label htmlFor="reddit-url" className="sr-only">
                    Reddit post URL
                </label>
                <input
                    id="reddit-url"
                    type="url"
                    className="url-input"
                    placeholder="Paste Reddit post URL..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={loading}
                    aria-describedby="url-hint"
                    autoComplete="url"
                />
                <div className="url-input-actions">
                    <label htmlFor="sort-select" className="sr-only">
                        Sort comments by
                    </label>
                    <select
                        id="sort-select"
                        className="sort-select"
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                        disabled={loading}
                        aria-label="Sort comments by"
                    >
                        {SORT_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                    <button
                        type="submit"
                        className="fetch-btn"
                        disabled={!url.trim() || loading}
                        aria-label="Fetch Reddit thread"
                    >
                        {loading ? (
                            <span className="spinner" aria-hidden="true" />
                        ) : (
                            "Fetch"
                        )}
                        {loading && <span className="sr-only">Loading...</span>}
                    </button>
                </div>
            </div>
            <p id="url-hint" className="url-hint">
                e.g. https://www.reddit.com/r/SideProject/comments/1r544g7/...
            </p>
        </form>
    );
}
