import { supabase } from './supabaseClient';
import type { UserProfile } from '../types';
import { dbRowToProfile } from '../types';

export const authService = {
  async signUp(email: string, password: string, profileData: Partial<UserProfile>) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error('ユーザー作成に失敗しました');

    // Create profile row
    const { error: profileError } = await supabase.from('profiles').insert({
      id: data.user.id,
      name: profileData.name || '',
      age: profileData.age || 25,
      gender: profileData.gender || 'Male',
      occupation: profileData.occupation || '',
      income: profileData.income || '',
      education: profileData.education || '',
      location: profileData.location || '',
      height: profileData.height || 170,
      body_type: profileData.bodyType || '',
      bio: profileData.bio || '',
      image_urls: profileData.imageUrls || ['https://picsum.photos/seed/default/400/400'],
      tags: profileData.tags || [],
      is_verified: false,
      status: 'Pending',
      subscription: 'Free',
    });
    if (profileError) throw profileError;

    return data;
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  },

  async getMyProfile(): Promise<UserProfile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error || !data) return null;
    return dbRowToProfile(data);
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  },
};
