"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

// import Navbar from "@/components/TopBar";

export function LayoutContent({ children }: { children: React.ReactNode }) {
  const [hovered, setHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(true);

  const isExpanded = hovered || isPinned;
  const pathname = usePathname();
  const isAuthRoute = pathname?.startsWith("/auth");
  const isInvitationRoute = pathname?.startsWith("/invitation");

  return (
    <TooltipProvider>
      <SidebarProvider>
        <div className="bg-sidebar relative flex min-h-screen w-full overflow-x-hidden">
          {/* SIDEBAR */}
          <aside
            className={`hidden shrink-0 transition-[width] duration-300 lg:block ${
              isExpanded ? "w-54" : "w-16"
            }`}
          >
            <AppSidebar
              setHovered={setHovered}
              isPinned={isPinned}
              setIsPinned={setIsPinned}
            />
          </aside>
          <div className="bg-[#F6F6F6] flex h-screen min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden p-4">
            <main className="scrollbar-hide w-full flex flex-col flex-1 overflow-x-hidden overflow-y-auto rounded-4xl">
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
