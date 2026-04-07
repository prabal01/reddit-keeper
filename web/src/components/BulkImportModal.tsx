import React, { useState } from 'react';
import { X, UploadCloud, Loader2, AlertCircle } from 'lucide-react';
import { useFolders } from '../contexts/FolderContext';
import { H2, Metadata } from './common/Typography';
import { UIButton } from './common/UIButton';
import './Folders.css';

interface BulkImportModalProps {
    folderId: string;
    onClose: () => void;
    onSuccess: (count: number) => void;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({ folderId, onClose, onSuccess }) => {
    const { syncThreads } = useFolders();
    const [urlsText, setUrlsText] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleImport = async () => {
        setError(null);

        // Extract URLs
        const extractedUrls = urlsText
            .split(/[\n,]+/)
            .map(u => u.trim())
            .filter(u => u.includes('reddit.com') || u.includes('news.ycombinator.com'));

        if (extractedUrls.length === 0) {
            setError("No valid Reddit or Hacker News URLs found.");
            return;
        }

        // Deduplicate
        const uniqueUrls = [...new Set(extractedUrls)];

        setIsSubmitting(true);
        try {
            await syncThreads(folderId, uniqueUrls);
            onSuccess(uniqueUrls.length);
            onClose();
        } catch (err: any) {
            setError(err.message || "Failed to start import");
            setIsSubmitting(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content bg-(--bg-secondary) border border-(--border-light) p-8 rounded-3xl backdrop-blur-xl shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%' }}>
                <div className="flex justify-between items-center mb-6">
                    <H2 className="text-xl! flex items-center gap-2">
                        <UploadCloud size={24} className="text-(--bg-accent)" />
                        Bulk Import Threads
                    </H2>
                    <UIButton variant="secondary" size="sm" className="p-2!" onClick={onClose} icon={<X size={20} />} />
                </div>

                <Metadata className="mb-6 leading-relaxed">
                    Paste a list of Reddit or Hacker News thread URLs. You can separate them by newlines or commas.
                    The system will automatically fetch, process, and analyze them in the background.
                </Metadata>

                {error && (
                    <div className="error-banner mb-4 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3">
                        <AlertCircle size={20} className="shrink-0" />
                        <span className="text-xs font-bold">{error}</span>
                    </div>
                )}

                <textarea
                    value={urlsText}
                    onChange={e => setUrlsText(e.target.value)}
                    placeholder="https://www.reddit.com/r/Entrepreneur/comments/...
https://news.ycombinator.com/item?id=..."
                    className="w-full h-48 bg-(--bg-input) border border-(--border-light) rounded-2xl p-5 text-(--text-primary) font-mono text-sm resize-none mb-6 outline-none focus:ring-2 focus:ring-(--bg-accent)/30 focus:border-(--bg-accent)/50 transition-all placeholder:text-(--text-tertiary)"
                    disabled={isSubmitting}
                />

                <div className="flex justify-end items-center gap-4">
                    <UIButton
                        variant="secondary"
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </UIButton>
                    <UIButton
                        variant="primary"
                        onClick={handleImport}
                        disabled={isSubmitting || !urlsText.trim()}
                        icon={isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <UploadCloud size={18} />}
                    >
                        {isSubmitting ? 'Importing Threads...' : 'Import URLs'}
                    </UIButton>
                </div>
            </div>
        </div>
    );
};
