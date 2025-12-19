import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

/**
 * Get the current authenticated user and their role
 * Note: Demo mode - no users table yet, using Supabase auth only
 * @returns Promise<{user: User, isAdmin: boolean} | null>
 */
export async function getCurrentUserWithRole(): Promise<{
  user: User;
  isAdmin: boolean;
} | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return null;
    }

    // Demo mode: All users are non-admin
    // TODO: Add users table and role checking in Phase 4+
    return {
      user: authUser,
      isAdmin: false,
    };
  } catch (error) {
    console.error("Error getting current user with role:", error);
    return null;
  }
}

/**
 * Get current user ID - optimized for performance
 * Use when you only need user identification
 * @returns Promise<string | null> - Returns the user ID or null if not authenticated
 */
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    return user.id;
  } catch (error) {
    console.error("Error in getCurrentUserId:", error);
    return null;
  }
}

/**
 * Require user ID - optimized for most common use case
 * Use this for most common authentication use case - getting the user ID
 * @returns Promise<string> - Returns the user ID
 */
export async function requireUserId(): Promise<string> {
  const userId = await getCurrentUserId();
  
  if (!userId) {
    redirect("/auth/login");
  }

  return userId;
}

/**
 * Require admin access - optimized version of requireAdmin
 * Checks admin status efficiently without redundant database calls
 * @returns Promise<void> - Throws or redirects if not authorized
 */
export async function requireAdminAccess(): Promise<void> {
  const userWithRole = await getCurrentUserWithRole();

  if (!userWithRole) {
    console.warn("Admin access attempted without authentication");
    redirect("/auth/login");
  }

  if (!userWithRole.isAdmin) {
    console.warn(
      `Non-admin user ${userWithRole.user.id} attempted admin access`
    );
    redirect("/unauthorized");
  }
}
