
import React, { useEffect } from 'react';
import { UserProfile, Footprint } from '../types';
import { Icons } from '../components/Icons';

interface FootprintsProps {
  footprints: Footprint[];
  setFootprints: React.Dispatch<React.SetStateAction<Footprint[]>>;
  meProfile: UserProfile;
  matches: UserProfile[];
  setMatches: React.Dispatch<React.SetStateAction<UserProfile[]>>;
  onOpenProfile: (profile: UserProfile) => void;
}

const Footprints: React.FC<FootprintsProps> = ({ footprints, setFootprints, onOpenProfile }) => {
  useEffect(() => {
    if (footprints.some(f => f.isNew)) {
      setFootprints(prev => prev.map(f => ({ ...f, isNew: false })));
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
        <h1 className="text-4xl font-serif text-gold-100 mb-2">足跡</h1>
        <p className="text-gray-500 text-[10px] uppercase tracking-[0.4em] font-bold">People Who Viewed You</p>
      </header>

      <div className="space-y-4">
        {footprints.length === 0 ? (
          <div className="py-32 text-center text-gray-700 space-y-4">
            <Icons.Footprints className="w-16 h-16 mx-auto opacity-20" />
            <p className="font-serif text-xl text-gray-500">まだ足跡はありません</p>
          </div>
        ) : (
          footprints.sort((a, b) => b.timestamp - a.timestamp).map(fp => (
            <div 
              key={fp.id} 
              onClick={() => onOpenProfile(fp.visitor)}
              className="group relative bg-luxe-panel/40 border border-white/5 rounded-[1.5rem] p-5 flex items-center gap-5 cursor-pointer hover:border-gold-500/40 transition-all hover:bg-luxe-panel active:scale-[0.98] overflow-hidden shadow-xl"
            >
              <div className="relative flex-shrink-0">
                <img 
                  src={fp.visitor.imageUrls[0]} 
                  className="w-20 h-20 rounded-2xl object-cover border border-gold-600/20 group-hover:border-gold-500 transition-colors shadow-lg" 
                  alt={fp.visitor.name}
                />
                {fp.isNew && (
                  <span className="absolute -top-1 -right-1 bg-gold-500 text-[8px] text-black font-black px-2 py-0.5 rounded-full uppercase shadow-lg animate-pulse">New</span>
                )}
              </div>

              <div className="flex-1 min-w-0 z-10">
                <div className="flex justify-between items-start mb-1">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-xl text-gray-100">{fp.visitor.name}</h4>
                      <span className="text-lg font-light text-gray-400">{fp.visitor.age}</span>
                    </div>
                    <p className="text-xs text-gold-400 uppercase tracking-widest font-black mt-0.5">{fp.visitor.occupation}</p>
                  </div>
                  <span className="text-[10px] text-gray-500 font-mono tracking-tighter uppercase bg-black/40 px-2 py-1 rounded-md">{formatTimestamp(fp.timestamp)}</span>
                </div>
              </div>
              <div className="ml-2">
                <Icons.Back className="w-5 h-5 text-gray-700 group-hover:text-gold-500 rotate-180 transition-colors" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default Footprints;
