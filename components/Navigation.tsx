
import React from 'react';
import { Icons } from './Icons';
import { Link, useLocation } from 'react-router-dom';

const NavItem = ({ to, icon: Icon, label, isActive, hasBadge }: any) => (
  <Link 
    to={to} 
    className={`flex flex-col items-center justify-center gap-1 w-full h-full transition-colors relative ${isActive ? 'text-gold-400' : 'text-gray-500 hover:text-gold-200'}`}
  >
    <div className="relative">
      <Icon className={`w-6 h-6 ${isActive ? 'fill-gold-400/10' : ''}`} />
      {hasBadge && (
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-gold-500 rounded-full border-2 border-luxe-black"></span>
      )}
    </div>
    <span className="text-[8px] sm:text-[9px] uppercase tracking-wider font-black leading-none mt-1.5 whitespace-nowrap">
      {label}
    </span>
  </Link>
);

interface NavigationProps {
  onLogout?: () => void;
  hasNewFootprints?: boolean;
  hasNewLikes?: boolean;
}

const Navigation: React.FC<NavigationProps> = ({ hasNewFootprints = false, hasNewLikes = false }) => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="fixed bottom-0 left-0 w-full h-20 bg-luxe-black border-t border-luxe-panel z-50 md:top-0 md:left-0 md:w-24 md:h-screen md:flex-col md:border-t-0 md:border-r">
      <div className="flex w-full h-full md:flex-col md:pt-10 md:gap-10">
        
        {/* Brand Logo - Static */}
        <div className="hidden md:flex justify-center mb-4">
           <Icons.Diamond className="w-8 h-8 text-gold-500/50" />
        </div>

        <div className="flex w-full justify-around items-center md:flex-col md:justify-start md:gap-8 md:h-full px-1">
            <NavItem to="/dashboard" icon={Icons.Sparkles} label="ピックアップ" isActive={isActive('/dashboard')} />
            <NavItem to="/discover" icon={Icons.Search} label="探す" isActive={isActive('/discover')} />
            <NavItem to="/likes" icon={Icons.Heart} label="いいね" isActive={isActive('/likes')} hasBadge={hasNewLikes} />
            <NavItem to="/footprints" icon={Icons.Footprints} label="足跡" isActive={isActive('/footprints')} hasBadge={hasNewFootprints} />
            <NavItem to="/messages" icon={Icons.Message} label="メッセージ" isActive={isActive('/messages')} />
            <NavItem to="/profile" icon={Icons.User} label="マイページ" isActive={isActive('/profile')} />
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
