import React, { useState } from 'react';
import { UploadCloud, AlertCircle } from 'lucide-react';

interface BulkImportHeaderProps {
    onImport: (urls: string[]) => void;
    loading: boolean;
}

export const BulkImportHeader: React.FC<BulkImportHeaderProps> = ({ onImport, loading }) => {
    const [urlsText, setUrlsText] = useState('');
    const [error, setError] = useState<string | null>(null);

    const validateAndImport = () => {
        setError(null);

        // Split by newlines or commas
        const rawUrls = urlsText
            .split(/[\n,]+/)
            .map(u => u.trim())
            .filter(u => u !== '');

        if (rawUrls.length === 0) {
            setError("Please enter at least one URL.");
            return;
        }

        if (rawUrls.length > 50) {
            setError("Maximum 50 URLs allowed for bulk import.");
            return;
        }

        const validatedUrls: string[] = [];
        const invalidUrls: string[] = [];

        rawUrls.forEach(url => {
            try {
                const parsedUrl = new URL(url);
                const isReddit = parsedUrl.hostname.includes('reddit.com');
                const isHN = parsedUrl.hostname.includes('news.ycombinator.com');

                if (isReddit) {
                    // Exclude comment permalinks, only allow thread URLs
                    // Reddit thread pattern: reddit.com/r/subreddit/comments/id/title/
                    // Comment link pattern: reddit.com/r/subreddit/comments/id/title/comment_id/
                    const paths = parsedUrl.pathname.split('/').filter(Boolean);
                    if (paths.length === 4 || paths.length === 5) {
                        validatedUrls.push(url);
                    } else {
                        invalidUrls.push(url);
                    }
                } else if (isHN) {
                    // HN thread pattern: news.ycombinator.com/item?id=...
                    if (parsedUrl.searchParams.has('id')) {
                        validatedUrls.push(url);
                    } else {
                        invalidUrls.push(url);
                    }
                } else {
                    invalidUrls.push(url);
                }
            } catch (e) {
                invalidUrls.push(url);
            }
        });

        if (invalidUrls.length > 0) {
            setError(`Found ${invalidUrls.length} invalid or unsupported URLs. Only Reddit/HN thread URLs are allowed (no comment links).`);
            return;
        }

        onImport(validatedUrls);
        setUrlsText('');
    };

    const urlCount = urlsText.split('\n').map(l => l.trim()).filter(Boolean).length;

    return (
        <div className="w-full flex flex-col items-center transition-all duration-500 z-10">
            <div className="dw-search-wrapper">
                <textarea
                    className="w-full bg-transparent border-none resize-none text-white text-lg font-bold leading-relaxed outline-none p-1.5 placeholder:text-slate-600 tracking-tight"
                    placeholder="Paste Reddit or Hacker News URLs... (one per line, up to 50)"
                    rows={4}
                    value={urlsText}
                    onChange={(e) => setUrlsText(e.target.value)}
                />

                {error && (
                    <div className="mx-2 flex items-center gap-3 bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-xl text-red-500 text-xs font-bold animate-in fade-in slide-in-from-top-1 duration-300">
                        <AlertCircle size={14} />
                        {error}
                    </div>
                )}

                <div className="flex justify-between items-center gap-5 border-t border-[#222240] pt-2 px-2">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                        <AlertCircle size={14} className="opacity-60" />
                        <span>{urlCount} URLs detected</span>
                    </div>

                    <button
                        className="dw-primary-btn"
                        onClick={validateAndImport}
                        disabled={loading || urlCount === 0 || !!error}
                    >
                        {loading ? <UploadCloud className="animate-spin" size={16} /> : <UploadCloud size={16} />}
                        Import Threads
                    </button>
                </div>
            </div>
        </div>
    );
};
