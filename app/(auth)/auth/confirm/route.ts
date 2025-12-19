import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Force dynamic rendering since we access cookies
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<void> {
  const { searchParams } = new URL(request.url);

  // Handle Supabase error parameters first (expired/invalid links)
  const error = searchParams.get("error");
  const errorCode = searchParams.get("error_code");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    // Handle specific Supabase errors with helpful messages
    let errorMessage = "Verification failed";

    switch (errorCode) {
      case "otp_expired":
        errorMessage = "Email link has expired. Please request a new one.";
        break;
      case "access_denied":
        errorMessage = "Email link is invalid or has been used already.";
        break;
      default:
        errorMessage = errorDescription || "Email verification failed";
    }

    redirect(`/auth/error?message=${encodeURIComponent(errorMessage)}`);
  }

  // Handle both Supabase auth flows
  const token_hash = searchParams.get("token_hash");
  const token = searchParams.get("token");
  const code = searchParams.get("code");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next");

  const supabase = await createClient();

  // PKCE Flow: Supabase sends 'code' parameter (common for password reset)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Determine redirect destination
      const redirectUrl = getSuccessRedirect(next);
      redirect(redirectUrl);
    }

    // Only redirect to error if there was an actual auth error
    redirect(
      `/auth/error?message=${encodeURIComponent(error.message || "Authentication failed")}`
    );
  }

  // Email OTP Flow: Supabase sends 'token_hash' or 'token' parameter
  const verificationToken = token_hash || token;
  if (verificationToken && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: verificationToken,
    });

    if (!error) {
      // Determine redirect based on verification type and next parameter
      const redirectUrl = getVerificationRedirect(type, next);
      redirect(redirectUrl);
    }

    // Only redirect to error if there was an actual auth error
    redirect(
      `/auth/error?message=${encodeURIComponent(error.message || "Email verification failed")}`
    );
  }

  // No valid parameters found
  redirect("/auth/error?message=Invalid%20verification%20link");
}

// Determine redirect destination for PKCE code exchange
function getSuccessRedirect(customNext?: string | null): string {
  // If custom redirect specified and is a relative path, use it
  if (customNext && customNext.startsWith("/")) {
    return customNext;
  }

  // Default to main application
  return "/chat";
}

// Determine redirect destination after successful email verification
function getVerificationRedirect(
  type: EmailOtpType,
  customNext?: string | null
): string {
  // If custom redirect specified and is a relative path, use it
  if (customNext && customNext.startsWith("/")) {
    return customNext;
  }

  // Default routing based on verification type
  switch (type) {
    case "recovery":
      return "/auth/update-password"; // Password reset → update password form
    case "signup":
      return "/chat"; // Email verification → main app
    default:
      return "/chat"; // Default to main app
  }
}
