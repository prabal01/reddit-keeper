import React from 'react';
import { useLocation, Link, useParams } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { useFolders } from '../../contexts/FolderContext';

interface BreadcrumbItem {
    label: string;
    path?: string;
    current?: boolean;
}

interface BreadcrumbsProps {
    items?: BreadcrumbItem[];
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => {
    const location = useLocation();
    const { folderId } = useParams<{ folderId: string }>();
    const { folders } = useFolders();
    
    const pathnames = location.pathname.split('/').filter((x) => x);
    
    // Find folder name if we are in a folder view
    const currentFolder = folderId ? folders.find(f => f.id === folderId) : null;
    const folderName = currentFolder ? currentFolder.name : (folderId === 'inbox' ? 'Inbox' : folderId);

    if (location.pathname === '/' || location.pathname === '/decks') {
        return (
            <div className="flex items-center gap-2 text-sm font-medium text-(--text-tertiary)">
                <Home size={14} className="text-(--text-secondary)" />
                <span>Dashboard</span>
            </div>
        );
    }

    const renderItems = items || (pathnames.map((value, index) => {
        const last = index === pathnames.length - 1;
        const to = `/${pathnames.slice(0, index + 1).join('/')}`;
        
        let label = value.charAt(0).toUpperCase() + value.slice(1);
        if (value === folderId) label = folderName || value;
        if (value === 'lab') label = 'Experience Lab';
        if (value === 'discovery') label = 'Discovery';
        if (value === 'decks') return null;

        return { label, path: last ? undefined : to, current: last };
    }).filter(Boolean) as BreadcrumbItem[]);

    return (
        <nav className="flex items-center gap-2 text-sm font-medium" aria-label="Breadcrumb">
            <Link 
                to="/" 
                className="flex items-center gap-1.5 text-(--text-tertiary) hover:text-(--text-primary) transition-colors"
            >
                <Home size={14} />
                <span>Dashboard</span>
            </Link>
            
            {renderItems.length > 0 && (
                <ChevronRight size={14} className="text-(--text-tertiary) opacity-50" />
            )}

            {renderItems.map((item, index) => {
                const last = index === renderItems.length - 1;
                
                return item.current || !item.path ? (
                    <span key={index} className="text-(--text-primary) truncate max-w-[200px]" aria-current="page">
                        {item.label}
                    </span>
                ) : (
                    <React.Fragment key={index}>
                        <Link 
                            to={item.path} 
                            className="text-(--text-tertiary) hover:text-(--text-primary) transition-colors"
                        >
                            {item.label}
                        </Link>
                        {!last && <ChevronRight size={14} className="text-(--text-tertiary) opacity-50" />}
                    </React.Fragment>
                );
            })}
        </nav>
    );
};
