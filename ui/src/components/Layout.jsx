import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from "@/lib/utils";
import { LayoutDashboard, Target, Play, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";

const SidebarItem = ({ to, icon: Icon, children }) => {
    return (
        <NavLink
            to={to}
            className={({ isActive }) =>
                cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:text-primary",
                    isActive
                        ? "bg-muted text-primary"
                        : "text-muted-foreground"
                )
            }
        >
            <Icon className="h-4 w-4" />
            {children}
        </NavLink>
    );
};

export default function Layout({ children }) {
    return (
        <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
            <div className="hidden border-r bg-muted/40 md:flex md:flex-col h-screen sticky top-0">
                <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6 shrink-0">
                    <NavLink to="/" className="flex items-center gap-2 font-semibold">
                        <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-500 bg-clip-text text-transparent">FLUX</span>
                    </NavLink>
                </div>
                <div className="flex-1 overflow-auto py-2">
                    <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
                        <SidebarItem to="/" icon={LayoutDashboard}>Scripts</SidebarItem>
                        <SidebarItem to="/targets" icon={Target}>Targets</SidebarItem>
                        <SidebarItem to="/preview" icon={Play}>Preview Tester</SidebarItem>
                    </nav>
                </div>
                <div className="mt-auto p-4 border-t shrink-0">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Theme</span>
                        <ModeToggle />
                    </div>
                </div>
            </div>
            <div className="flex flex-col">
                <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6 md:hidden">
                    <NavLink to="/" className="flex items-center gap-2 font-semibold">
                        <span className="text-lg font-bold">FLUX</span>
                    </NavLink>
                    {/* Mobile Menu Trigger could go here */}
                </header>
                <main className="flex-1 overflow-auto p-4 lg:p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
