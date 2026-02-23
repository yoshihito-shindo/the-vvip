
import React, { useState, useEffect, useRef } from 'react';
import { SubscriptionPlan } from '../types';
import { Icons } from '../components/Icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { paymentService } from '../services/paymentService';

declare global {
  interface Window {
    Stripe: any;
  }
}

interface SubscriptionProps {
  currentPlan: SubscriptionPlan;
  myUserId: string;
  onSelectPlan: (plan: SubscriptionPlan) => void;
}

const Subscription: React.FC<SubscriptionProps> = ({ currentPlan, myUserId, onSelectPlan }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedPlanId, setSelectedPlanId] = useState<SubscriptionPlan | null>(null);
  const [paymentStep, setPaymentStep] = useState<'CONFIRM' | 'PROCESSING' | 'SUCCESS' | 'ERROR'>('CONFIRM');
  const [errorMessage, setErrorMessage] = useState('');
  const [config, setConfig] = useState<{publishableKey: string | null, mode: string} | null>(null);
  
  const stripeRef = useRef<any>(null);
  const cardRef = useRef<any>(null);

  const fromChat = location.state?.from === '/messages';

  const plans = [
    {
      id: SubscriptionPlan.Gold, name: 'Gold', period: '3ヶ月プラン', price: '¥19,800', priceLabel: '/月', priceValue: 59400,
      features: ['無制限メッセージ送信', '全てのプロフィール閲覧', '本人確認バッジ'], color: 'border-white/10'
    },
    {
      id: SubscriptionPlan.Platinum, name: 'Platinum', period: '3ヶ月プラン', price: '¥29,800', priceLabel: '/月', priceValue: 89400,
      features: ['Gold全機能', '優先的な表示', 'シークレットモード'], color: 'border-gold-500/50', popular: true
    },
    {
      id: SubscriptionPlan.VVIP, name: 'VVIP', period: '3ヶ月プラン', price: '¥49,800', priceLabel: '/月', priceValue: 149400,
      features: ['Platinum全機能', '専属コンシェルジュ', 'VVIPバッジ', '最優先表示'], color: 'border-white', luxury: true
    }
  ];

  // 公開鍵の決定ロジック（管理者オーバーライド優先）
  const getActivePubKey = () => {
    const localOverride = localStorage.getItem('DEBUG_STRIPE_PUB_KEY');
    if (localOverride) return localOverride;
    return config?.publishableKey;
  };

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch('/api/config');
        const data = await res.json();
        setConfig(data);
      } catch (err) {
        console.error("Failed to fetch server config");
      }
    };
    fetchConfig();
  }, []);

  useEffect(() => {
    const pubKey = getActivePubKey();
    if (selectedPlanId && pubKey && window.Stripe) {
      // Destroy previous card element if exists
      if (cardRef.current) {
        cardRef.current.destroy();
        cardRef.current = null;
      }
      const timer = setTimeout(() => {
        try {
          if (!stripeRef.current) {
            stripeRef.current = window.Stripe(pubKey);
          }
          const elements = stripeRef.current.elements();
          const card = elements.create('card', {
            style: {
              base: {
                color: '#F9F1D8', fontFamily: '"Lato", sans-serif', fontSize: '16px',
                '::placeholder': { color: '#444' }
              },
              invalid: { color: '#ef4444' }
            },
            hidePostalCode: true
          });
          const target = document.getElementById('stripe-card-element');
          if (target) {
            target.innerHTML = '';
            card.mount('#stripe-card-element');
            cardRef.current = card;
          }
        } catch (e: any) {
          setErrorMessage("Stripe初期化エラー: " + e.message);
        }
      }, 300);
      return () => {
        clearTimeout(timer);
      };
    }
    return () => {
      if (cardRef.current) {
        cardRef.current.destroy();
        cardRef.current = null;
      }
    };
  }, [selectedPlanId, config]);

  const executePayment = async () => {
    setErrorMessage('');

    try {
      if (!stripeRef.current || !cardRef.current) throw new Error('決済システムの準備が未完了です。');

      // Create payment method BEFORE unmounting the card element
      const { paymentMethod, error: pmError } = await stripeRef.current.createPaymentMethod({
        type: 'card',
        card: cardRef.current,
      });
      if (pmError) throw new Error(pmError.message);

      setPaymentStep('PROCESSING');

      const activePlan = plans.find(p => p.id === selectedPlanId);

      // 1. Create subscription on server
      const response = await fetch('/api/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: selectedPlanId, paymentMethodId: paymentMethod.id, userId: myUserId }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'サーバーエラー');

      // 2. Confirm payment if needed (3D Secure etc.)
      if (data.clientSecret) {
        const result = await stripeRef.current.confirmCardPayment(data.clientSecret);
        if (result.error) throw new Error(result.error.message);
      }

      // 3. Record to DB and update UI
      if (selectedPlanId) {
        await paymentService.recordPayment(
          myUserId,
          selectedPlanId,
          activePlan?.priceValue || 0,
          data.subscriptionId
        );
        onSelectPlan(selectedPlanId);
      }
      setPaymentStep('SUCCESS');
      setTimeout(() => navigate(fromChat ? '/messages' : '/dashboard'), 2000);
    } catch (err: any) {
      setErrorMessage(err.message);
      setPaymentStep('ERROR');
    }
  };

  return (
    <div className="min-h-screen bg-luxe-black pb-32 md:pl-32 p-6 relative">
      <div className="animate-fade-in">
        <header className="max-w-5xl mx-auto mb-16 text-center pt-10">
          <Icons.Award className="w-12 h-12 text-gold-400 mx-auto mb-4" />
          <h1 className="text-4xl font-serif text-gold-100 mb-2 uppercase tracking-tighter">Memberships</h1>
        </header>

        {paymentStep === 'CONFIRM' && (
          <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <div key={plan.id} onClick={() => !currentPlan.includes(plan.id) && setSelectedPlanId(plan.id)}
                className={`relative flex flex-col bg-luxe-panel p-8 rounded-[2.5rem] border-2 transition-all ${plan.color} ${currentPlan === plan.id ? 'opacity-50 pointer-events-none' : 'cursor-pointer hover:scale-105'}`}>
                <h2 className="text-3xl font-serif font-bold text-white mb-2">{plan.name}</h2>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-4">{plan.period}</p>
                <div className="text-3xl font-black text-gold-300 mb-8">{plan.price}<span className="text-sm text-gray-500 font-normal">{plan.priceLabel}</span></div>
                <ul className="flex-1 space-y-4 mb-10">
                  {plan.features.map(feat => <li key={feat} className="flex items-center gap-3 text-sm text-gray-300"><Icons.Verify className="w-4 h-4 text-gold-500" />{feat}</li>)}
                </ul>
                <button className={`w-full py-4 rounded-xl text-xs font-black uppercase tracking-widest ${selectedPlanId === plan.id ? 'bg-gold-500 text-black' : 'bg-white/5 text-gray-400'}`}>選択</button>
              </div>
            ))}
          </div>
        )}

        {selectedPlanId && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
            <div className="bg-luxe-panel w-full max-w-md p-8 rounded-[2.5rem] border border-white/10 shadow-2xl space-y-8">
               <div className="text-center">
                  <h3 className="text-2xl font-serif text-white mb-1">お支払い</h3>
                  <p className="text-gold-400 text-sm font-bold">{plans.find(p => p.id === selectedPlanId)?.name}</p>
               </div>

               {(paymentStep === 'CONFIRM' || paymentStep === 'ERROR') && (
                 <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] text-gray-500 uppercase font-black">カード情報</label>
                      <div id="stripe-card-element" className="bg-black/40 border border-white/5 p-4 rounded-xl min-h-[50px]"></div>
                    </div>
                    {errorMessage && <p className="text-xs text-red-500 text-center font-bold bg-red-500/10 p-3 rounded-lg">{errorMessage}</p>}
                    <button onClick={executePayment} className="w-full py-4 bg-gold-500 text-black font-black uppercase rounded-xl shadow-xl shadow-gold-500/20 active:scale-95 transition-all">
                      確定する
                    </button>
                    <button onClick={() => { setSelectedPlanId(null); setPaymentStep('CONFIRM'); }} className="w-full text-[10px] text-gray-500 font-bold uppercase">キャンセル</button>
                 </div>
               )}

               {paymentStep === 'PROCESSING' && (
                 <div className="py-10 text-center space-y-6">
                    <div className="w-16 h-16 border-4 border-gold-500/20 border-t-gold-500 rounded-full animate-spin mx-auto"></div>
                    <p className="text-gold-200 animate-pulse font-serif">Processing...</p>
                 </div>
               )}

               {paymentStep === 'SUCCESS' && (
                 <div className="py-10 text-center space-y-6 animate-fade-in">
                    <Icons.Verify className="w-20 h-20 text-green-500 mx-auto" />
                    <h3 className="text-2xl font-serif text-white">決済完了</h3>
                 </div>
               )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Subscription;
