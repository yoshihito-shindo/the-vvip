
import React, { useEffect } from 'react';
import { UserProfile, LikeReceived } from '../types';
import { Icons } from '../components/Icons';

interface LikesReceivedProps {
  likes: LikeReceived[];
  setLikes: React.Dispatch<React.SetStateAction<LikeReceived[]>>;
  onOpenProfile: (profile: UserProfile) => void;
}

const LikesReceived: React.FC<LikesReceivedProps> = ({ likes, setLikes, onOpenProfile }) => {
  useEffect(() => {
    // 画面を開いたら「新着」フラグを落とす
    if (likes.some(l => l.isNew)) {
      setLikes(prev => prev.map(l => ({ ...l, isNew: false })));
    }
  }, []);

  const formatTimestamp = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}分前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}時間前`;
    return `${Math.floor(hours / 24)}日前`;
  };

  return (
    <div className="min-h-screen p-6 pb-32 md:pl-32 max-w-4xl mx-auto animate-fade-in relative">
      <header className="mb-10">
        <h1 className="text-4xl font-serif text-gold-100 mb-2">届いたいいね</h1>
        <p className="text-gray-500 text-[10px] uppercase tracking-[0.4em] font-bold">People Who Liked You</p>
      </header>

      <div className="space-y-4">
        {likes.length === 0 ? (
          <div className="py-32 text-center text-gray-700 space-y-4">
            <Icons.Heart className="w-16 h-16 mx-auto opacity-20" />
            <p className="font-serif text-xl text-gray-500">まだ「いいね」はありません</p>
          </div>
        ) : (
          likes.sort((a, b) => b.timestamp - a.timestamp).map(like => (
            <div 
              key={like.id} 
              onClick={() => onOpenProfile(like.user)}
              className="group relative bg-gradient-to-r from-luxe-panel/60 to-transparent border border-white/5 rounded-[1.5rem] p-5 flex items-center gap-5 cursor-pointer hover:border-gold-500/40 transition-all hover:bg-luxe-panel active:scale-[0.98] overflow-hidden shadow-xl"
            >
              <div className="relative flex-shrink-0">
                <img 
                  src={like.user.imageUrls[0]} 
                  className="w-20 h-20 rounded-2xl object-cover border border-gold-600/20 group-hover:border-gold-500 transition-colors shadow-lg" 
                  alt={like.user.name}
                />
                {like.isNew && (
                  <span className="absolute -top-1 -right-1 bg-gold-500 text-[8px] text-black font-black px-2 py-0.5 rounded-full uppercase shadow-lg animate-pulse">New</span>
                )}
              </div>

              <div className="flex-1 min-w-0 z-10">
                <div className="flex justify-between items-start mb-1">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-xl text-gray-100">{like.user.name}</h4>
                      <span className="text-lg font-light text-gray-400">{like.user.age}</span>
                    </div>
                    <p className="text-xs text-gold-400 uppercase tracking-widest font-black mt-0.5">{like.user.occupation}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-[10px] text-gray-500 font-mono tracking-tighter uppercase bg-black/40 px-2 py-1 rounded-md">{formatTimestamp(like.timestamp)}</span>
                    <div className="bg-gold-500/10 p-2 rounded-full">
                       <Icons.Heart className="w-4 h-4 text-gold-500 fill-gold-500/20" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default LikesReceived;
