
import React, { useState } from 'react';
import { UserProfile } from '../types.ts';
import { Icons } from './Icons.tsx';

interface ProfileCardProps {
  profile: UserProfile;
  onClick: () => void;
  onLike?: () => void;
}

const ProfileCard: React.FC<ProfileCardProps> = ({ profile, onClick, onLike }) => {
  const [imgError, setImgError] = useState(false);

  return (
    <div 
      className="group relative w-full h-full rounded-2xl overflow-hidden cursor-pointer shadow-2xl border border-white/5 hover:border-gold-500/30 transition-all duration-500"
      onClick={onClick}
    >
      {/* Image Layer */}
      <div className="absolute inset-0 bg-gray-900">
        <img 
          src={imgError ? 'https://picsum.photos/400/600' : profile.imageUrls[0]} 
          alt={profile.name} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          onError={() => setImgError(true)}
        />
        {/* Dark to Transparent Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-95" />
      </div>

      {/* Labels for Status (Verification) */}
      {profile.isVerified && (
        <div className="absolute top-4 left-4 bg-gold-400/10 backdrop-blur-md border border-gold-400/30 px-3 py-1 rounded-full flex items-center gap-1.5 z-20">
          <Icons.Verify className="w-3.5 h-3.5 text-gold-400 fill-gold-400/20" />
          <span className="text-[9px] text-gold-100 uppercase font-black tracking-widest">Identity Verified</span>
        </div>
      )}

      {/* Content Layer */}
      <div className="absolute bottom-0 left-0 w-full p-6 text-white z-10 space-y-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h3 className="text-3xl font-serif font-bold text-white tracking-wide">{profile.name}</h3>
            <span className="text-2xl font-light text-gray-300">{profile.age}</span>
          </div>
          
          <div className="flex items-center gap-2 text-gold-300">
            <Icons.Job className="w-4 h-4" />
            <span className="text-sm font-medium tracking-wide">{profile.occupation}</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 text-xs font-medium text-gray-400 border-t border-white/5 pt-3">
          <div className="flex items-center gap-2">
            <Icons.Location className="w-3.5 h-3.5 text-gray-500" />
            <span>{profile.location}</span>
          </div>
           <div className="flex items-center gap-2">
            <Icons.Money className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-gold-200/90 font-bold uppercase tracking-wider">{profile.income}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {profile.tags.slice(0, 3).map(tag => (
            <span key={tag} className="px-2 py-1 text-[9px] uppercase tracking-widest bg-white/5 backdrop-blur-sm border border-white/10 rounded-sm text-gold-100/70">
              #{tag}
            </span>
          ))}
        </div>
      </div>

      {/* Mobile hint */}
      <div className="absolute top-1/2 left-0 w-full text-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="text-[10px] text-white/30 uppercase tracking-[0.5em] font-bold">
           View Full Profile
        </div>
      </div>
    </div>
  );
};

export default ProfileCard;
