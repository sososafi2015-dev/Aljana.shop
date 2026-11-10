import React from 'react';
import { motion } from 'motion/react';
import { X, ExternalLink, Download, FileText, Image as ImageIcon, Video as VideoIcon } from 'lucide-react';
import { Language } from '../types';
import { translations } from '../translations';
import { VideoPlayer } from '../utils/videoUtils';

interface MediaViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  mediaUrl: string;
  type: 'image' | 'video' | 'document';
  description?: string;
  lang: Language;
}

export const MediaViewerModal: React.FC<MediaViewerModalProps> = ({
  isOpen,
  onClose,
  title,
  mediaUrl,
  type,
  description,
  lang,
}) => {
  const t = translations[lang];

  if (!isOpen || !mediaUrl) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/90 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
              {type === 'image' && <ImageIcon className="w-5 h-5" />}
              {type === 'video' && <VideoIcon className="w-5 h-5" />}
              {type === 'document' && <FileText className="w-5 h-5" />}
            </div>
            <div>
              <h4 className="font-bold text-sm sm:text-base line-clamp-1">{title}</h4>
              <span className="text-xs text-slate-400">
                {type === 'image' ? (lang === 'ar' ? 'معاينة صورة الإثبات' : 'Photo Proof') : ''}
                {type === 'video' ? (lang === 'ar' ? 'فيديو توثيقي للنشاط' : 'Video Documentation') : ''}
                {type === 'document' ? (lang === 'ar' ? 'فاتورة / وصل معتمد' : 'Verified Document') : ''}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={mediaUrl}
              download={title || 'document'}
              className="p-2 rounded-lg bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white transition-colors flex items-center gap-1 text-xs font-bold"
              title="تحميل الملف"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">تحميل</span>
            </a>
            <a
              href={mediaUrl}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="فتح في نافذة جديدة"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/40 min-h-[350px]">
          {type === 'video' ? (
            <div className="w-full max-h-[65vh] rounded-lg overflow-hidden shadow-lg flex items-center justify-center">
              <VideoPlayer
                url={mediaUrl}
                title={title}
                autoPlay={true}
                className="w-full aspect-video max-h-[65vh]"
              />
            </div>
          ) : mediaUrl.startsWith('data:application/pdf') || mediaUrl.toLowerCase().includes('.pdf') ? (
            <div className="w-full h-[65vh] rounded-lg overflow-hidden bg-slate-800 shadow-lg">
              <iframe
                src={mediaUrl}
                title={title}
                className="w-full h-full border-0 rounded-lg"
              />
            </div>
          ) : mediaUrl.includes('word') || mediaUrl.endsWith('.doc') || mediaUrl.endsWith('.docx') ? (
            <div className="p-8 rounded-2xl bg-slate-800 border border-slate-700 text-center space-y-4 max-w-md mx-auto text-white">
              <div className="w-16 h-16 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
                <FileText className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-bold text-base">{title}</h3>
                <p className="text-xs text-slate-400 mt-1">مستند Word (DOC / DOCX) - جاهز للتحميل والاطلاع</p>
              </div>
              <a
                href={mediaUrl}
                download={title.endsWith('.docx') || title.endsWith('.doc') ? title : `${title}.docx`}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md"
              >
                <Download className="w-4 h-4" />
                <span>تحميل المستند الآن</span>
              </a>
            </div>
          ) : (
            <img
              src={mediaUrl}
              alt={title}
              className="max-h-[65vh] max-w-full object-contain rounded-lg shadow-lg"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&w=600&q=80';
              }}
            />
          )}
        </div>

        {description && (
          <div className="p-4 bg-slate-900 border-t border-slate-800 text-xs sm:text-sm text-slate-300">
            <p>{description}</p>
          </div>
        )}
      </motion.div>
    </div>
  );
};
