import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { type InsertAsset, type InsertLiability, type InsertCashFlow } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useCreateAsset(clientId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertAsset) => {
      const res = await fetch(api.assets.create.path, {
        method: api.assets.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to add asset");
      return api.assets.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.clients.dashboard.path, clientId] });
      toast({ title: "Asset Added", description: "The balance sheet has been updated." });
    },
  });
}

export function useCreateLiability(clientId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertLiability) => {
      const res = await fetch(api.liabilities.create.path, {
        method: api.liabilities.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to add liability");
      return api.liabilities.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.clients.dashboard.path, clientId] });
      toast({ title: "Liability Added", description: "The balance sheet has been updated." });
    },
  });
}

export function useCreateCashFlow(clientId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertCashFlow) => {
      const res = await fetch(api.cashFlows.create.path, {
        method: api.cashFlows.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to add cash flow");
      return api.cashFlows.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.clients.dashboard.path, clientId] });
      toast({ title: "Cash Flow Logged", description: "Forecasting models have been updated." });
    },
  });
}
