
import React, { useState } from 'react';
import { UserProfile } from '../types';
import { Icons } from '../components/Icons';
import { useNavigate } from 'react-router-dom';
import { MASTER_DATA } from '../services/geminiService';
import { profileService } from '../services/profileService';

interface EditProfileProps {
  user: UserProfile;
  onSave: (updatedUser: UserProfile) => void;
}

const EditProfile: React.FC<EditProfileProps> = ({ user, onSave }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<UserProfile>(user);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await profileService.updateMyProfile(formData);
      onSave(updated);
      navigate('/profile');
    } catch (err) {
      console.error('Failed to save profile:', err);
      // Fallback: save locally anyway
      onSave(formData);
      navigate('/profile');
    } finally {
      setSaving(false);
    }
  };

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <div className="flex items-center gap-2 mb-4 mt-8">
      <div className="w-1 h-4 bg-gold-500"></div>
      <label className="text-[10px] uppercase tracking-[0.3em] font-black text-gold-400">
        {children}
      </label>
    </div>
  );

  return (
    <div className="min-h-screen bg-luxe-black p-6 md:pl-32 max-w-2xl mx-auto pb-32">
      <header className="flex items-center justify-between mb-10 pt-10 border-b border-white/5 pb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 text-gray-500 hover:text-white transition-colors bg-white/5 rounded-full">
            <Icons.Back className="w-5 h-5" />
          </button>
          <h1 className="text-3xl font-serif text-gold-100">プロフィール編集</h1>
        </div>
        <div className="text-[9px] text-gold-500 font-bold uppercase tracking-widest border border-gold-500/30 px-3 py-1 rounded-full">
          審査ランク: {formData.status}
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6 animate-fade-in">
        {/* Profile Images Simulation */}
        <SectionLabel>メイン写真</SectionLabel>
        <div className="grid grid-cols-3 gap-4">
          {formData.imageUrls.map((url, i) => (
            <div key={i} className="relative aspect-[3/4] rounded-xl overflow-hidden border border-white/10 group cursor-pointer">
              <img src={url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Icons.Plus className="w-6 h-6 text-white" />
              </div>
            </div>
          ))}
          <div className="aspect-[3/4] rounded-xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center text-gray-600 hover:border-gold-500/50 hover:text-gold-500 transition-all cursor-pointer">
            <Icons.Plus className="w-8 h-8 mb-2" />
            <span className="text-[8px] font-bold uppercase">追加</span>
          </div>
        </div>

        {/* Basic Info */}
        <SectionLabel>基本ステータス</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">お名前</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full bg-luxe-panel/50 border border-white/5 rounded-xl p-4 text-white text-sm outline-none focus:border-gold-500/50 transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">電話番号</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              placeholder="090-1234-5678"
              className="w-full bg-luxe-panel/50 border border-white/5 rounded-xl p-4 text-white text-sm outline-none focus:border-gold-500/50 transition-all"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">年齢</label>
            <input
              type="number"
              value={formData.age}
              onChange={(e) => setFormData({...formData, age: parseInt(e.target.value) || 0})}
              className="w-full bg-luxe-panel/50 border border-white/5 rounded-xl p-4 text-white text-sm outline-none focus:border-gold-500/50 transition-all"
            />
          </div>
        </div>

        {/* Luxury Selects */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">職業</label>
            <select
              value={formData.occupation}
              onChange={(e) => setFormData({...formData, occupation: e.target.value})}
              className="w-full bg-luxe-panel border border-white/5 rounded-xl p-4 text-white text-sm outline-none focus:border-gold-500/50 transition-all appearance-none"
            >
              {MASTER_DATA.occupations.map(occ => <option key={occ} value={occ} className="bg-luxe-charcoal">{occ}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">年収 (審査対象)</label>
            <select
              value={formData.income}
              onChange={(e) => setFormData({...formData, income: e.target.value})}
              className="w-full bg-luxe-panel border border-white/5 rounded-xl p-4 text-white text-sm outline-none focus:border-gold-500/50 transition-all appearance-none"
            >
              {MASTER_DATA.incomes.map(inc => <option key={inc} value={inc} className="bg-luxe-charcoal">{inc}</option>)}
            </select>
          </div>
        </div>

        <SectionLabel>自己紹介</SectionLabel>
        <textarea
          value={formData.bio}
          onChange={(e) => setFormData({...formData, bio: e.target.value})}
          className="w-full bg-luxe-panel/50 border border-white/5 rounded-2xl p-6 text-white text-sm outline-none focus:border-gold-500/50 transition-all h-40 resize-none font-light leading-relaxed"
          placeholder="ライフスタイルや価値観を詳しくお書きください..."
        />

        <div className="pt-10">
          <button
            type="submit"
            disabled={saving}
            className="w-full py-5 bg-gradient-to-r from-gold-600 via-gold-400 to-gold-600 text-black font-black uppercase tracking-[0.3em] rounded-full shadow-2xl shadow-gold-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {saving ? '保存中...' : '変更を保存する'}
          </button>
          <p className="text-center text-[9px] text-gray-600 mt-4 uppercase tracking-widest">
            保存後、再審査が行われる場合があります
          </p>
        </div>
      </form>
    </div>
  );
};

export default EditProfile;
