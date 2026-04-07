import { useState, type FormEvent } from "react";
import { UIButton } from "./common/UIButton";

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
                    placeholder="Paste a Reddit link to analyze..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={loading}
                    aria-describedby="url-hint"
                    autoComplete="url"
                />
                <div className="url-input-actions">
                    <label htmlFor="sort-select" className="sr-only">
                        Filter comments by
                    </label>
                    <select
                        id="sort-select"
                        className="sort-select"
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                        disabled={loading}
                        aria-label="Filter comments by"
                    >
                        {SORT_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                    <UIButton
                        type="submit"
                        variant="primary"
                        loading={loading}
                        disabled={!url.trim() || loading}
                        aria-label="Analyze Reddit thread"
                    >
                        Analyze
                    </UIButton>
                </div>
            </div>
            <p id="url-hint" className="url-hint">
                e.g. https://www.reddit.com/r/subreddit/comments/...
            </p>
        </form>
    );
}
