import { ReactNode } from "react";
import { useOutbidNotifications } from "@/hooks/useOutbidNotifications";

interface OutbidNotificationProviderProps {
  children: ReactNode;
}

export function OutbidNotificationProvider({ children }: OutbidNotificationProviderProps) {
  // This hook subscribes to outbid notifications globally
  useOutbidNotifications();
  
  return <>{children}</>;
}
