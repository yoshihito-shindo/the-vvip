import { supabase } from './supabaseClient';
import { UserProfile, dbRowToProfile } from '../types';

export const matchService = {
  async likeProfile(likerId: string, likedId: string): Promise<{ matched: boolean }> {
    // Record the like
    const { error: likeError } = await supabase
      .from('likes')
      .upsert({ liker_id: likerId, liked_id: likedId }, { onConflict: 'liker_id,liked_id' });
    if (likeError) throw likeError;

    // Record swipe right
    await supabase
      .from('swipe_history')
      .upsert({ swiper_id: likerId, swiped_id: likedId, direction: 'right' }, { onConflict: 'swiper_id,swiped_id' });

    // Check if the other person already liked us (mutual match)
    const { data: mutualLike } = await supabase
      .from('likes')
      .select('id')
      .eq('liker_id', likedId)
      .eq('liked_id', likerId)
      .maybeSingle();

    // For AI profiles, always create a match
    const { data: likedProfile } = await supabase
      .from('profiles')
      .select('is_ai_generated')
      .eq('id', likedId)
      .single();

    const isAi = likedProfile?.is_ai_generated === true;

    if (mutualLike || isAi) {
      // Create match (sort IDs to avoid duplicates)
      const [user1, user2] = [likerId, likedId].sort();
      await supabase
        .from('matches')
        .upsert({ user1_id: user1, user2_id: user2 }, { onConflict: 'user1_id,user2_id' });
      return { matched: true };
    }

    return { matched: false };
  },

  async swipeLeft(swiperId: string, swipedId: string): Promise<void> {
    await supabase
      .from('swipe_history')
      .upsert({ swiper_id: swiperId, swiped_id: swipedId, direction: 'left' }, { onConflict: 'swiper_id,swiped_id' });
  },

  async getMatches(userId: string): Promise<UserProfile[]> {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        id,
        user1_id,
        user2_id,
        user1:profiles!matches_user1_id_fkey(*),
        user2:profiles!matches_user2_id_fkey(*)
      `)
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => {
      const otherProfile = row.user1_id === userId ? row.user2 : row.user1;
      return dbRowToProfile(otherProfile);
    });
  },

  async getMatchId(userId: string, otherUserId: string): Promise<string | null> {
    const [user1, user2] = [userId, otherUserId].sort();
    const { data } = await supabase
      .from('matches')
      .select('id')
      .eq('user1_id', user1)
      .eq('user2_id', user2)
      .maybeSingle();

    return data?.id || null;
  },

  async getReceivedLikes(userId: string): Promise<{ id: string; user: UserProfile; timestamp: number }[]> {
    const { data, error } = await supabase
      .from('likes')
      .select(`
        id,
        created_at,
        liker:profiles!likes_liker_id_fkey(*)
      `)
      .eq('liked_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      user: dbRowToProfile(row.liker),
      timestamp: new Date(row.created_at).getTime(),
    }));
  },

  async getSwipedIds(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('swipe_history')
      .select('swiped_id')
      .eq('swiper_id', userId);

    if (error) throw error;
    return (data || []).map(r => r.swiped_id);
  },
};
