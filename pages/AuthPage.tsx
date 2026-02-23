import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Gender } from '../types';
import { Icons } from '../components/Icons';
import { MASTER_DATA } from '../services/geminiService';

type Mode = 'LOGIN' | 'REGISTER';

const AuthPage: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('LOGIN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Registration fields
  const [name, setName] = useState('');
  const [age, setAge] = useState(25);
  const [gender, setGender] = useState<Gender>(Gender.Male);
  const [occupation, setOccupation] = useState(MASTER_DATA.occupations[0]);
  const [location, setLocation] = useState(MASTER_DATA.locations[0]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'LOGIN') {
        await signIn(email, password);
      } else {
        if (!name.trim()) { setError('お名前を入力してください'); setLoading(false); return; }
        await signUp(email, password, {
          name,
          age,
          gender,
          occupation,
          location,
          imageUrls: [`https://picsum.photos/seed/${name.replace(/\s/g, '')}/400/400`],
          tags: [],
        });
      }
    } catch (err: any) {
      setError(err.message || '認証エラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const inputClasses = "w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-gold-500/50 transition-all";
  const labelClasses = "text-[9px] text-gray-500 font-bold uppercase tracking-widest block mb-1";

  return (
    <div className="min-h-screen bg-luxe-black flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gold-600/5 blur-[150px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gold-600/5 blur-[150px] rounded-full pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-md animate-fade-in">
        <div className="text-center mb-10">
          <Icons.Diamond className="w-14 h-14 text-gold-400 mx-auto mb-4" />
          <h1 className="text-4xl font-serif text-white">THE VVIP</h1>
          <p className="text-[10px] text-gold-500 uppercase tracking-[0.4em] font-bold mt-2">
            {mode === 'LOGIN' ? 'Welcome Back' : 'Join the Club'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-luxe-panel/60 backdrop-blur-xl border border-white/5 rounded-[2rem] p-8 space-y-5">
          {mode === 'REGISTER' && (
            <>
              <div>
                <label className={labelClasses}>お名前</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="タクミ" className={inputClasses} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClasses}>年齢</label>
                  <input type="number" value={age} onChange={e => setAge(parseInt(e.target.value) || 25)} min={18} max={99} className={inputClasses} />
                </div>
                <div>
                  <label className={labelClasses}>性別</label>
                  <select value={gender} onChange={e => setGender(e.target.value as Gender)} className={inputClasses}>
                    <option value={Gender.Male}>男性</option>
                    <option value={Gender.Female}>女性</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClasses}>職業</label>
                  <select value={occupation} onChange={e => setOccupation(e.target.value)} className={inputClasses}>
                    {MASTER_DATA.occupations.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClasses}>居住地</label>
                  <select value={location} onChange={e => setLocation(e.target.value)} className={inputClasses}>
                    {MASTER_DATA.locations.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}

          <div>
            <label className={labelClasses}>メールアドレス</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className={inputClasses} required />
          </div>
          <div>
            <label className={labelClasses}>パスワード</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="6文字以上" className={inputClasses} required minLength={6} />
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-500/10 p-3 rounded-lg text-center">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-gold-500 to-gold-600 rounded-full text-black font-bold uppercase tracking-widest shadow-lg shadow-gold-500/20 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? '処理中...' : mode === 'LOGIN' ? 'ログイン' : '新規登録'}
          </button>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => { setMode(mode === 'LOGIN' ? 'REGISTER' : 'LOGIN'); setError(''); }}
              className="text-xs text-gray-500 hover:text-gold-400 transition-colors"
            >
              {mode === 'LOGIN' ? 'アカウントをお持ちでない方 → 新規登録' : 'アカウントをお持ちの方 → ログイン'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AuthPage;
