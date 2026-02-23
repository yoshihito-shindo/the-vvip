
import React, { useState, useMemo } from 'react';
import { UserProfile } from '../types';
import { Icons } from '../components/Icons';
import { MASTER_DATA } from '../services/geminiService';
import { useNavigate } from 'react-router-dom';

interface DiscoverProps {
  meProfile: UserProfile;
  profiles: UserProfile[];
  loading?: boolean;
  matches: UserProfile[];
  setMatches: React.Dispatch<React.SetStateAction<UserProfile[]>>;
  onOpenProfile: (profile: UserProfile) => void;
}

const Discover: React.FC<DiscoverProps> = ({ meProfile, profiles, loading = false, matches, setMatches, onOpenProfile }) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const defaultFilters = {
    minAge: 18,
    maxAge: 60,
    minHeight: 140,
    maxHeight: 200,
    income: 'all',
    location: 'all',
    occupation: 'all',
    education: 'all',
    bodyType: 'all'
  };

  const [filters, setFilters] = useState(defaultFilters);

  const ageOptions = Array.from({ length: 43 }, (_, i) => 18 + i); 
  const heightOptions = Array.from({ length: 61 }, (_, i) => 140 + i);

  const handleReset = () => {
    setFilters({...defaultFilters});
    setSearchQuery('');
    setIsResetting(true);
    setTimeout(() => {
      setIsResetting(false);
    }, 600);
  };

  const filteredProfiles = useMemo(() => {
    // 高速検索のためにマッチング済みIDをSet化
    const matchedIds = new Set(matches.map(m => m.id));

    return profiles.filter(p => {
      // 1. すでにマッチングしているユーザーは最優先で除外
      if (matchedIds.has(p.id)) return false;

      // 2. 検索キーワード
      const matchesSearch = !searchQuery || 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.occupation.toLowerCase().includes(searchQuery.toLowerCase());
      
      // 3. 基本フィルター
      const matchesAge = (p.age || 0) >= filters.minAge && (p.age || 0) <= filters.maxAge;
      const matchesHeight = (p.height || 0) >= filters.minHeight && (p.height || 0) <= filters.maxHeight;
      
      let matchesIncome = true;
      if (filters.income !== 'all') {
        const incomeLevels = MASTER_DATA.incomes.filter(i => i !== '非公開');
        const minIndex = incomeLevels.indexOf(filters.income);
        const userIndex = incomeLevels.indexOf(p.income);
        matchesIncome = userIndex >= minIndex || p.income === '非公開'; 
      }
      
      const matchesLocation = filters.location === 'all' || p.location === filters.location;
      const matchesOccupation = filters.occupation === 'all' || p.occupation === filters.occupation;
      const matchesEducation = filters.education === 'all' || p.education === filters.education;
      const matchesBodyType = filters.bodyType === 'all' || p.bodyType === filters.bodyType;
      
      return matchesSearch && matchesAge && matchesHeight && matchesIncome && matchesLocation && matchesOccupation && matchesEducation && matchesBodyType;
    });
  }, [profiles, searchQuery, filters, matches]); // matchesを依存配列に含めることで即時更新

  const selectClasses = "w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-gray-300 focus:outline-none focus:border-gold-500 appearance-none transition-all hover:border-gold-500/30 cursor-pointer";
  const labelClasses = "block text-[10px] uppercase tracking-widest font-black text-gold-500 mb-2";

  return (
    <div className="min-h-screen bg-luxe-black pb-32 md:pl-32 animate-fade-in relative">
      {/* ヘッダー */}
      <header className="sticky top-0 z-40 bg-luxe-black/90 backdrop-blur-xl border-b border-white/5 py-4 px-6">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="hidden md:block">
              <h1 className="text-2xl font-serif text-gold-100">探す</h1>
              <p className="text-gray-500 text-[8px] uppercase tracking-[0.4em] font-bold">Discover Excellence</p>
            </div>
            
            <div className="flex items-center gap-3 flex-1 md:max-w-xl">
              <div className="relative flex-1">
                <Icons.Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input 
                  type="text" 
                  placeholder="名前・キーワードで検索"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-luxe-panel/50 border border-white/10 rounded-full py-2.5 pl-12 pr-6 text-sm text-white focus:outline-none focus:border-gold-500/50 transition-all"
                />
              </div>
              <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2.5 rounded-full border transition-all ${showFilters ? 'bg-gold-500 border-gold-500 text-black' : 'bg-luxe-panel border-white/10 text-gold-400 hover:border-gold-400/50'}`}
              >
                <Icons.Settings className="w-5 h-5" />
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="bg-luxe-panel border border-gold-500/20 rounded-2xl p-6 mt-2 animate-fade-in shadow-2xl max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <label className={labelClasses}>年齢範囲</label>
                  <div className="flex items-center gap-2">
                    <select value={filters.minAge} onChange={e => setFilters(prev => ({...prev, minAge: parseInt(e.target.value)}))} className={selectClasses}>
                      {ageOptions.map(age => <option key={age} value={age}>{age}歳</option>)}
                    </select>
                    <span className="text-gray-500 text-xs">〜</span>
                    <select value={filters.maxAge} onChange={e => setFilters(prev => ({...prev, maxAge: parseInt(e.target.value)}))} className={selectClasses}>
                      {ageOptions.map(age => <option key={age} value={age}>{age}歳</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className={labelClasses}>身長範囲</label>
                  <div className="flex items-center gap-2">
                    <select value={filters.minHeight} onChange={e => setFilters(prev => ({...prev, minHeight: parseInt(e.target.value)}))} className={selectClasses}>
                      {heightOptions.map(h => <option key={h} value={h}>{h}cm</option>)}
                    </select>
                    <span className="text-gray-500 text-xs">〜</span>
                    <select value={filters.maxHeight} onChange={e => setFilters(prev => ({...prev, maxHeight: parseInt(e.target.value)}))} className={selectClasses}>
                      {heightOptions.map(h => <option key={h} value={h}>{h}cm</option>)}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className={labelClasses}>最低年収</label>
                  <select value={filters.income} onChange={e => setFilters(prev => ({...prev, income: e.target.value}))} className={selectClasses}>
                    <option value="all">全て</option>
                    {MASTER_DATA.incomes.filter(i => i !== '非公開').map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className={labelClasses}>居住地</label>
                  <select value={filters.location} onChange={e => setFilters(prev => ({...prev, location: e.target.value}))} className={selectClasses}>
                    <option value="all">全て</option>
                    {MASTER_DATA.locations.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-4">
                <button onClick={handleReset} className="text-[10px] text-gray-500 hover:text-white uppercase tracking-widest font-black px-4">リセット</button>
                <button onClick={() => setShowFilters(false)} className="bg-gold-500 text-black px-8 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest">適用</button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* 一覧表示 */}
      <div className="max-w-5xl mx-auto p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-8 min-h-[400px]">
        {loading && profiles.length === 0 ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] bg-luxe-panel/50 rounded-2xl animate-pulse" />
          ))
        ) : filteredProfiles.length > 0 ? (
          filteredProfiles.map((profile, idx) => (
            <div 
              key={profile.id}
              onClick={() => onOpenProfile(profile)}
              className="group relative aspect-[3/4] bg-luxe-panel rounded-2xl overflow-hidden cursor-pointer border border-white/5 hover:border-gold-500/30 transition-all duration-500 animate-fade-in"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              <img src={profile.imageUrls[0]} alt={profile.name} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 w-full p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg font-serif font-bold text-white tracking-wide">{profile.name}</span>
                  <span className="text-sm font-light text-gray-400">{profile.age}</span>
                </div>
                <p className="text-[10px] text-gold-300 font-medium truncate tracking-wider uppercase">{profile.occupation}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full py-32 text-center space-y-4">
             <Icons.Search className="w-12 h-12 text-gray-800 mx-auto" />
             <p className="text-gray-500 font-serif italic text-xl">該当するメンバーが見つかりませんでした</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Discover;
