import { useQuery } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";

export function useClientDashboard(clientId: number) {
  const url = buildUrl(api.clients.dashboard.path, { id: clientId });
  
  return useQuery({
    queryKey: [url],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch dashboard data");
      
      const data = await res.json();
      return api.clients.dashboard.responses[200].parse(data);
    },
    enabled: !!clientId && !isNaN(clientId),
  });
}
