import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Gender } from '../types';
import { Icons } from '../components/Icons';
import { MASTER_DATA } from '../services/geminiService';
import { supabase } from '../services/supabaseClient';

type Mode = 'LOGIN' | 'REGISTER';
type ViewState = 'FORM' | 'REGISTERED';

const AuthPage: React.FC = () => {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('LOGIN');
  const [viewState, setViewState] = useState<ViewState>('FORM');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Registration fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState(25);
  const [gender, setGender] = useState<Gender>(Gender.Male);
  const [occupation, setOccupation] = useState(MASTER_DATA.occupations[0]);
  const [location, setLocation] = useState(MASTER_DATA.locations[0]);
  const [income, setIncome] = useState(MASTER_DATA.incomes[0]);

  // File uploads
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idPreview, setIdPreview] = useState<string | null>(null);
  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [facePreview, setFacePreview] = useState<string | null>(null);
  const idInputRef = useRef<HTMLInputElement>(null);
  const faceInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File | undefined, type: 'id' | 'face') => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (type === 'id') {
        setIdFile(file);
        setIdPreview(e.target?.result as string);
      } else {
        setFaceFile(file);
        setFacePreview(e.target?.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const uploadFile = async (file: File, userId: string, bucket: string, prefix: string): Promise<string> => {
    const ext = file.name.split('.').pop() || 'jpg';
    const filePath = `${userId}/${prefix}_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(filePath, file);
    if (error) throw new Error(`アップロードに失敗しました: ${error.message}`);
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
    return urlData.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'LOGIN') {
        await signIn(email, password);
      } else {
        if (!name.trim()) { setError('お名前を入力してください'); setLoading(false); return; }
        if (!phone.trim()) { setError('電話番号を入力してください'); setLoading(false); return; }
        if (!idFile) { setError('身分証明書をアップロードしてください'); setLoading(false); return; }
        if (!faceFile) { setError('顔写真をアップロードしてください'); setLoading(false); return; }

        // 1. Create auth user
        const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
        if (authError) throw authError;
        if (!authData.user) throw new Error('ユーザー作成に失敗しました');
        const userId = authData.user.id;

        // 2. Upload files
        const verificationUrl = await uploadFile(idFile, userId, 'verification-docs', 'id_document');
        const faceUrl = await uploadFile(faceFile, userId, 'verification-docs', 'face_photo');

        // 3. Create profile
        const { error: profileError } = await supabase.from('profiles').insert({
          id: userId,
          name,
          phone,
          age,
          gender,
          occupation,
          income,
          location,
          image_urls: [faceUrl],
          tags: [],
          verification_image_url: verificationUrl,
          is_verified: false,
          status: 'Pending',
          subscription: 'Free',
        });
        if (profileError) throw profileError;

        // If session exists (email confirmation disabled), auto-login
        if (authData.session) {
          await signIn(email, password);
          return;
        }

        // Email confirmation required — show success screen
        setViewState('REGISTERED');
      }
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.includes('User already registered')) {
        setError('このメールアドレスは既に登録されています。ログインしてください。');
      } else if (msg.includes('Invalid login credentials')) {
        setError('メールアドレスまたはパスワードが正しくありません。');
      } else if (msg.includes('Email not confirmed')) {
        setError('メールアドレスの確認が完了していません。確認メールをご確認ください。');
      } else if (msg.includes('Password should be at least')) {
        setError('パスワードは6文字以上で入力してください。');
      } else {
        setError(msg || '認証エラーが発生しました');
      }
    } finally {
      setLoading(false);
    }
  };

  const inputClasses = "w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-gold-500/50 transition-all";
  const labelClasses = "text-[9px] text-gray-500 font-bold uppercase tracking-widest block mb-1";

  if (viewState === 'REGISTERED') {
    return (
      <div className="min-h-screen bg-luxe-black flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gold-600/5 blur-[150px] rounded-full pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gold-600/5 blur-[150px] rounded-full pointer-events-none"></div>
        <div className="relative z-10 w-full max-w-md animate-fade-in text-center space-y-8">
          <div className="flex justify-center">
            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center border border-green-500/30">
              <Icons.Send className="w-10 h-10 text-green-400" />
            </div>
          </div>
          <div className="space-y-4">
            <h2 className="text-3xl font-serif text-white">登録が完了しました</h2>
            <p className="text-gray-400 font-light leading-relaxed">
              ご登録いただいたメールアドレス宛に<br/>
              確認メールを送信しました。<br/>
              メール内のリンクをクリックして<br/>
              アカウントを有効化してください。
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-3">
            <p className="text-[10px] text-gold-400 uppercase font-black tracking-widest">送信先</p>
            <p className="text-white font-medium">{email}</p>
          </div>
          <div className="space-y-4 pt-4">
            <p className="text-[10px] text-gray-600">
              メールが届かない場合は、迷惑メールフォルダをご確認ください。
            </p>
            <button
              onClick={() => { setViewState('FORM'); setMode('LOGIN'); }}
              className="w-full py-4 bg-gradient-to-r from-gold-500 to-gold-600 rounded-full text-black font-bold uppercase tracking-widest shadow-lg shadow-gold-500/20 active:scale-95 transition-all"
            >
              ログイン画面へ
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-luxe-black flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gold-600/5 blur-[150px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gold-600/5 blur-[150px] rounded-full pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-md animate-fade-in">
        <div className="text-center mb-10">
          <Icons.Diamond className="w-14 h-14 text-gold-400 mx-auto mb-4" />
          <h1 className="text-4xl font-serif text-white">THE VVIP</h1>
          <p className="text-[10px] text-gold-500 uppercase tracking-[0.4em] font-bold mt-2">
            {mode === 'LOGIN' ? 'おかえりなさい' : '新規会員登録'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-luxe-panel/60 backdrop-blur-xl border border-white/5 rounded-[2rem] p-8 space-y-5 max-h-[80vh] overflow-y-auto">
          {mode === 'REGISTER' && (
            <>
              <div>
                <label className={labelClasses}>お名前</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="タクミ" className={inputClasses} />
              </div>
              <div>
                <label className={labelClasses}>電話番号</label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="090-1234-5678" className={inputClasses} />
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
              <div>
                <label className={labelClasses}>年収</label>
                <select value={income} onChange={e => setIncome(e.target.value)} className={inputClasses}>
                  {MASTER_DATA.incomes.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>

              {/* ID Document Upload */}
              <div>
                <label className={labelClasses}>顔写真付き身分証明書</label>
                <p className="text-[10px] text-gray-600 mb-2">運転免許証またはパスポート</p>
                <input ref={idInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFileSelect(e.target.files?.[0], 'id')} />
                {idPreview ? (
                  <div className="relative" onClick={() => idInputRef.current?.click()}>
                    <img src={idPreview} alt="身分証プレビュー" className="w-full h-40 object-cover rounded-xl border border-white/10 cursor-pointer" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-xl opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                      <span className="text-white text-xs font-bold">変更する</span>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => idInputRef.current?.click()} className="w-full py-6 border-2 border-dashed border-white/10 rounded-xl text-gray-500 text-xs hover:border-gold-500/30 hover:text-gold-400 transition-all">
                    タップして身分証を選択
                  </button>
                )}
              </div>

              {/* Face Photo Upload */}
              <div>
                <label className={labelClasses}>顔がよくわかる写真</label>
                <p className="text-[10px] text-red-400/80 mb-2">加工が強いと判断した場合、否認される可能性がございます。</p>
                <input ref={faceInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFileSelect(e.target.files?.[0], 'face')} />
                {facePreview ? (
                  <div className="relative" onClick={() => faceInputRef.current?.click()}>
                    <img src={facePreview} alt="顔写真プレビュー" className="w-full h-48 object-cover rounded-xl border border-white/10 cursor-pointer" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-xl opacity-0 hover:opacity-100 transition-opacity cursor-pointer">
                      <span className="text-white text-xs font-bold">変更する</span>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => faceInputRef.current?.click()} className="w-full py-6 border-2 border-dashed border-white/10 rounded-xl text-gray-500 text-xs hover:border-gold-500/30 hover:text-gold-400 transition-all">
                    タップして顔写真を選択
                  </button>
                )}
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
