import { supabase } from "@/lib/supabase";

const DEBOUNCE_MS = 300;

export function subscribeToTables(channelName: string, tables: string[], onChange: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const notify = () => {
    clearTimeout(timer);
    timer = setTimeout(onChange, DEBOUNCE_MS);
  };
  const channel = supabase.channel(channelName);
  for (const table of tables) {
    channel.on("postgres_changes", { event: "*", schema: "public", table }, notify);
  }
  channel.subscribe();
  return () => {
    clearTimeout(timer);
    supabase.removeChannel(channel);
  };
}
