import React from 'react';
import { Loader2 } from 'lucide-react';

interface AppLoadingOverlayProps {
    isLoading: boolean;
    message: string;
}

export const AppLoadingOverlay: React.FC<AppLoadingOverlayProps> = ({ isLoading, message }) => {
    if (!isLoading) return null;

    return (
        <div className="fixed inset-0 bg-gray-900/95 flex flex-col items-center justify-center z-50">
            <Loader2 className="w-20 h-20 text-amber-500 animate-spin" />
            <p className="text-white text-2xl font-bold mt-8">{message}</p>
        </div>
    );
};
