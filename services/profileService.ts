import { supabase } from './supabaseClient';
import { UserProfile, Gender, dbRowToProfile, profileToDbRow } from '../types';

export const profileService = {
  async getProfiles(options?: { gender?: Gender; excludeIds?: string[]; limit?: number }): Promise<UserProfile[]> {
    let query = supabase
      .from('profiles')
      .select('*')
      .in('status', ['Approved', 'Gold', 'Black']);

    if (options?.gender) {
      query = query.eq('gender', options.gender);
    }
    if (options?.excludeIds && options.excludeIds.length > 0) {
      query = query.not('id', 'in', `(${options.excludeIds.join(',')})`);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(dbRowToProfile);
  },

  async getProfileById(id: string): Promise<UserProfile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return dbRowToProfile(data);
  },

  async updateMyProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const dbUpdates = profileToDbRow(updates);
    const { data, error } = await supabase
      .from('profiles')
      .update(dbUpdates)
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;
    return dbRowToProfile(data);
  },

  async getAllProfiles(): Promise<UserProfile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(dbRowToProfile);
  },

  async updateProfileStatus(id: string, status: string): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      .update({ status })
      .eq('id', id);

    if (error) throw error;
  },

  async approveUser(userId: string): Promise<void> {
    const response = await fetch('/api/admin/approve-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action: 'approve' }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Approval failed');
    if (data.emailSent) {
      console.log('[KYC] Approval email sent successfully');
    } else {
      console.warn('[KYC] Approved but email not sent:', data.reason);
    }
  },

  async rejectUser(userId: string): Promise<void> {
    const response = await fetch('/api/admin/approve-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action: 'reject' }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Rejection failed');
  },

  async getAiProfileCount(): Promise<number> {
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('is_ai_generated', true);

    if (error) throw error;
    return count || 0;
  },
};
