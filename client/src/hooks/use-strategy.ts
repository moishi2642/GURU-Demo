import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useGenerateStrategy(clientId: number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const dashboardUrl = buildUrl(api.clients.dashboard.path, { id: clientId });
  const strategyUrl = buildUrl(api.clients.generateStrategy.path, { id: clientId });

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(strategyUrl, {
        method: api.clients.generateStrategy.method,
        credentials: "include",
      });
      
      if (!res.ok) {
        throw new Error("Failed to generate AI strategy");
      }
      
      return api.clients.generateStrategy.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [dashboardUrl] });
      toast({
        title: "Strategy Generated",
        description: "AI has successfully generated a new financial strategy based on the client's profile.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Generation Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });
}
