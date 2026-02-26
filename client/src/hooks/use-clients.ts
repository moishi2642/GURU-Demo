import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type InsertClient, type ClientDashboardResponse, type Client, type Strategy } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useClients() {
  return useQuery<Client[]>({
    queryKey: [api.clients.list.path],
    queryFn: async () => {
      const res = await fetch(api.clients.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch clients");
      return api.clients.list.responses[200].parse(await res.json());
    },
  });
}

export function useClientDashboard(id: number) {
  return useQuery<ClientDashboardResponse>({
    queryKey: [api.clients.dashboard.path, id],
    queryFn: async () => {
      const url = buildUrl(api.clients.dashboard.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) throw new Error("Client not found");
      if (!res.ok) throw new Error("Failed to fetch client dashboard");
      // Coerce response appropriately or rely on JSON
      const data = await res.json();
      return api.clients.dashboard.responses[200].parse(data) as ClientDashboardResponse;
    },
    enabled: !!id && !isNaN(id),
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertClient) => {
      const res = await fetch(api.clients.create.path, {
        method: api.clients.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create client");
      return api.clients.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.clients.list.path] });
      toast({ title: "Success", description: "Client profile created." });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  });
}

export function useGenerateStrategy(clientId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const url = buildUrl(api.clients.generateStrategy.path, { id: clientId });
      const res = await fetch(url, {
        method: api.clients.generateStrategy.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to generate AI strategy");
      return api.clients.generateStrategy.responses[200].parse(await res.json()) as Strategy[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.clients.dashboard.path, clientId] });
      toast({ 
        title: "Strategy Generated", 
        description: "AI has successfully synthesized a new balance sheet strategy." 
      });
    },
    onError: (error) => {
      toast({ title: "Generation Failed", description: error.message, variant: "destructive" });
    }
  });
}
