import React from 'react';
import { Layers, HeartHandshake, Users, TrendingUp, FileSpreadsheet, Settings, User, UserCheck, UserPlus } from 'lucide-react';
import { UserRole, Language, UIElementConfig, Member, AssociationSettings } from '../types';
import { translations } from '../translations';
import { isSectionVisibleForUser } from '../utils/visibilityRules';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  role: UserRole;
  lang: Language;
  uiElements?: UIElementConfig[];
  loggedInMember?: Member | null;
  onRequestMemberLogin?: () => void;
  onRequestRegisterMember?: () => void;
  settings?: AssociationSettings;
  isMasterPlatformAdmin?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  setActiveTab,
  role,
  lang,
  uiElements,
  loggedInMember,
  onRequestMemberLogin,
  onRequestRegisterMember,
  settings,
  isMasterPlatformAdmin,
}) => {
  const t = translations[lang] as any;

  const isVisible = (id: string) => {
    return isSectionVisibleForUser(id, {
      isAdmin: role === 'admin' || !!isMasterPlatformAdmin,
      isMember: !!loggedInMember,
      uiElements: uiElements || [],
    });
  };

  const rawTabs = [
    { id: 'home', elementId: 'home', label: t.home, icon: Layers },
    { id: 'activities', elementId: 'nav_tab_activities', label: t.activities, icon: HeartHandshake },
    { id: 'members', elementId: 'nav_tab_members', label: t.members, icon: Users },
    { id: 'ledger', elementId: 'nav_tab_ledger', label: t.ledger, icon: FileSpreadsheet },
    ...(loggedInMember ? [{ id: 'my-account', elementId: 'my-account', label: t.myAccount || 'حسابي', icon: User }] : []),
    ...(!loggedInMember && (role === 'admin' || isMasterPlatformAdmin) ? [{ id: 'admin', elementId: 'admin', label: t.adminPanel, icon: Settings }] : []),
  ];

  const tabs = rawTabs.filter((tab) => {
    if (tab.id === 'home' || tab.id === 'admin' || tab.id === 'my-account') return true;
    return isVisible(tab.elementId);
  });

  const primaryColor = settings?.themeColors?.primaryColor || '#059669';
  const navBg = settings?.themeColors?.cardColor || '#ffffff';

  return (
    <div 
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 backdrop-blur-lg border-t border-slate-200/80 px-2 py-1.5 shadow-lg safe-area-bottom"
      style={{ backgroundColor: `${navBg}f2` }}
    >
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                color: isActive ? primaryColor : undefined,
              }}
              className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-xl transition-all relative ${
                isActive
                  ? 'font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {isActive && (
                <span 
                  className="absolute -top-1 w-6 h-1 rounded-full"
                  style={{ backgroundColor: primaryColor }}
                />
              )}
              <Icon 
                className="w-5 h-5" 
                style={{ color: isActive ? primaryColor : undefined }}
              />
              <span className="text-[10px] mt-0.5 whitespace-nowrap line-clamp-1">{tab.label}</span>
            </button>
          );
        })}

        {/* If not logged in and not admin, show quick Member Register & Login buttons on mobile */}
        {!loggedInMember && role !== 'admin' && (
          <div className="flex items-center gap-1">
            {onRequestRegisterMember && (
              <button
                onClick={onRequestRegisterMember}
                style={{ color: primaryColor }}
                className="flex flex-col items-center justify-center py-1 px-1.5 rounded-xl transition-all font-semibold cursor-pointer"
                title="تسجيل منخرط جديد"
              >
                <UserPlus className="w-5 h-5" style={{ color: primaryColor }} />
                <span className="text-[10px] mt-0.5 whitespace-nowrap">انخراط</span>
              </button>
            )}
            {onRequestMemberLogin && (
              <button
                onClick={onRequestMemberLogin}
                className="flex flex-col items-center justify-center py-1 px-1.5 rounded-xl transition-all font-semibold text-slate-700 hover:text-slate-900 cursor-pointer"
                title="تسجيل الدخول"
              >
                <UserCheck className="w-5 h-5 text-slate-600" />
                <span className="text-[10px] mt-0.5 whitespace-nowrap">دخول</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
