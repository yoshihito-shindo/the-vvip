
import React from 'react';
import { Icons } from '../components/Icons';

interface LandingProps {
  onEnter: () => void;
}

const Landing: React.FC<LandingProps> = ({ onEnter }) => {
  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden p-6">
        <div className="absolute top-0 left-0 w-full h-full opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gold-600 via-black to-black pointer-events-none"></div>
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-gold-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse"></div>
        <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-gold-300 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse delay-1000"></div>

        <div className="z-10 text-center max-w-lg mx-auto space-y-8 animate-fade-in">
            <div className="flex justify-center mb-6">
                <div className="relative">
                    <Icons.Diamond className="w-20 h-20 text-gold-400" />
                    <div className="absolute inset-0 bg-gold-400 blur-xl opacity-30"></div>
                </div>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-serif font-bold text-transparent bg-clip-text bg-gradient-to-b from-gold-100 to-gold-600 tracking-tight">
                THE VVIP
            </h1>
            
            <p className="text-xl md:text-2xl font-light text-gray-300 tracking-wide font-serif italic">
                "選ばれし者たちが集う、至高の社交場"
            </p>

            <div className="bg-white/5 border border-white/10 p-6 rounded-lg backdrop-blur-md">
                <div className="flex items-center gap-3 text-gold-300 mb-2 justify-center">
                    <Icons.Award className="w-5 h-5" />
                    <span className="uppercase tracking-widest text-xs font-bold">入会審査ステータス</span>
                </div>
                <div className="text-white font-serif text-lg">
                    審査通過
                </div>
                <p className="text-xs text-gray-500 mt-2">
                    厳正なる審査の結果、ゴールドティアへの入会が承認されました。
                </p>
            </div>

            <button 
                onClick={onEnter}
                className="group relative px-10 py-4 bg-transparent overflow-hidden rounded-full border border-gold-500/50 text-gold-100 font-bold tracking-[0.2em] uppercase hover:bg-gold-500/10 transition-all duration-500"
            >
                <span className="relative z-10 flex items-center gap-4">
                    ラウンジへ入る
                    <Icons.Send className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
            </button>
        </div>

        <div className="absolute bottom-6 text-xs text-gray-600 uppercase tracking-widest">
            完全審査制 &bull; 東京 &bull; ニューヨーク &bull; パリ
        </div>
    </div>
  );
};

export default Landing;
