import React from 'react';
import { useLocation, Link, useParams } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { useFolders } from '../../contexts/FolderContext';

export const Breadcrumbs: React.FC = () => {
    const location = useLocation();
    const { folderId } = useParams<{ folderId: string }>();
    const { folders } = useFolders();
    
    const pathnames = location.pathname.split('/').filter((x) => x);
    
    // Find folder name if we are in a folder view
    const currentFolder = folderId ? folders.find(f => f.id === folderId) : null;
    const folderName = currentFolder ? currentFolder.name : (folderId === 'inbox' ? 'Inbox' : folderId);

    if (location.pathname === '/' || location.pathname === '/decks') {
        return (
            <div className="flex items-center gap-2 text-sm font-medium text-tertiary">
                <Home size={14} className="text-secondary" />
                <span>Dashboard</span>
            </div>
        );
    }

    return (
        <nav className="flex items-center gap-2 text-sm font-medium" aria-label="Breadcrumb">
            <Link 
                to="/decks" 
                className="flex items-center gap-1.5 text-tertiary hover:text-white transition-colors"
            >
                <Home size={14} />
                <span>Dashboard</span>
            </Link>
            
            {pathnames.length > 0 && (
                <ChevronRight size={14} className="text-tertiary opacity-50" />
            )}

            {pathnames.map((value, index) => {
                const last = index === pathnames.length - 1;
                const to = `/${pathnames.slice(0, index + 1).join('/')}`;
                
                // Special mapping for IDs to Names
                let label = value.charAt(0).toUpperCase() + value.slice(1);
                if (value === folderId) label = folderName || value;
                if (value === 'lab') label = 'Experience Lab';
                if (value === 'discovery') label = 'Discovery';
                if (value === 'decks') return null; // Skip "decks" since we have "Dashboard"

                return last ? (
                    <span key={to} className="text-white truncate max-w-[200px]" aria-current="page">
                        {label}
                    </span>
                ) : (
                    <React.Fragment key={to}>
                        <Link 
                            to={to} 
                            className="text-tertiary hover:text-white transition-colors"
                        >
                            {label}
                        </Link>
                        <ChevronRight size={14} className="text-tertiary opacity-50" />
                    </React.Fragment>
                );
            }).filter(Boolean)}
        </nav>
    );
};
