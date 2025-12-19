"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Laptop } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSidebar } from "@/components/ui/sidebar";

const ICON_SIZE = 16;

export const SidebarThemeSwitcher = () => {
  const { open, isMobile } = useSidebar();
  const renderAsOpen = open || isMobile;

  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Show skeleton while loading
    return renderAsOpen ? (
      <Button variant="ghost" className="w-full justify-center gap-2" disabled>
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-12" />
      </Button>
    ) : (
      <Button variant="ghost" size="sm" className="p-2" disabled>
        <Skeleton className="h-4 w-4 rounded" />
        <span className="sr-only">Loading theme</span>
      </Button>
    );
  }

  const renderIcon = () => {
    if (theme === "light") return <Sun size={ICON_SIZE} />;
    if (theme === "dark") return <Moon size={ICON_SIZE} />;
    return <Laptop size={ICON_SIZE} />;
  };

  const renderLabel = () => {
    if (theme === "light") return "Light";
    if (theme === "dark") return "Dark";
    return "System";
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {renderAsOpen ? (
          <Button variant="ghost" className="w-full justify-center gap-2">
            {renderIcon()}
            <span>{renderLabel()}</span>
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className="p-2" title="Theme">
            {renderIcon()}
            <span className="sr-only">Change theme</span>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-content" align="center">
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem
            value="light"
            className="flex gap-2 items-center"
          >
            <Sun size={ICON_SIZE} /> <span>Light</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="dark"
            className="flex gap-2 items-center"
          >
            <Moon size={ICON_SIZE} /> <span>Dark</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            value="system"
            className="flex gap-2 items-center"
          >
            <Laptop size={ICON_SIZE} /> <span>System</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
