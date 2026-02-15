import { useState } from "react";
import type { ThreadData } from "@core/reddit/types.js";
import { formatAsMarkdown } from "@core/formatters/markdown.js";
import { formatAsJson } from "@core/formatters/json.js";
import { formatAsText } from "@core/formatters/text.js";

interface ExportPanelProps {
    thread: ThreadData;
}

type Format = "md" | "json" | "text";

const FORMAT_META: Record<Format, { label: string; ext: string; mime: string }> = {
    md: { label: "Markdown", ext: ".md", mime: "text/markdown" },
    json: { label: "JSON", ext: ".json", mime: "application/json" },
    text: { label: "Plain Text", ext: ".txt", mime: "text/plain" },
};

export function ExportPanel({ thread }: ExportPanelProps) {
    const [format, setFormat] = useState<Format>("md");
    const [copied, setCopied] = useState(false);

    const getFormattedContent = (): string => {
        switch (format) {
            case "json":
                return formatAsJson(thread);
            case "text":
                return formatAsText(thread);
            default:
                return formatAsMarkdown(thread);
        }
    };

    const handleCopy = async () => {
        const content = getFormattedContent();
        try {
            await navigator.clipboard.writeText(content);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback for non-secure contexts
            const textarea = document.createElement("textarea");
            textarea.value = content;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            document.body.removeChild(textarea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleDownload = () => {
        const content = getFormattedContent();
        const meta = FORMAT_META[format];
        const blob = new Blob([content], { type: meta.mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${thread.post.subreddit}_${thread.post.id}${meta.ext}`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const tokens = Math.ceil(getFormattedContent().length / 4);

    return (
        <div className="export-panel" role="toolbar" aria-label="Export options">
            <div className="export-format">
                {(Object.entries(FORMAT_META) as [Format, typeof FORMAT_META["md"]][]).map(
                    ([key, meta]) => (
                        <button
                            key={key}
                            className={`format-btn ${format === key ? "active" : ""}`}
                            onClick={() => setFormat(key)}
                            aria-pressed={format === key}
                            aria-label={`Export as ${meta.label}`}
                        >
                            {meta.label}
                        </button>
                    )
                )}
            </div>

            <div className="export-actions">
                <span className="token-count" aria-label={`Estimated ${tokens.toLocaleString()} tokens`}>
                    ~{tokens.toLocaleString()} tokens
                </span>
                <button
                    className="export-btn copy-btn"
                    onClick={handleCopy}
                    aria-label={copied ? "Copied to clipboard" : "Copy to clipboard"}
                >
                    {copied ? "✓ Copied" : "📋 Copy"}
                </button>
                <button
                    className="export-btn download-btn"
                    onClick={handleDownload}
                    aria-label="Download file"
                >
                    ⬇ Download
                </button>
            </div>
        </div>
    );
}
