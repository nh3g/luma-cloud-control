import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Workspace = {
  id: string;
  owner_id: string;
  name: string;
  demo_mode: boolean;
  onboarding_completed: boolean;
  agent_stopped: boolean;
  profile_color: string;
  profile_avatar: string;
};

async function fetchWorkspace(): Promise<Workspace | null> {
  const { data, error } = await supabase
    .from("workspaces")
    .select(
      "id, owner_id, name, demo_mode, onboarding_completed, agent_stopped, profile_color, profile_avatar",
    )
    .maybeSingle();

  if (error) throw error;
  return data as Workspace | null;
}

export function useWorkspace() {
  return useQuery({ queryKey: ["workspace"], queryFn: fetchWorkspace });
}

export function useSetAgentStopped() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, stopped }: { id: string; stopped: boolean }) => {
      const { error } = await supabase
        .from("workspaces")
        .update({ agent_stopped: stopped })
        .eq("id", id);
      if (error) throw error;
      return stopped;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
  });
}
