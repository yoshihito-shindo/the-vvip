
import React, { useState, useEffect, useMemo } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navigation from './components/Navigation';
import Dashboard from './pages/Dashboard';
import Discover from './pages/Discover';
import Footprints from './pages/Footprints';
import LikesReceived from './pages/LikesReceived';
import Chat from './pages/Chat';
import Verification from './pages/Verification';
import AdminPanel from './pages/AdminPanel';
import MyProfile from './pages/MyProfile';
import EditProfile from './pages/EditProfile';
import Subscription from './pages/Subscription';
import ProfileDetailModal from './pages/ProfileDetailModal';
import AuthPage from './pages/AuthPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { UserProfile, Gender, AccountStatus, Footprint, LikeReceived } from './types';
import { profileService } from './services/profileService';
import { matchService } from './services/matchService';
import { footprintService } from './services/footprintService';
import { Icons } from './components/Icons';

const GlobalMatchOverlay: React.FC<{
  me: UserProfile;
  matchedUser: UserProfile | null;
  onClose: () => void;
  onGoToChat: () => void;
}> = ({ me, matchedUser, onClose, onGoToChat }) => {
  if (!matchedUser) return null;
  return (
    <div className="fixed inset-0 z-[20000] flex flex-col items-center justify-center bg-black/95 backdrop-blur-2xl animate-fade-in">
      <div className="relative z-10 text-center space-y-8 px-8 w-full max-w-md">
        <header className="space-y-3 animate-bounce-slow">
          <Icons.Sparkles className="w-16 h-16 mx-auto text-gold-400" />
          <h2 className="text-6xl font-serif font-black text-transparent bg-clip-text bg-gradient-to-b from-gold-100 to-gold-500 italic">マッチ成立</h2>
        </header>
        <div className="flex items-center justify-center gap-6 py-6">
          <img src={me.imageUrls[0]} className="w-24 h-24 rounded-full border-2 border-gold-500 shadow-2xl" alt="Me" />
          <Icons.Heart className="w-10 h-10 text-gold-500 fill-gold-500 animate-pulse" />
          <img src={matchedUser.imageUrls[0]} className="w-24 h-24 rounded-full border-2 border-gold-500 shadow-2xl" alt="Matched" />
        </div>
        <p className="text-gray-200 text-xl">{matchedUser.name}さんとマッチングしました！</p>
        <div className="flex flex-col gap-4 w-full pt-4">
          <button onClick={onGoToChat} className="w-full py-4 bg-gold-500 rounded-full text-black font-bold uppercase tracking-widest">メッセージを送る</button>
          <button onClick={onClose} className="w-full py-2 text-gray-500 hover:text-white text-[10px] uppercase font-bold">閉じる</button>
        </div>
      </div>
    </div>
  );
};

const AdminLoader: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/profile" replace />;
  return <>{children}</>;
};

const AppContent: React.FC = () => {
  const { profile: meProfile, setProfile, isAdmin, refreshProfile } = useAuth();
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [matches, setMatches] = useState<UserProfile[]>([]);
  const [footprints, setFootprints] = useState<Footprint[]>([]);
  const [receivedLikes, setReceivedLikes] = useState<LikeReceived[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<UserProfile | null>(null);
  const [justMatchedUser, setJustMatchedUser] = useState<UserProfile | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminUsers, setAdminUsers] = useState<UserProfile[]>([]);

  // Load admin users when admin accesses /admin route or toggles admin mode
  useEffect(() => {
    if (isAdmin && (window.location.hash === '#/admin' || showAdmin) && adminUsers.length === 0) {
      profileService.getAllProfiles().then(setAdminUsers).catch(() => {});
    }
  }, [isAdmin, showAdmin]);

  useEffect(() => {
    if (!meProfile) return;
    const init = async () => {
      setLoadingUsers(true);
      try {
        // Load profiles from DB
        const targetGender = meProfile.gender === Gender.Male ? Gender.Female : Gender.Male;
        const profiles = await profileService.getProfiles({ gender: targetGender, limit: 50 });
        setAllUsers(profiles);

        // Load matches from DB
        const matchedProfiles = await matchService.getMatches(meProfile.id);
        setMatches(matchedProfiles);

        // Load footprints from DB
        const fps = await footprintService.getFootprints(meProfile.id);
        setFootprints(fps);

        // Load received likes from DB
        const likes = await matchService.getReceivedLikes(meProfile.id);
        setReceivedLikes(likes.map(l => ({
          id: l.id,
          user: l.user,
          timestamp: l.timestamp,
          isNew: Date.now() - l.timestamp < 24 * 60 * 60 * 1000,
        })));
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoadingUsers(false);
      }
    };
    init();
  }, [meProfile?.id]);

  if (!meProfile) return null;

  // If not verified yet, show verification flow (admins skip)
  if (!meProfile.isVerified && !isAdmin) {
    const alreadySubmitted = !!meProfile.verificationImageUrl;
    return <Verification
      alreadySubmitted={alreadySubmitted}
      onComplete={async () => {
        await refreshProfile();
      }}
    />;
  }

  const adminPanel = isAdmin ? (
    <AdminPanel
      allUsers={adminUsers}
      onUpdateUser={async (updatedUser) => {
        if (updatedUser.status === AccountStatus.Gold || updatedUser.status === AccountStatus.Black) {
          await profileService.approveUser(updatedUser.id);
        } else {
          await profileService.rejectUser(updatedUser.id);
        }
        const refreshed = await profileService.getAllProfiles();
        setAdminUsers(refreshed);
      }}
      onExit={() => { setShowAdmin(false); window.location.hash = '#/profile'; }}
    />
  ) : <Navigate to="/profile" replace />;

  // Admin panel (legacy showAdmin toggle)
  if (showAdmin && isAdmin) {
    return adminPanel;
  }

  const targetGenderUsers = allUsers.filter(u => {
    const matchedIds = new Set(matches.map(m => m.id));
    return u.gender !== meProfile.gender && !matchedIds.has(u.id);
  });

  const handleOpenDetail = (profile: UserProfile) => setSelectedProfile(profile);
  const handleCloseDetail = () => setSelectedProfile(null);

  const handleLikeInDetail = async () => {
    if (!selectedProfile) return;
    const profile = selectedProfile;
    try {
      const result = await matchService.likeProfile(meProfile.id, profile.id);
      if (result.matched) {
        setMatches(prev => [profile, ...prev.filter(m => m.id !== profile.id)]);
        setJustMatchedUser(profile);
      }
      setReceivedLikes(prev => prev.filter(l => l.user.id !== profile.id));
    } catch (err) {
      console.error('Like error:', err);
    }
    handleCloseDetail();
  };

  const handleSetMeProfile = (updater: UserProfile | ((prev: UserProfile) => UserProfile)) => {
    if (typeof updater === 'function') {
      setProfile(prev => prev ? updater(prev) : prev);
    } else {
      setProfile(updater);
    }
  };

  return (
    <div className="min-h-screen bg-luxe-black text-white font-sans">
      {meProfile.paymentFailed && (
        <div className="bg-red-600 text-white text-center py-3 px-4 text-sm font-bold z-[9000] relative">
          お支払いに失敗しました。プロフィール画面からお支払い方法をご確認ください。
        </div>
      )}
      {!selectedProfile && <Navigation hasNewFootprints={footprints.some(f => f.isNew)} hasNewLikes={receivedLikes.some(l => l.isNew)} />}

      <GlobalMatchOverlay me={meProfile} matchedUser={justMatchedUser} onClose={() => setJustMatchedUser(null)} onGoToChat={() => { setJustMatchedUser(null); window.location.hash = '#/messages'; }} />
      <ProfileDetailModal profile={selectedProfile} isMatched={matches.some(m => m.id === selectedProfile?.id)} onClose={handleCloseDetail} onLike={handleLikeInDetail} myUserId={meProfile.id} />

      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard meProfile={meProfile} userGender={meProfile.gender} onOpenProfile={handleOpenDetail} matches={matches} setMatches={setMatches} onMatch={setJustMatchedUser} />} />
        <Route path="/discover" element={<Discover meProfile={meProfile} profiles={targetGenderUsers} loading={loadingUsers} matches={matches} setMatches={setMatches} onOpenProfile={handleOpenDetail} />} />
        <Route path="/likes" element={<LikesReceived likes={receivedLikes} setLikes={setReceivedLikes} onOpenProfile={handleOpenDetail} />} />
        <Route path="/footprints" element={<Footprints footprints={footprints} setFootprints={setFootprints} meProfile={meProfile} matches={matches} setMatches={setMatches} onOpenProfile={handleOpenDetail} />} />
        <Route path="/messages" element={<Chat matches={matches} myProfile={meProfile} onOpenProfile={handleOpenDetail} />} />
        <Route path="/profile" element={<MyProfile user={meProfile} onAdminMode={async () => {
          if (!isAdmin) return;
          const all = await profileService.getAllProfiles();
          setAdminUsers(all);
          setShowAdmin(true);
        }} />} />
        <Route path="/admin" element={<AdminLoader>{adminPanel}</AdminLoader>} />
        <Route path="/profile/edit" element={<EditProfile user={meProfile} onSave={handleSetMeProfile} />} />
        <Route path="/subscription" element={<Subscription currentPlan={meProfile.subscription} myUserId={meProfile.id} onSelectPlan={(plan) => handleSetMeProfile(prev => ({...prev, subscription: plan}))} />} />
      </Routes>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
};

const AppRouter: React.FC = () => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-luxe-black flex items-center justify-center">
        <div className="text-center space-y-4">
          <Icons.Diamond className="w-16 h-16 text-gold-400 mx-auto animate-pulse" />
          <p className="text-gold-200 font-serif tracking-widest uppercase animate-pulse">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <AuthPage />;
  }

  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
};

export default App;
