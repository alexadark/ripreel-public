"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import {
  Clock,
  User,
  LogIn,
  Menu,
  ChevronLeft,
  PanelLeftIcon,
  LogOut,
  MessageCirclePlus,
  Database,
  BarChart3,
} from "lucide-react";
import Logo from "@/components/Logo";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { SidebarThemeSwitcher } from "@/components/SidebarThemeSwitcher";
import { logoutAction } from "@/app/actions/auth";
import { toast } from "sonner";

export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { open, isMobile, toggleSidebar } = useSidebar();
  const { id: userId, role: userRole } = useUser();

  // Build navigation items based on user role
  const userNavItems = [
    { href: "/chat", label: "Chat", icon: MessageCirclePlus },
    { href: "/history", label: "History", icon: Clock },
    { href: "/profile", label: "Profile", icon: User },
  ];

  const adminNavItems = [
    { href: "/admin/dashboard", label: "Admin Dashboard", icon: BarChart3 },
    { href: "/admin/models", label: "AI Models", icon: Database },
  ];

  const renderContentAsOpen = open || isMobile;

  const handleLogout = async (): Promise<void> => {
    try {
      const result = await logoutAction();
      if (result.success) {
        router.push("/");
      } else {
        toast.error(result.error || "Failed to logout");
      }
    } catch {
      toast.error("Failed to logout");
    }
  };

  const handleNavClick = () => {
    // On mobile, collapse the sidebar when a nav item is clicked
    if (isMobile) {
      toggleSidebar();
    }
  };

  const handleChatClick = (e: React.MouseEvent) => {
    e.preventDefault();
    handleNavClick();

    // Force hard navigation to ensure complete state reset
    // This bypasses React caching and guarantees fresh data
    window.location.href = "/chat";
  };

  const getLinkClasses = (href: string) => {
    let isActive = false;
    
    if (href === "/chat") {
      isActive = pathname.startsWith("/chat");
    } else if (href === "/admin/dashboard") {
      isActive = pathname === "/admin/dashboard";
    } else if (href === "/admin/models") {
      isActive = pathname.startsWith("/admin/models");
    } else {
      isActive = pathname === href;
    }
    
    return cn(
      "flex items-center w-full rounded-md text-base font-medium transition-colors",
      isActive
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-muted",
      renderContentAsOpen ? "px-3 py-2" : "h-9 w-9 justify-center p-0"
    );
  };

  return (
    <Sidebar collapsible="icon" className="border-r bg-sidebar">
      <SidebarHeader
        className={cn(
          "flex items-center gap-2 h-14 border-b",
          renderContentAsOpen
            ? "flex-row justify-between px-4"
            : "justify-center px-2"
        )}
      >
        {/* Only show logo when expanded */}
        {renderContentAsOpen && <Logo className="pl-2"/>}

        {/* Desktop collapse button */}
        {!isMobile && (
          <SidebarTrigger
            aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
            aria-expanded={open}
            className="p-1 rounded-md hover:bg-muted transition-colors"
          >
            {open ? (
              <ChevronLeft className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </SidebarTrigger>
        )}

        {/* Mobile close button - only show on mobile when sidebar is open */}
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="p-1 h-auto w-auto"
            onClick={() => toggleSidebar()}
          >
            <PanelLeftIcon className="h-6 w-6" />
            <span className="sr-only">Close sidebar</span>
          </Button>
        )}
      </SidebarHeader>
      <SidebarContent className="flex-grow p-2 flex flex-col">
        {/* User Navigation */}
        <SidebarGroup>
          <SidebarMenu className="space-y-1">
            {userNavItems.map((item) => (
              <SidebarMenuItem
                key={item.href}
                className={cn(
                  "flex justify-center",
                  renderContentAsOpen && "px-2"
                )}
              >
                <Link
                  href={item.href}
                  className={getLinkClasses(item.href)}
                  onClick={
                    item.href === "/chat" ? handleChatClick : handleNavClick
                  }
                >
                  <item.icon
                    className={cn(
                      renderContentAsOpen ? "h-6 w-6 mr-3" : "h-5 w-5"
                    )}
                  />
                  {renderContentAsOpen && <span>{item.label}</span>}
                </Link>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>

        {/* Admin Navigation - only shown for admins */}
        {userRole === "admin" && (
          <>
            {renderContentAsOpen && (
              <div className="px-4 py-2">
                <div className="border-t dark:border-muted" />
              </div>
            )}
            <SidebarGroup>
              <SidebarMenu className="space-y-1">
                {adminNavItems.map((item) => (
                  <SidebarMenuItem
                    key={item.href}
                    className={cn(
                      "flex justify-center",
                      renderContentAsOpen && "px-2"
                    )}
                  >
                    <Link
                      href={item.href}
                      className={getLinkClasses(item.href)}
                      onClick={handleNavClick}
                    >
                      <item.icon
                        className={cn(
                          renderContentAsOpen ? "h-6 w-6 mr-3" : "h-5 w-5"
                        )}
                      />
                      {renderContentAsOpen && <span>{item.label}</span>}
                    </Link>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </>
        )}

        {/* Spacer to push footer to bottom */}
        <div className="flex-grow" />
      </SidebarContent>
      <SidebarFooter className="py-4 border-t flex flex-col space-y-2">
        {/* Theme switcher */}
        <div
          className={cn(
            "flex w-full",
            renderContentAsOpen ? "justify-start px-3" : "justify-center"
          )}
        >
          <SidebarThemeSwitcher />
        </div>

        {/* Logout/Login */}
        {userId ? (
          renderContentAsOpen ? (
            <LogoutButton />
          ) : (
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleLogout}
              >
                <LogOut className="h-5 w-5" />
                <span className="sr-only">Logout</span>
              </Button>
            </div>
          )
        ) : (
          <Link href="/auth/login" className="w-full">
            <Button
              variant="ghost"
              className={cn(
                "flex items-center",
                renderContentAsOpen
                  ? "w-full justify-start px-3"
                  : "h-8 w-8 justify-center"
              )}
            >
              <LogIn
                className={cn(renderContentAsOpen ? "h-5 w-5 mr-3" : "h-5 w-5")}
              />
              {renderContentAsOpen && "Login"}
              {!renderContentAsOpen && <span className="sr-only">Login</span>}
            </Button>
          </Link>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
