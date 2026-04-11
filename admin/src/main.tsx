import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AdminAuthProvider } from './contexts/AdminAuthContext';
import { App } from './App';
import './index.css';

const root = document.getElementById('root');
if (!root) throw new Error('No #root element found');

createRoot(root).render(
    <StrictMode>
        <BrowserRouter>
            <AdminAuthProvider>
                <App />
            </AdminAuthProvider>
        </BrowserRouter>
    </StrictMode>
);
