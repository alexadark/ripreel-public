"use client";

import { Button } from "@/components/ui/button";
import { logoutAction } from "@/app/actions/auth";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function LogoutButton() {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      const result = await logoutAction();
      if (result.success) {
        router.push("/");
      } else {
        toast.error(result.error || "Failed to logout");
        setIsLoading(false);
      }
    } catch {
      toast.error("Failed to logout");
      setIsLoading(false);
    }
  };

  return (
    <Button onClick={handleLogout} disabled={isLoading}>
      {isLoading ? "Logging out..." : "Logout"}
    </Button>
  );
}
