// Auth layout that allows both authenticated and unauthenticated users
// This layout is used for authentication pages that may need to serve both user types
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
