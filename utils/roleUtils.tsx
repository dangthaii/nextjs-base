import { User } from "@/hooks/useAuth";

/**
 * Check if a user has admin role
 * @param user - The user object
 * @returns boolean indicating if user is admin
 */
export function isAdmin(user: User | null | undefined): boolean {
  return user?.role === "admin";
}

/**
 * Check if a user has a specific role
 * @param user - The user object
 * @param role - The role to check for
 * @returns boolean indicating if user has the specified role
 */
export function hasRole(user: User | null | undefined, role: string): boolean {
  return user?.role === role;
}

/**
 * Get user role display name
 * @param user - The user object
 * @returns string representation of the user's role
 */
export function getUserRoleDisplay(user: User | null | undefined): string {
  if (!user) return "Guest";
  return user.role === "admin" ? "Admin" : "User";
}

/**
 * Hook for role-based conditional rendering
 * @param user - The user object
 * @param requiredRole - The role required to show content
 * @param children - Content to show if user has required role
 * @param fallback - Content to show if user doesn't have required role
 */
export function RoleGuard({
  user,
  requiredRole,
  children,
  fallback = null,
}: {
  user: User | null | undefined;
  requiredRole: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  if (hasRole(user, requiredRole)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

/**
 * Admin-only content wrapper
 */
export function AdminOnly({
  user,
  children,
  fallback = null,
}: {
  user: User | null | undefined;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return (
    <RoleGuard user={user} requiredRole="admin" fallback={fallback}>
      {children}
    </RoleGuard>
  );
}
