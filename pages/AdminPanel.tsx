
import React, { useState, useEffect } from 'react';
import { UserProfile, AccountStatus, SubscriptionPlan } from '../types';
import { Icons } from '../components/Icons';

interface AdminPanelProps {
  allUsers: UserProfile[];
  onUpdateUser: (updatedUser: UserProfile) => void | Promise<void>;
  onExit: () => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ allUsers, onUpdateUser, onExit }) => {
  const [activeTab, setActiveTab] = useState<'approvals' | 'billing' | 'settings'>('approvals');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [backendUrl, setBackendUrl] = useState<string>(window.location.origin);
  
  // Stripe Key Management
  const [localPubKey, setLocalPubKey] = useState(localStorage.getItem('DEBUG_STRIPE_PUB_KEY') || '');
  const [saveStatus, setSaveStatus] = useState(false);

  // サーバー状態
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'online' | 'error'>('idle');
  const [serverInfo, setServerInfo] = useState<any>(null);

  const pendingUsers = allUsers
    .filter(u => u.status === AccountStatus.Pending || u.status === AccountStatus.Approved)
    .filter(u => !u.is_ai_generated)
    .sort((a, b) => (b.verificationImageUrl ? 1 : 0) - (a.verificationImageUrl ? 1 : 0));

  const [processing, setProcessing] = useState(false);

  const handleStatusChange = async (user: UserProfile, newStatus: AccountStatus) => {
    setProcessing(true);
    try {
      await onUpdateUser({ ...user, status: newStatus });
      setSelectedUser(null);
    } catch (err) {
      console.error('Status update error:', err);
    } finally {
      setProcessing(false);
    }
  };

  const saveLocalKeys = () => {
    localStorage.setItem('DEBUG_STRIPE_PUB_KEY', localPubKey);
    setSaveStatus(true);
    setTimeout(() => setSaveStatus(false), 2000);
    testConnection();
  };

  const testConnection = async () => {
    setTestStatus('testing');
    try {
      const response = await fetch(`${backendUrl}/api/health`);
      if (response.ok) {
        const data = await response.json();
        setServerInfo(data);
        setTestStatus('online');
      } else {
        throw new Error();
      }
    } catch (e) {
      setTestStatus('error');
    }
  };

  useEffect(() => {
    testConnection();
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col md:flex-row font-sans">
      {zoomedImage && (
        <div
          className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-sm flex items-center justify-center p-6 cursor-zoom-out"
          onClick={() => setZoomedImage(null)}
        >
          <img src={zoomedImage} style={{ width: '90vw', height: '90vh', objectFit: 'contain' }} className="rounded-xl" />
          <button onClick={() => setZoomedImage(null)} className="absolute top-6 right-6 text-white/60 hover:text-white text-3xl font-bold">&times;</button>
        </div>
      )}
      <aside className="w-full md:w-72 bg-[#111] border-r border-white/5 flex flex-col p-8 z-20">
        <h1 className="text-xl font-bold mb-10 flex items-center gap-3">
           <Icons.Admin className="w-6 h-6 text-blue-500" /> THE VVIP Admin
        </h1>
        <nav className="space-y-4 flex-1">
          <button onClick={() => setActiveTab('approvals')} className={`w-full text-left p-4 rounded-xl text-sm flex items-center justify-between ${activeTab === 'approvals' ? 'bg-blue-600 shadow-lg' : 'text-gray-500 hover:text-white'}`}>
            審査管理
            {pendingUsers.length > 0 && <span className="bg-red-500 text-[10px] px-2 py-0.5 rounded-full">{pendingUsers.length}</span>}
          </button>
          <button onClick={() => setActiveTab('billing')} className={`w-full text-left p-4 rounded-xl text-sm flex items-center gap-3 ${activeTab === 'billing' ? 'bg-blue-600 shadow-lg' : 'text-gray-500 hover:text-white'}`}>
            <Icons.Card className="w-4 h-4" /> 売上管理
          </button>
          <button onClick={() => setActiveTab('settings')} className={`w-full text-left p-4 rounded-xl text-sm flex items-center gap-3 ${activeTab === 'settings' ? 'bg-blue-600 shadow-lg' : 'text-gray-500 hover:text-white'}`}>
            <Icons.Settings className="w-4 h-4" /> システム設定
          </button>
        </nav>
        <button onClick={onExit} className="text-gray-600 hover:text-white text-[10px] font-black uppercase tracking-[0.3em] transition-colors mt-auto">Logout System</button>
      </aside>

      <main className="flex-1 p-8 md:p-12 overflow-y-auto bg-[#0a0a0a]">
        {activeTab === 'approvals' && (
          <div className="animate-fade-in space-y-8">
            <header><h2 className="text-4xl font-bold font-serif">審査管理</h2></header>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                {pendingUsers.map(user => (
                  <div key={user.id} onClick={() => setSelectedUser(user)} className={`p-4 rounded-2xl border flex items-center gap-4 cursor-pointer ${selectedUser?.id === user.id ? 'bg-blue-600/10 border-blue-500' : 'bg-luxe-panel border-white/5'}`}>
                    <img src={user.imageUrls[0]} className="w-12 h-12 rounded-full object-cover" />
                    <div className="flex-1">
                      <span className="font-bold">{user.name}</span>
                      <p className="text-[10px] text-gray-400">{user.occupation}</p>
                    </div>
                    {user.verificationImageUrl
                      ? <span className="text-[9px] bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full font-bold">書類あり</span>
                      : <span className="text-[9px] bg-white/5 text-gray-600 px-2 py-1 rounded-full">未提出</span>
                    }
                  </div>
                ))}
              </div>
              {selectedUser && (
                <div className="bg-luxe-panel p-8 rounded-[2.5rem] border border-white/10 animate-fade-in space-y-6">
                  <div className="flex items-center gap-4">
                    <img src={selectedUser.imageUrls[0]} className="w-16 h-16 rounded-full object-cover" />
                    <div>
                      <h3 className="text-xl font-bold">{selectedUser.name}</h3>
                      <p className="text-sm text-gray-400">{selectedUser.age}歳 / {selectedUser.occupation}</p>
                      <p className="text-[10px] text-gray-500 mt-1">ステータス: <span className={`font-bold ${selectedUser.status === AccountStatus.Pending ? 'text-yellow-400' : 'text-blue-400'}`}>{selectedUser.status}</span></p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-[10px] text-gray-500 uppercase font-black tracking-widest">提出された身分証</h4>
                    {selectedUser.verificationImageUrl ? (
                      <div>
                        <img
                          src={selectedUser.verificationImageUrl}
                          onClick={() => setZoomedImage(selectedUser.verificationImageUrl!)}
                          style={{ width: '100%', minHeight: '300px', maxHeight: '500px', objectFit: 'contain' }}
                          className="rounded-xl border border-white/10 bg-black cursor-zoom-in hover:border-blue-500/50 transition-colors"
                        />
                        <p className="text-[10px] text-gray-600 mt-1 text-center">クリックで拡大表示</p>
                      </div>
                    ) : (
                      <div className="w-full h-40 bg-black/40 rounded-xl border border-white/5 flex items-center justify-center">
                        <p className="text-gray-600 text-sm">身分証が未提出です</p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button disabled={processing} onClick={() => handleStatusChange(selectedUser, AccountStatus.Pending)} className="py-4 rounded-xl bg-red-500/10 text-red-500 font-bold disabled:opacity-50">否認</button>
                    <button disabled={processing} onClick={() => handleStatusChange(selectedUser, AccountStatus.Gold)} className="py-4 rounded-xl bg-green-600 text-white font-bold disabled:opacity-50">{processing ? '処理中...' : '承認'}</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-3xl space-y-12 animate-fade-in">
            <header>
              <h2 className="text-4xl font-bold font-serif">システム設定</h2>
              <p className="text-gray-500 mt-2">決済・サーバー環境のデバッグ</p>
            </header>
            
            <div className="bg-luxe-panel p-8 rounded-[2.5rem] border border-white/5 space-y-10">
              {/* Status Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="p-6 bg-black/40 rounded-2xl border border-white/5">
                    <span className="text-[10px] text-gray-500 uppercase font-black">Backend Health</span>
                    <div className="flex items-center gap-3 mt-2">
                       <div className={`w-3 h-3 rounded-full ${testStatus === 'online' ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`}></div>
                       <span className="text-xl font-serif uppercase">{testStatus}</span>
                    </div>
                 </div>
                 <div className="p-6 bg-black/40 rounded-2xl border border-white/5">
                    <span className="text-[10px] text-gray-500 uppercase font-black">Server Secret Key</span>
                    <div className="flex items-center gap-3 mt-2">
                       <div className={`w-3 h-3 rounded-full ${serverInfo?.stripe_mode !== 'test' || serverInfo?.identity ? 'bg-green-500' : 'bg-red-500'}`}></div>
                       <span className="text-xl font-serif">{serverInfo?.stripe_mode === 'live' ? 'LIVE MODE' : 'TEST MODE'}</span>
                    </div>
                 </div>
              </div>

              {/* Manual Override Section */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <Icons.Card className="w-5 h-5 text-gold-400" />
                  <h3 className="text-lg font-serif">Stripe 公開鍵の強制設定</h3>
                </div>
                <p className="text-xs text-gray-500">Renderの環境変数が反映されない場合、ここに公開鍵(pk_...)を入力して保存してください。このブラウザでの決済時に優先使用されます。</p>
                <div className="space-y-4">
                  <input 
                    type="text" 
                    placeholder="pk_live_..."
                    value={localPubKey}
                    onChange={(e) => setLocalPubKey(e.target.value)}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-sm font-mono text-gold-200 outline-none focus:border-gold-500"
                  />
                  <button 
                    onClick={saveLocalKeys}
                    className="px-8 py-3 bg-blue-600 text-white text-xs font-black uppercase rounded-lg shadow-lg hover:bg-blue-500 transition-all flex items-center gap-2"
                  >
                    {saveStatus ? <Icons.Verify className="w-4 h-4" /> : null}
                    {saveStatus ? '保存しました' : '公開鍵を上書き保存'}
                  </button>
                </div>
              </div>

              <div className="pt-8 border-t border-white/5">
                <h4 className="text-[10px] text-gray-600 uppercase font-black mb-4 tracking-widest">Diagnostic Logs</h4>
                <pre className="bg-black/80 p-6 rounded-xl font-mono text-[10px] text-blue-400 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                  {JSON.stringify({
                    server_response: serverInfo,
                    browser_local_key: localPubKey ? 'SET (starts with ' + localPubKey.substring(0, 7) + ')' : 'NOT SET',
                    location: window.location.href,
                    timestamp: new Date().toISOString()
                  }, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminPanel;
