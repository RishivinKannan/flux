import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

function NavigationProgress() {
    const [loading, setLoading] = useState(false);
    const location = useLocation();

    useEffect(() => {
        // Show loading when route starts to change
        setLoading(true);

        // Hide loading after a short delay to allow the new route to render
        const timer = setTimeout(() => {
            setLoading(false);
        }, 300);

        return () => clearTimeout(timer);
    }, [location.pathname]);

    if (!loading) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-transparent">
            <div className="h-full bg-primary animate-in slide-in-from-left duration-300 w-full origin-left" />
        </div>
    );
}

export default NavigationProgress;
