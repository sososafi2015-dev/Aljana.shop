import React from 'react';
import { ArrowRight, ArrowLeft, Store, Home } from 'lucide-react';
import { Language } from '../types';

interface BackToHomeButtonProps {
  onBack: () => void;
  lang?: Language;
  currentPageTitle?: string;
  parentPageTitle?: string;
  onParentClick?: () => void;
  customText?: string;
  className?: string;
  id?: string;
}

export const BackToHomeButton: React.FC<BackToHomeButtonProps> = ({
  onBack,
  lang = 'ar',
  currentPageTitle,
  parentPageTitle,
  onParentClick,
  customText,
  className = '',
  id = 'back-to-home-btn',
}) => {
  const isRtl = lang === 'ar';
  const BackArrow = isRtl ? ArrowRight : ArrowLeft;

  const defaultButtonText = lang === 'fr' 
    ? "Retour à l'accueil" 
    : lang === 'en' 
    ? 'Back to Store Home' 
    : 'الرجوع إلى واجهة المتجر الرئيسية';

  const buttonText = customText || defaultButtonText;

  const homeLabel = lang === 'fr' ? 'Accueil' : lang === 'en' ? 'Home' : 'الرئيسية';

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 mb-5 sm:mb-6 ${className}`}>
      <button
        type="button"
        id={id}
        onClick={onBack}
        className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white hover:bg-emerald-50/80 active:bg-emerald-100 text-slate-700 hover:text-emerald-900 border border-slate-200/90 hover:border-emerald-300 font-bold text-xs sm:text-sm shadow-xs hover:shadow-sm transition-all duration-200 cursor-pointer group select-none min-h-[44px]"
      >
        <span className="p-1 rounded-lg bg-emerald-50 text-emerald-700 group-hover:bg-emerald-100 transition-colors">
          <BackArrow className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-1 rtl:group-hover:translate-x-1" />
        </span>
        <span className="leading-none">{buttonText}</span>
      </button>

      {(currentPageTitle || parentPageTitle) && (
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 font-medium">
          <span className="flex items-center gap-1 text-slate-400">
            <Home className="w-3.5 h-3.5" />
            <span>{homeLabel}</span>
          </span>
          {parentPageTitle && (
            <>
              <span className="text-slate-300">/</span>
              {onParentClick ? (
                <button
                  type="button"
                  onClick={onParentClick}
                  className="hover:text-emerald-700 hover:underline cursor-pointer transition-colors"
                >
                  {parentPageTitle}
                </button>
              ) : (
                <span className="text-slate-600">{parentPageTitle}</span>
              )}
            </>
          )}
          {currentPageTitle && (
            <>
              <span className="text-slate-300">/</span>
              <span className="text-emerald-800 font-bold bg-emerald-50/60 px-2 py-0.5 rounded-md border border-emerald-100 max-w-[200px] sm:max-w-[280px] truncate">
                {currentPageTitle}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
};
