
import React, { useEffect, useState, useMemo } from 'react';
import { UserProfile, Gender, AccountStatus } from '../types.ts';
import { profileService } from '../services/profileService.ts';
import { matchService } from '../services/matchService.ts';
import { useAuth } from '../contexts/AuthContext.tsx';
import ProfileCard from '../components/ProfileCard.tsx';
import { Icons } from '../components/Icons.tsx';

interface DashboardProps {
  meProfile: UserProfile;
  userGender: Gender;
  onOpenProfile: (profile: UserProfile) => void;
  matches: UserProfile[];
  setMatches: React.Dispatch<React.SetStateAction<UserProfile[]>>;
  onMatch: (profile: UserProfile) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ meProfile, userGender, onOpenProfile, matches, setMatches, onMatch }) => {
  const [candidates, setCandidates] = useState<UserProfile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const targetGender = userGender === Gender.Male ? Gender.Female : Gender.Male;

  useEffect(() => {
    loadProfiles();
  }, [userGender]);

  useEffect(() => {
    const matchedIds = new Set(matches.map(m => m.id));
    setCandidates(prev => {
      const filtered = prev.filter(p => !matchedIds.has(p.id));
      return filtered;
    });
  }, [matches]);

  const loadProfiles = async () => {
    if (loading && candidates.length > 0) return;
    setLoading(true);
    try {
      // Get already swiped IDs
      const swipedIds = await matchService.getSwipedIds(meProfile.id);
      const matchedIds = new Set(matches.map(m => m.id));
      const existingIds = new Set(candidates.map(p => p.id));
      const excludeIds = [...new Set([...swipedIds, ...matchedIds, ...existingIds, meProfile.id])];

      const profiles = await profileService.getProfiles({
        gender: targetGender,
        excludeIds,
        limit: 10,
      });

      const validProfiles = profiles.filter(p =>
        (p.status === AccountStatus.Approved || p.status === AccountStatus.Gold || p.status === AccountStatus.Black)
      );

      setCandidates(prev => [...prev, ...validProfiles]);
    } catch (err) {
      console.error("Failed to load dashboard profiles", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (direction: 'left' | 'right') => {
    if (isAnimating || loading || currentIndex >= candidates.length) return;

    setIsAnimating(true);
    setSwipeDirection(direction);
    const profile = candidates[currentIndex];

    setTimeout(async () => {
      if (direction === 'right') {
        try {
          const result = await matchService.likeProfile(meProfile.id, profile.id);
          if (result.matched) {
            setMatches(prev => {
              if (prev.find(p => p.id === profile.id)) return prev;
              return [profile, ...prev];
            });
            onMatch(profile);
          }
        } catch (err) {
          console.error('Like error:', err);
        }
      } else {
        try {
          await matchService.swipeLeft(meProfile.id, profile.id);
        } catch (err) {
          console.error('Swipe left error:', err);
        }
      }
      setCurrentIndex(prev => prev + 1);
      setSwipeDirection(null);
      setTimeout(() => {
        setIsAnimating(false);
      }, 500);
      if (currentIndex >= candidates.length - 2) {
        loadProfiles();
      }
    }, 450);
  };

  const currentProfile = candidates[currentIndex];

  return (
    <div className="min-h-screen bg-luxe-black flex flex-col md:pl-32 relative overflow-hidden">
      <div className="flex-1 flex flex-col items-center justify-center px-4 pt-10 pb-40">
        <header className="w-full mb-8 text-center animate-fade-in flex flex-col items-center">
          <Icons.Sparkles className="w-6 h-6 text-gold-400 mb-2" />
          <h1 className="text-3xl font-serif text-gold-100 tracking-wider">本日のピックアップ</h1>
        </header>

        <div className="relative w-full max-w-sm aspect-[3/4] max-h-[60vh]">
          {loading && candidates.length <= currentIndex ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gold-400 bg-luxe-panel/20 rounded-2xl border border-white/5">
              <Icons.Diamond className="w-12 h-12 animate-pulse mb-4" />
              <p className="font-serif text-lg animate-pulse tracking-widest uppercase">Curation...</p>
            </div>
          ) : currentIndex < candidates.length ? (
            <div className="relative w-full h-full perspective-1000">
              <div key={currentProfile?.id} className={`absolute inset-0 z-10 transition-all duration-500 transform ${swipeDirection === 'right' ? 'translate-x-[200%] rotate-[30deg] opacity-0' : ''} ${swipeDirection === 'left' ? '-translate-x-[200%] rotate-[-40deg] opacity-0' : ''} ${!swipeDirection ? 'animate-card-arrive' : ''}`}>
                <ProfileCard profile={currentProfile} onClick={() => !isAnimating && onOpenProfile(currentProfile)} />
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 bg-white/5 rounded-2xl border border-white/10">
              <h3 className="text-xl font-serif text-white mb-6">本日のピックアップは終了しました</h3>
              <button onClick={() => { setCurrentIndex(0); loadProfiles(); }} className="px-12 py-5 bg-gold-500 rounded-full text-black font-black uppercase">再読み込み</button>
            </div>
          )}
        </div>
      </div>

      {currentIndex < candidates.length && !loading && (
        <div className="fixed bottom-[110px] left-0 w-full flex items-center justify-center gap-14 z-[60] pointer-events-none animate-fade-in">
          <button onClick={() => handleAction('left')} disabled={isAnimating} className="w-20 h-20 rounded-full bg-luxe-panel border border-white/10 flex items-center justify-center text-gray-500 active:scale-90 transition-all shadow-2xl pointer-events-auto bg-opacity-95 backdrop-blur-md">
            <Icons.Reject className="w-10 h-10" />
          </button>
          <button onClick={() => handleAction('right')} disabled={isAnimating} className="w-20 h-20 rounded-full bg-gradient-to-br from-gold-300 to-gold-600 flex items-center justify-center text-white active:scale-90 shadow-[0_0_30px_rgba(212,175,55,0.4)] transition-all pointer-events-auto">
            <Icons.Heart className="w-10 h-10 fill-white" />
          </button>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
