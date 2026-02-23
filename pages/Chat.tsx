
import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, Message, SubscriptionPlan } from '../types';
import { chatWithPersona } from '../services/geminiService';
import { messageService } from '../services/messageService';
import { matchService } from '../services/matchService';
import { Icons } from '../components/Icons';
import { useNavigate } from 'react-router-dom';

interface ChatProps {
  matches: UserProfile[];
  myProfile: UserProfile;
  onOpenProfile: (profile: UserProfile) => void;
}

const Chat: React.FC<ChatProps> = ({ matches, myProfile, onOpenProfile }) => {
  const navigate = useNavigate();
  const [activeMatch, setActiveMatch] = useState<UserProfile | null>(null);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeMatch]);

  // Load messages when active match changes
  useEffect(() => {
    if (!activeMatch) { setMessages([]); setActiveMatchId(null); return; }

    let unsubscribe: (() => void) | null = null;

    const loadMessages = async () => {
      try {
        const mId = await matchService.getMatchId(myProfile.id, activeMatch.id);
        if (!mId) return;
        setActiveMatchId(mId);

        const msgs = await messageService.getMessages(mId);
        setMessages(msgs);

        // Mark messages as read
        await messageService.markAsRead(mId, myProfile.id);

        // Subscribe to new messages (for real users)
        if (!activeMatch.is_ai_generated) {
          unsubscribe = messageService.subscribeToMessages(mId, (newMsg) => {
            if (newMsg.senderId !== myProfile.id) {
              setMessages(prev => [...prev, newMsg]);
            }
          });
        }
      } catch (err) {
        console.error('Failed to load messages:', err);
      }
    };

    loadMessages();
    return () => { if (unsubscribe) unsubscribe(); };
  }, [activeMatch?.id]);

  const handleSend = async () => {
    if (!inputValue.trim() || !activeMatch || !activeMatchId) return;

    if (myProfile.subscription === SubscriptionPlan.Free) {
      setShowPaywall(true);
      return;
    }

    const userText = inputValue;
    setInputValue('');

    try {
      // Save user message to DB
      const savedMsg = await messageService.sendMessage(activeMatchId, myProfile.id, userText);
      setMessages(prev => [...prev, savedMsg]);

      // If AI profile, generate response
      if (activeMatch.is_ai_generated) {
        setIsTyping(true);

        const historyForAI = messages.map(m => ({
          role: m.senderId === myProfile.id ? 'me' : activeMatch.id,
          content: m.text
        }));
        historyForAI.push({ role: 'me', content: userText });

        const responseText = await chatWithPersona(historyForAI, activeMatch);

        // Save AI response to DB
        const aiMsg = await messageService.sendMessage(activeMatchId, activeMatch.id, responseText);
        setMessages(prev => [...prev, aiMsg]);
        setIsTyping(false);
      }
    } catch (err) {
      console.error('Send message error:', err);
      setIsTyping(false);
    }
  };

  const handleGoToSubscription = () => {
    navigate('/subscription', { state: { from: '/messages' } });
  };

  return (
    <div className="flex h-[100dvh] bg-luxe-black md:pl-24 relative overflow-hidden">
      {/* Match List */}
      <div className={`w-full md:w-80 border-r border-luxe-panel bg-luxe-charcoal flex flex-col pb-20 md:pb-0 ${activeMatch ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-6 border-b border-luxe-panel">
          <h2 className="text-xl font-serif text-gold-100">メッセージ</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {matches.map(match => (
            <div
              key={match.id}
              onClick={() => setActiveMatch(match)}
              className={`p-4 flex items-center gap-4 cursor-pointer hover:bg-luxe-panel/50 ${activeMatch?.id === match.id ? 'bg-luxe-panel border-r-2 border-gold-400' : ''}`}
            >
              <img src={match.imageUrls[0]} className="w-12 h-12 rounded-full object-cover border border-gold-600/30" />
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-200 truncate">{match.name}</h3>
                <p className="text-sm text-gray-400 truncate">マッチング成立！</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Window */}
      <div className={`flex-1 flex flex-col h-full bg-luxe-black relative ${!activeMatch ? 'hidden md:flex' : 'flex'}`}>
        {activeMatch ? (
          <>
            {/* Header */}
            <div className="h-20 border-b border-luxe-panel flex items-center px-6 bg-luxe-charcoal shrink-0 z-20">
                <button onClick={() => setActiveMatch(null)} className="md:hidden text-gray-400 mr-4">
                    <Icons.Back className="w-6 h-6" />
                </button>

                <div
                  onClick={() => onOpenProfile(activeMatch)}
                  className="flex items-center cursor-pointer group hover:opacity-80 transition-all"
                >
                  <img src={activeMatch.imageUrls[0]} className="w-10 h-10 rounded-full object-cover mr-4 border border-gold-500/20 group-hover:border-gold-500 transition-colors" />
                  <div className="flex flex-col">
                    <h2 className="font-bold text-gold-100 group-hover:text-white transition-colors">{activeMatch.name}</h2>
                    <span className="text-[8px] text-gray-500 uppercase tracking-widest font-black flex items-center gap-1">
                      <Icons.Eye className="w-2 h-2" />
                      プロフィールを見る
                    </span>
                  </div>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.senderId === myProfile.id ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] px-5 py-3 rounded-2xl text-sm ${msg.senderId === myProfile.id ? 'bg-gold-600 text-white rounded-br-none' : 'bg-luxe-panel text-gray-200 rounded-bl-none'}`}>
                            {msg.text}
                        </div>
                    </div>
                ))}
                {isTyping && <div className="text-xs text-gray-500 animate-pulse">入力中...</div>}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="shrink-0 p-4 mb-20 md:mb-0 bg-luxe-charcoal border-t border-luxe-panel z-[60] shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
                <div className="max-w-4xl mx-auto flex items-center gap-2 bg-luxe-black border border-luxe-panel rounded-full px-4 py-3">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="メッセージを入力..."
                        className="flex-1 bg-transparent text-white focus:outline-none"
                    />
                    <button onClick={handleSend} disabled={!inputValue.trim()} className="text-gold-400 p-2 active:scale-90 transition-transform">
                        <Icons.Send className="w-6 h-6" />
                    </button>
                </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-600">メッセージを選択してください</div>
        )}
      </div>

      {/* Paywall Overlay */}
      {showPaywall && (
        <div className="fixed inset-0 z-[11000] flex items-center justify-center p-6 bg-black/95 backdrop-blur-2xl">
           <div className="bg-luxe-panel max-w-sm w-full p-8 rounded-[2.5rem] border border-gold-500/30 text-center space-y-6">
              <div className="w-20 h-20 bg-gold-500/10 rounded-full flex items-center justify-center mx-auto">
                 <Icons.Message className="w-10 h-10 text-gold-400" />
              </div>
              <h3 className="text-2xl font-serif text-white">メッセージを送信</h3>
              <p className="text-gray-400 text-sm">マッチングしたお相手と会話するには、メンバーシップ登録が必要です。</p>
              <button onClick={handleGoToSubscription} className="w-full py-4 bg-gold-500 text-black font-black uppercase rounded-full">プランを選択する</button>
              <button onClick={() => setShowPaywall(false)} className="w-full text-gray-500 text-[10px] font-bold">キャンセル</button>
           </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
