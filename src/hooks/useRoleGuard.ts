import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, AppRole } from "./useAuth";

export function useRoleGuard(allowedRoles: AppRole | AppRole[]) {
  const { profile, loading, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      navigate("/auth/login");
      return;
    }

    if (!profile) return;

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    
    if (!roles.includes(profile.role)) {
      navigate("/marketplace");
    }
  }, [profile, loading, user, allowedRoles, navigate]);

  return { profile, loading, isAuthorized: profile ? (Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]).includes(profile.role) : false };
}
