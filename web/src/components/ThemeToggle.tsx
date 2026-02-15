import { useState, useEffect } from "react";

export function ThemeToggle() {
    const [dark, setDark] = useState(() => {
        const saved = localStorage.getItem("reddit-dl-theme");
        if (saved) return saved === "dark";
        return window.matchMedia("(prefers-color-scheme: dark)").matches;
    });

    useEffect(() => {
        document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
        localStorage.setItem("reddit-dl-theme", dark ? "dark" : "light");
    }, [dark]);

    return (
        <button
            className="theme-toggle"
            onClick={() => setDark((d) => !d)}
            aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
            title={`Switch to ${dark ? "light" : "dark"} mode`}
        >
            {dark ? "☀️" : "🌙"}
        </button>
    );
}
