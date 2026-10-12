import React, { useState } from 'react';
import {
  Sparkles,
  Trophy,
  Rocket,
  BookOpen,
  ArrowRight,
  LogIn,
  GraduationCap
} from 'lucide-react';

interface HeroBannerProps {
  onOpenLogin: () => void;
  onExploreStats?: () => void;
}

// Fixed main background image uploaded by the user / project default
export const MAIN_HERO_IMAGE = '/hero-mongolian-student.jpg';

export const HeroBanner: React.FC<HeroBannerProps> = ({ onOpenLogin, onExploreStats }) => {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  return (
    <section className="relative overflow-hidden rounded-2xl md:rounded-3xl shadow-xl border border-slate-800/20 bg-slate-950 text-white min-h-[400px] sm:min-h-[450px] md:min-h-[490px] lg:min-h-[520px] flex items-center">
      {/* Background Image Layer: Full background with high quality rendering */}
      {!imgError && (
        <img
          src={MAIN_HERO_IMAGE}
          alt="Монгол сурагч хичээлээ хийж буй бодит зураг"
          referrerPolicy="no-referrer"
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgError(true)}
          className={`absolute inset-0 w-full h-full object-cover object-[70%_35%] sm:object-[75%_35%] md:object-[80%_40%] lg:object-[82%_42%] transition-opacity duration-1000 ${
            imgLoaded ? 'opacity-95' : 'opacity-0'
          }`}
        />
      )}

      {/* Fallback Graphic (smoothly visible while loading or if network fails) */}
      <div
        className={`absolute inset-0 bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 pointer-events-none transition-opacity duration-700 ${
          imgLoaded && !imgError ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#60a5fa_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 opacity-20 hidden md:block">
          <GraduationCap className="w-64 h-64 text-blue-300" />
        </div>
      </div>

      {/* Soft Dark Navy / Indigo Gradient Overlay ensuring comfortable left-side text contrast while keeping student clearly visible */}
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/95 sm:via-slate-950/85 md:via-blue-950/70 lg:via-blue-950/40 to-transparent pointer-events-none" />
      
      {/* Cinematic vignette */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-transparent to-slate-950/35 pointer-events-none" />

      {/* Content Container - Positioned on left */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-14 py-8 sm:py-12">
        <div className="max-w-xl lg:max-w-2xl space-y-5">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/15 backdrop-blur-md text-xs font-semibold text-blue-200 border border-white/20 transition-all shadow-inner">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Сургуулийн гэрийн даалгаврын цахим платформ</span>
          </div>

          {/* Main Title & Subtitles */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg ring-2 ring-white/20 shrink-0">
                <BookOpen className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white drop-shadow-md">
                Миний гэрийн даалгавар
              </h1>
            </div>

            <p className="text-base sm:text-lg font-bold text-blue-300 drop-shadow-xs pt-1">
              “Сурах, хийх, ахих хамтдаа!”
            </p>

            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium pt-0.5">
              Гэрийн даалгавраа хийж, сурлагын амжилтаа ахиулъя! Хэсгийн ахлагчийн шууд шалгалт, багшийн баталгаажуулалт, сурагчдын бодит ахиц.
            </p>
          </div>

          {/* 3 Pillars / Advantages */}
          <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 transition-transform hover:-translate-y-0.5">
              <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white leading-tight">Илүү сайн сурагч</div>
                <div className="text-[10px] text-slate-300">Өдөр тутмын хэвшил</div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 transition-transform hover:-translate-y-0.5">
              <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-400/30 shrink-0">
                <Trophy className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white leading-tight">Илүү өндөр амжилт</div>
                <div className="text-[10px] text-slate-300">Бодит гүйцэтгэл</div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 transition-transform hover:-translate-y-0.5">
              <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 shrink-0">
                <Rocket className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white leading-tight">Илүү гэрэлтэй ирээдүй</div>
                <div className="text-[10px] text-slate-300">Мэдлэг чадвар</div>
              </div>
            </div>
          </div>

          {/* Call to Actions */}
          <div className="pt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={onOpenLogin}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm transition-all shadow-lg shadow-blue-900/40 flex items-center gap-2 transform active:scale-95 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Системд нэвтрэх</span>
              <ArrowRight className="w-4 h-4 ml-0.5" />
            </button>

            {onExploreStats && (
              <button
                onClick={onExploreStats}
                className="px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm backdrop-blur-md border border-white/20 transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Үзүүлэлт, тайлан харах</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
