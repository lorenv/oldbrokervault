import { useQuery } from "@tanstack/react-query";

interface NotificationsResponse {
  notifications: any[];
  unreadCount: number;
}

export function useUnreadNotifications() {
  const { data } = useQuery<NotificationsResponse>({
    queryKey: ["/api/crm/notifications"],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  return {
    unreadCount: data?.unreadCount || 0,
  };
}
