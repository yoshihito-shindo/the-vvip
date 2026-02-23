import { supabase } from './supabaseClient';
import { Message } from '../types';

export const messageService = {
  async getMessages(matchId: string): Promise<Message[]> {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('match_id', matchId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data || []).map(row => ({
      id: row.id,
      senderId: row.sender_id,
      text: row.text,
      timestamp: new Date(row.created_at).getTime(),
      isRead: row.is_read,
    }));
  },

  async sendMessage(matchId: string, senderId: string, text: string): Promise<Message> {
    const { data, error } = await supabase
      .from('messages')
      .insert({ match_id: matchId, sender_id: senderId, text })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      senderId: data.sender_id,
      text: data.text,
      timestamp: new Date(data.created_at).getTime(),
      isRead: data.is_read,
    };
  },

  async markAsRead(matchId: string, readerId: string): Promise<void> {
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('match_id', matchId)
      .neq('sender_id', readerId)
      .eq('is_read', false);
  },

  subscribeToMessages(matchId: string, onMessage: (msg: Message) => void) {
    const channel = supabase
      .channel(`messages:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const row = payload.new;
          onMessage({
            id: row.id,
            senderId: row.sender_id,
            text: row.text,
            timestamp: new Date(row.created_at).getTime(),
            isRead: row.is_read,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },

  async getLastMessage(matchId: string): Promise<{ text: string; timestamp: number } | null> {
    const { data } = await supabase
      .from('messages')
      .select('text, created_at')
      .eq('match_id', matchId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return null;
    return { text: data.text, timestamp: new Date(data.created_at).getTime() };
  },
};
