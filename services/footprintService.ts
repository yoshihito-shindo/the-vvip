import { supabase } from './supabaseClient';
import { Footprint, dbRowToProfile } from '../types';

export const footprintService = {
  async recordFootprint(visitorId: string, visitedId: string): Promise<void> {
    if (visitorId === visitedId) return;
    await supabase
      .from('footprints')
      .insert({ visitor_id: visitorId, visited_id: visitedId });
  },

  async getFootprints(userId: string): Promise<Footprint[]> {
    const { data, error } = await supabase
      .from('footprints')
      .select(`
        id,
        created_at,
        visitor:profiles!footprints_visitor_id_fkey(*)
      `)
      .eq('visited_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    const now = Date.now();
    return (data || []).map(row => ({
      id: row.id,
      visitor: dbRowToProfile(row.visitor),
      timestamp: new Date(row.created_at).getTime(),
      isNew: now - new Date(row.created_at).getTime() < 24 * 60 * 60 * 1000, // last 24h = new
    }));
  },
};
