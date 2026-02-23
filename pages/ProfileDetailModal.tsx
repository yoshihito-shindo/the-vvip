
import React, { useEffect, useRef } from 'react';
import { UserProfile } from '../types';
import { Icons } from '../components/Icons';
import { footprintService } from '../services/footprintService';

interface ModalProps {
  profile: UserProfile | null;
  isMatched?: boolean;
  onClose: () => void;
  onLike: () => void;
  onReject?: () => void;
  myUserId?: string;
}

const ProfileDetailModal: React.FC<ModalProps> = ({ profile, isMatched = false, onClose, onLike, onReject, myUserId }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (profile) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      if (scrollRef.current) scrollRef.current.scrollTop = 0;

      // Record footprint
      if (myUserId && profile.id !== myUserId) {
        footprintService.recordFootprint(myUserId, profile.id).catch(() => {});
      }

      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [profile]);

  if (!profile) return null;

  return (
    <div className="fixed inset-0 z-[9999999] bg-black flex flex-col h-[100dvh] w-screen overflow-hidden overscroll-none animate-fade-in select-none">
      <button
        onClick={onClose}
        className="fixed top-6 right-6 z-[10000000] p-4 bg-black/40 backdrop-blur-3xl rounded-full text-white shadow-2xl border border-white/10 active:scale-90"
      >
        <Icons.Reject className="w-8 h-8" />
      </button>

      <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-smooth bg-black overscroll-contain">
        <div className={`flex flex-col md:flex-row min-h-full ${isMatched ? 'pb-[100px]' : 'pb-[200px]'}`}>
          <div className="w-full md:w-1/2 h-[75vh] md:h-screen relative flex-shrink-0">
            <img src={profile.imageUrls[0]} alt={profile.name} className="w-full h-full object-cover align-top" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent md:hidden" />
          </div>

          <div className="w-full md:w-1/2 p-6 md:p-16 bg-black">
            <div className="flex justify-between items-start mb-12">
              <div className="space-y-3">
                <h2 className="text-5xl font-serif font-bold text-white flex items-center gap-4">
                  {profile.name}
                  {profile.isVerified && <Icons.Verify className="w-8 h-8 text-gold-400" />}
                  {isMatched && <span className="text-xs bg-gold-500/20 text-gold-400 border border-gold-500/30 px-3 py-1 rounded-full uppercase tracking-tighter font-black">Matched</span>}
                </h2>
                <p className="text-2xl text-gold-200 font-medium tracking-wide">{profile.occupation}</p>
              </div>
              <div className="text-right">
                <span className="block text-5xl font-light text-gray-300 leading-none">{profile.age}</span>
                <span className="text-[10px] uppercase text-gray-500 tracking-[0.3em] font-black mt-2 inline-block">Years Old</span>
              </div>
            </div>

            <div className="space-y-16">
              <div className="bg-luxe-panel/30 p-8 rounded-3xl border border-white/5 shadow-inner">
                <h3 className="text-[10px] uppercase text-gold-500 font-black tracking-[0.3em] mb-6">自己紹介</h3>
                <p className="text-gray-200 font-light leading-relaxed italic text-lg">"{profile.bio}"</p>
              </div>

              <div className="grid grid-cols-2 gap-y-16 gap-x-8">
                <div className="flex flex-col gap-3">
                  <span className="text-[10px] text-gray-600 uppercase font-black tracking-[0.2em]">年収</span>
                  <span className="text-white flex items-center gap-3 font-bold text-xl"><Icons.Money className="w-6 h-6 text-gold-600"/> {profile.income}</span>
                </div>
                <div className="flex flex-col gap-3">
                  <span className="text-[10px] text-gray-600 uppercase font-black tracking-[0.2em]">居住地</span>
                  <span className="text-white flex items-center gap-3 font-medium text-xl"><Icons.Location className="w-6 h-6 text-gold-600"/> {profile.location}</span>
                </div>
                <div className="flex flex-col gap-3">
                  <span className="text-[10px] text-gray-600 uppercase font-black tracking-[0.2em]">学歴</span>
                  <span className="text-white flex items-center gap-3 font-medium text-xl"><Icons.School className="w-6 h-6 text-gold-600"/> {profile.education}</span>
                </div>
                <div className="flex flex-col gap-3">
                  <span className="text-[10px] text-gray-600 uppercase font-black tracking-[0.2em]">身長</span>
                  <span className="text-white flex items-center gap-3 font-medium text-xl"><Icons.User className="w-6 h-6 text-gold-600"/> {profile.height}cm</span>
                </div>
              </div>

              <div>
                <h3 className="text-[10px] uppercase text-gray-600 font-black tracking-[0.3em] mb-8">ライフスタイル</h3>
                <div className="flex flex-wrap gap-4">
                  {profile.tags.map(tag => (
                    <span key={tag} className="px-6 py-2.5 bg-white/5 border border-white/10 rounded-full text-sm text-gold-100 font-bold tracking-wider">
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!isMatched && (
        <div className="fixed bottom-0 left-0 w-full bg-[#0a0a0a] border-t border-white/5 px-6 pt-5 pb-[calc(env(safe-area-inset-bottom,24px)+15px)] flex gap-5 z-[10000001] shadow-[0_-30px_60px_rgba(0,0,0,1)]">
          <button
            onClick={() => onReject ? onReject() : onClose()}
            className="flex-1 py-5 rounded-2xl border border-white/10 text-gray-500 font-black uppercase tracking-widest text-xs active:scale-95 bg-black/40"
          >
            見送る
          </button>
          <button
            onClick={onLike}
            className="flex-[2.5] py-5 rounded-2xl bg-gradient-to-r from-gold-400 via-gold-500 to-gold-300 text-black font-black uppercase tracking-[0.3em] text-xs shadow-[0_15px_40px_rgba(212,175,55,0.4)] active:scale-95 flex items-center justify-center gap-3"
          >
            <Icons.Heart className="w-6 h-6 fill-black/20" />
            いいね！
          </button>
        </div>
      )}
    </div>
  );
};

export default ProfileDetailModal;
