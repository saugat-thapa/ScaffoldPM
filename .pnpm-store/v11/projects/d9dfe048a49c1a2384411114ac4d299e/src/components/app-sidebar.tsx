"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderKanban, PlusCircle, Pin, PinOff } from "lucide-react";
import { Icon } from "@iconify/react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export function AppSidebar({
  isPinned,
  setIsPinned,
  setHovered,
}: {
  isPinned: boolean;
  setIsPinned: (value: boolean) => void;
  setHovered: (value: boolean) => void;
}){
  const currentUrl = usePathname();
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);

  const isExpanded = isPinned || isSidebarHovered;

    useEffect(() => {
    setHovered(isExpanded);
  }, [isExpanded, setHovered]);

  const sidebarGroups = [
    {
      title: "Main",
      items: [
        {
          title: "Home",
          url: "/",
          icon: "lucide:home",
        },
        {
          title: "Dashboard",
          url: "/projects",
          icon: "lucide:layout-dashboard",
        },
      ],
    },
    {
      title: "Projects",
      items: [
        {
          title: "Generate Plan",
          url: "/projects/new",
          icon: "lucide:plus-circle",
        },
      ],
    },
  ];

  const isActiveRoute = (url: string) => {
    if (url === "/") return currentUrl === "/";
    return currentUrl === url || currentUrl.startsWith(`${url}/`);
  };

  return (
    <Sidebar
      className={cn(
        "border-r border-slate-200 bg-slate-50 transition-all duration-300 ease-in-out z-50 shadow-sm",
        !isExpanded ? "w-16" : "w-60"
      )}
      style={{
        "--sidebar-width": isExpanded ? "15rem" : "4rem",
      } as React.CSSProperties}
      onMouseEnter={() => setIsSidebarHovered(true)}
      onMouseLeave={() => setIsSidebarHovered(false)}
    >
      <SidebarHeader
        className={cn(
          "flex h-16 flex-col justify-center bg-transparent transition-all duration-300",
          isExpanded ? "p-4" : "p-4 items-center"
        )}
      >
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-3">
            <img src="/logo.png" className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg text-white font-bold"/>
            {isExpanded && (
              <p className="truncate text-xl font-bold tracking-tight text-primary">ScaffoldPM</p>
            )}
          </div>
          {isExpanded && (
            <button
              onClick={() => setIsPinned(!isPinned)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-slate-200 hover:text-slate-900"
              title={isPinned ? "Unpin sidebar" : "Pin sidebar"}
            >
              {isPinned ? <Pin size={16} /> : <PinOff size={16} />}
            </button>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent
        className={cn(
          "bg-transparent transition-all duration-300",
          isExpanded ? "px-3" : "px-2"
        )}
      >
        <SidebarMenu>
          {sidebarGroups.map((group, idx) => (
            <SidebarGroup key={idx} className="mb-4 p-0">
              {group.title && isExpanded && (
                <p className="mb-2 px-4 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                  {group.title}
                </p>
              )}
              <SidebarGroupContent>
                <ul className="space-y-1">
                  {group.items.map((item) => {
                    const isActive = isActiveRoute(item.url);
                    return (
                      <SidebarMenuItem key={item.title}>
                        <Link
                          href={item.url}
                          className={cn(
                            "relative flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-all",
                            isActive
                              ? "bg-primary-muted  text-white shadow-md"
                              : "text-slate-500 hover:bg-slate-200 hover:text-slate-900",
                            !isExpanded && "justify-center px-0"
                          )}
                        >
                          <Icon icon={item.icon} width="20" height="20" />
                          {isExpanded && <span>{item.title}</span>}
                        </Link>
                      </SidebarMenuItem>
                    );
                  })}
                </ul>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
