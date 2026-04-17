import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Briefcase, MapPin, MessageCircle, User, Globe, ChevronRight, Mic, Plus, Send, Settings, ArrowLeft, LogOut, Camera, Trash2, AlertCircle, Edit2, Star, Phone } from 'lucide-react';
import { useAppStore, t } from './store';
import type { Job, Language } from './store';
import { useWebSocket } from './useWebSocket';

type AppStep = 'language' | 'auth' | 'role' | 'onboarding' | 'main';

import React from 'react';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: any) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col h-screen p-8 bg-red-50 text-red-900 border-4 border-red-500 overflow-y-auto z-[9999] absolute inset-0">
          <h1 className="text-2xl font-black mb-4">CRASH DETECTED</h1>
          <pre className="text-xs whitespace-pre-wrap font-mono">{this.state.error?.stack || this.state.error?.toString()}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const user = useAppStore(s => s.user);
  const init = useAppStore(s => s.init);
  const [step, setStep] = useState<AppStep>('language');

  useEffect(() => {
    init().then(() => {
      // Only auto-redirect to main if we are at the initial language step
      // This prevents interrupting the auth/role selection flow
      if (user && (step === 'language')) {
        setStep('main');
      }
    });
  }, [init, !!user]); // Add step to dependencies if needed, but !!user is key

  const next = (s: AppStep) => setStep(s);

  return (
    <div className="flex flex-col h-screen w-full max-w-md mx-auto bg-slate-50 relative overflow-hidden font-sans shadow-2xl border-x border-slate-200">
      <ErrorBoundary>
        <AnimatePresence mode="wait">
          {step === 'language' && <LanguageStep key="lang" onSelect={() => next('auth')} />}
          {step === 'auth' && <AuthStep key="auth" onNext={() => next('role')} onSkipToMain={() => next('main')} />}
          {step === 'role' && <RoleStep key="role" onNext={() => next('onboarding')} />}
          {step === 'onboarding' && <OnboardingStep key="onboarding" onFinish={() => next('main')} />}
          {step === 'main' && <MainLayout key="main" onLogout={() => setStep('language')} />}
        </AnimatePresence>
      </ErrorBoundary>
    </div>
  );
}

// --- TRANSLATION HOOK ---
function useTranslation() {
  const lang = useAppStore(s => s.user?.language || 'ru');
  return (key: string) => t(key, lang);
}

// --- STEPS ---

function LanguageStep({ onSelect }: { onSelect: () => void }) {
  const setLanguage = useAppStore(s => s.setLanguage);
  const langs: { id: Language, name: string, flag: string, native: string }[] = [
    { id: 'ru', name: 'Русский', flag: '🇷🇺', native: 'Русский' },
    { id: 'uz', name: 'Oʻzbek', flag: '🇺🇿', native: 'Oʻzbekcha' },
    { id: 'tj', name: 'Тоҷикӣ', flag: '🇹🇯', native: 'Тоҷикӣ' },
    { id: 'kg', name: 'Кыргызча', flag: '🇰🇬', native: 'Кыргызча' },
  ];

  return (
    <StepWrapper title="Выберите язык / Tilni tanlang">
      <div className="grid grid-cols-1 gap-3 mt-8">
        {langs.map((l) => (
          <button key={l.id} onClick={() => { setLanguage(l.id); onSelect(); }} className="glass p-5 rounded-3xl flex items-center justify-between hover:bg-white active:scale-95 transition-all">
            <div className="flex items-center gap-4">
              <span className="text-3xl bg-white p-2 rounded-2xl shadow-sm">{l.flag}</span>
              <div className="text-left"><p className="text-lg font-black text-slate-800">{l.native}</p><p className="text-sm text-slate-400 font-bold">{l.name}</p></div>
            </div>
            <ChevronRight className="text-slate-300" />
          </button>
        ))}
      </div>
    </StepWrapper>
  );
}

function AuthStep({ onNext, onSkipToMain }: { onNext: () => void, onSkipToMain: () => void }) {
  const tr = useTranslation();
  const [phone, setPhone] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(1);
  const setUser = useAppStore(s => s.setUser);
  const role = useAppStore(s => s.user?.role);
  const sendOtp = useAppStore(s => s.sendOtp);
  const verifyOtp = useAppStore(s => s.verifyOtp);

  const handleSubmit = async () => {
    if (!showCode) {
      setShowCode(true);
      setStep(2);
    }
    if (step === 2) {
      setIsLoading(true);
      try {
        const devCode = await sendOtp(phone);
        if (devCode) setOtp(devCode);
        setStep(3);
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Ошибка');
      } finally {
        setIsLoading(false);
      }
    }
    if (step === 3) {
      if (otp.length < 6) return;
      setIsLoading(true);
      try {
        const isNew = await verifyOtp(phone, otp, role || 'worker');
        if (isNew) {
          onNext();
        } else {
          onSkipToMain();
        }
      } catch (err) {
        alert('Неверный код');
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <StepWrapper title={!showCode ? tr('your_phone') : tr('sms_code')}>
      <div className="mt-10 space-y-6">
        {!showCode ? (
          <div className="glass p-1 rounded-3xl flex items-center bg-white border border-slate-100 shadow-sm transition-all focus-within:ring-2 focus-within:ring-blue-100">
            <div className="pl-6 text-slate-400 font-black">+7</div>
            <input autoFocus type="tel" placeholder="900 000-00-00" className="flex-1 p-5 bg-transparent outline-none text-2xl font-black text-slate-800" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
        ) : (
          <div className="flex justify-between gap-3 px-2">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <input key={i} type="text" maxLength={1} className="w-12 h-16 glass text-center text-3xl font-black text-blue-600 rounded-2xl outline-none border border-slate-100 focus:border-blue-300 shadow-sm" value={otp[i - 1] || ''} onChange={(e) => setOtp(prev => prev.slice(0, i - 1) + e.target.value + prev.slice(i))} />
            ))}
          </div>
        )}
        <button disabled={isLoading} onClick={handleSubmit} className="w-full bg-blue-600 text-white p-6 rounded-3xl font-black text-xl shadow-xl shadow-blue-200 active:scale-95 transition-all">
          {isLoading ? '...' : (!showCode ? tr('get_code') : tr('continue'))}
        </button>
      </div>
    </StepWrapper>
  );
}

function RoleStep({ onNext }: { onNext: () => void }) {
  const tr = useTranslation();
  const setRole = useAppStore(s => s.setRole);
  const handleSelect = (r: 'worker' | 'employer') => {
    setRole(r);
    onNext();
  };

  return (
    <StepWrapper title={tr('role_title')}>
      <div className="mt-12 flex flex-col gap-5">
        <button onClick={() => handleSelect('worker')} className="glass p-8 rounded-[2.5rem] bg-white border-blue-50 border-2 text-center group active:scale-95 transition-all shadow-sm hover:shadow-md">
          <div className="text-8xl mb-4 group-hover:scale-110 transition-transform">👷</div>
          <h3 className="text-2xl font-black text-slate-800">{tr('search_job')}</h3>
          <p className="text-slate-400 mt-1 font-bold">{tr('job_sub')}</p>
        </button>
        <button onClick={() => handleSelect('employer')} className="glass p-8 rounded-[2.5rem] bg-white border-emerald-50 border-2 text-center group active:scale-95 transition-all shadow-sm hover:shadow-md">
          <div className="text-8xl mb-4 group-hover:scale-110 transition-transform">🏗️</div>
          <h3 className="text-2xl font-black text-slate-800">{tr('need_people')}</h3>
          <p className="text-slate-400 mt-1 font-bold">{tr('employer_sub')}</p>
        </button>
      </div>
    </StepWrapper>
  );
}

function OnboardingStep({ onFinish }: { onFinish: () => void }) {
  const tr = useTranslation();
  const user = useAppStore(s => s.user);
  const toggleSkill = useAppStore(s => s.toggleSkill);
  const setUser = useAppStore(s => s.setUser);

  const SKILLS = ['🏗️ Стройка', '📦 Склад', '🍲 Кухня', '🧹 Уборка', '🚛 Грузчик', '🛠️ Ремонт', '🌳 Садовник', '🎨 Маляр'];

  const handlePhotoClick = () => {
    setUser({ companyLogo: '🏗️' });
  };

  return (
    <StepWrapper title={tr('user_data')}>
      <div className="mt-8 flex-1 overflow-y-auto space-y-6">
        {/* Common Name Field */}
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1">{tr('your_name')}</p>
          <input placeholder={tr('name_placeholder')} className="w-full p-5 glass rounded-2xl outline-none font-extrabold border border-slate-100 shadow-sm" value={user?.name || ''} onChange={e => setUser({ name: e.target.value })} />
        </div>

        {/* Common City Field */}
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1">{tr('your_city')}</p>
          <input placeholder={tr('city_placeholder')} className="w-full p-5 glass rounded-2xl outline-none font-extrabold border border-slate-100 shadow-sm" value={user?.city || ''} onChange={e => setUser({ city: e.target.value })} />
        </div>

        {user?.role === 'worker' ? (
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-2">{tr('what_you_can')}</p>
            <div className="grid grid-cols-2 gap-3 pb-10">
              {SKILLS.map(s => (
                <button
                  key={s}
                  onClick={() => toggleSkill(s)}
                  className={`p-4 rounded-2xl font-black text-sm transition-all border-2 ${user.skills.includes(s) ? 'bg-blue-600 text-white border-blue-600 scale-105 shadow-md' : 'glass bg-white text-slate-600 border-transparent hover:border-blue-200'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1">{tr('company_name')}</p>
              <input placeholder={tr('company_name_placeholder')} className="w-full p-5 glass rounded-2xl outline-none font-extrabold border border-slate-100 shadow-sm" value={user?.companyName || ''} onChange={e => setUser({ companyName: e.target.value })} />
            </div>

            <div onClick={handlePhotoClick} className="p-10 glass rounded-3xl bg-blue-50/20 flex flex-col items-center justify-center border-dashed border-2 border-blue-100 cursor-pointer hover:bg-blue-50/40 transition-colors">
              {user?.companyLogo ? <span className="text-6xl">{user.companyLogo}</span> : <Camera className="text-blue-400 mb-2" size={40} />}
              <p className="text-blue-500 font-bold mt-2">{user?.companyLogo ? 'Сменить фото' : tr('add_photo')}</p>
            </div>
          </div>
        )}
      </div>
      <div className="pt-4 pb-8">
        <button onClick={onFinish} className="w-full bg-slate-800 text-white p-6 rounded-3xl font-black text-xl active:scale-95 transition-all shadow-xl">{tr('done')}</button>
      </div>
    </StepWrapper>
  );
}

// --- MAIN LAYOUT ---

function MainLayout({ onLogout }: { onLogout: () => void }) {
  const user = useAppStore(s => s.user);
  const matches = useAppStore(s => s.matches);
  const jobs = useAppStore(s => s.jobs);
  const [activeTab, setActiveTab] = useState<'feed' | 'chats' | 'profile'>('feed');
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Close chat automatically if match disappears (e.g. rejected)
  const activeMatchExists = useMemo(() => matches.some(m => m.id === activeChat), [matches, activeChat]);

  useEffect(() => {
    if (activeChat && !activeMatchExists && !activeChat.startsWith('sim_')) {
      setActiveChat(null);
    }
  }, [activeChat, activeMatchExists]);

  // Auto-open job creation for new employers
  useEffect(() => {
    if (user?.role === 'employer' && jobs.length === 0) {
      setShowCreate(true);
    }
  }, [user?.role, jobs.length]);

  if (activeChat) return <ChatView matchId={activeChat} onClose={() => setActiveChat(null)} />;

  return (
    <div className="flex flex-col h-full bg-slate-50 relative">
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'feed' && (
          user?.role === 'worker'
            ? <WorkerFeed onMatch={(id) => { setActiveChat(id); setActiveTab('chats'); }} />
            : <EmployerDashboard onCreate={() => setShowCreate(true)} onEdit={setEditingJob} onSelectChat={(id) => setActiveChat(id)} />
        )}
        {activeTab === 'chats' && <ChatList onSelectChat={setActiveChat} />}
        {activeTab === 'profile' && <ProfileView onLogout={onLogout} onSwitchRole={() => setActiveTab('feed')} />}
      </div>

      <nav className="glass border-t border-slate-100 flex justify-around p-4 px-8 rounded-t-[2.5rem] bg-white pb-8 shrink-0 shadow-lg">
        <NavButton active={activeTab === 'feed'} icon={<Briefcase />} onClick={() => setActiveTab('feed')} />
        <NavButton active={activeTab === 'chats'} icon={<MessageCircle />} onClick={() => setActiveTab('chats')} badge={matches.length} />
        <NavButton active={activeTab === 'profile'} icon={<User />} onClick={() => setActiveTab('profile')} />
      </nav>

      <AnimatePresence>
        {(showCreate || editingJob) && (
          <JobForm
            key={editingJob ? editingJob.id : 'new'}
            job={editingJob || undefined}
            onClose={() => { setShowCreate(false); setEditingJob(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function NavButton({ active, icon, onClick, badge }: any) {
  return (
    <button onClick={onClick} className={`relative p-3 rounded-2xl transition-all ${active ? 'bg-blue-600 text-white shadow-xl shadow-blue-100 scale-110' : 'text-slate-400 hover:text-slate-500'}`}>
      {icon}
      {badge > 0 && !active && <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] items-center justify-center flex font-black">{badge}</div>}
    </button>
  );
}

// --- WORKER FEED ---
function WorkerFeed({ onMatch }: { onMatch: (id: string) => void }) {
  const tr = useTranslation();
  const jobs = useAppStore(s => s.jobs);
  const fetchJobs = useAppStore(s => s.fetchJobs);
  const likeJob = useAppStore(s => s.likeJob);
  const skipJob = useAppStore(s => s.skipJob);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const [index, setIndex] = useState(0);
  const [confirmSkip, setConfirmSkip] = useState(false);

  const handleAction = async (dir: 'left' | 'right') => {
    const currentJob = jobs[index];
    if (!currentJob) return;
    if (dir === 'right') {
      const convId = await likeJob(currentJob.id);
      if (convId) onMatch(convId);
    } else {
      await skipJob(currentJob.id);
    }
    setIndex(i => i + 1);
  };

  const handleSkip = () => {
    setConfirmSkip(true);
  };

  if (index >= jobs.length) return <div className="h-full flex items-center justify-center text-slate-300 font-black italic text-center p-10">{tr('no_more_jobs')}</div>;

  const current = jobs[index];

  return (
    <div className="h-full flex flex-col p-6 relative">
      <header className="flex justify-between items-center mb-6 pt-6 shrink-0">
        <h2 className="text-2xl font-black text-slate-800">{tr('vacancies')}</h2>
        <div className="glass p-2 px-3 rounded-2xl flex items-center gap-1 bg-white border border-slate-100 shadow-sm"><MapPin size={14} className="text-blue-500" /><span className="text-xs font-bold text-slate-500">Москва</span></div>
      </header>

      <div className="flex-1 relative flex items-center justify-center overflow-hidden w-full touch-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, { offset }) => {
              if (offset.x < -80 && index < jobs.length - 1) setIndex(i => i + 1);
              else if (offset.x > 80 && index > 0) setIndex(i => i - 1);
            }}
            initial={{ scale: 0.9, opacity: 0, x: 200 }}
            animate={{ scale: 1, opacity: 1, x: 0 }}
            exit={{ scale: 0.9, opacity: 0, x: -200 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute inset-x-0 h-[450px] mx-2 glass bg-white rounded-[3.5rem] p-10 flex flex-col items-center justify-center shadow-2xl border border-white cursor-grab active:cursor-grabbing"
          >
            <div className="text-[100px] mb-6 drop-shadow-xl select-none">{current.icon}</div>
            <h3 className="text-3xl font-black text-slate-800 text-center leading-tight select-none">{current.title}</h3>
            <div className="mt-4 px-6 py-2 bg-emerald-100 text-emerald-700 rounded-2xl font-black text-2xl select-none">{current.salary}</div>
            <div className="mt-8 flex flex-col items-center gap-1 text-slate-400 font-bold select-none">
              <span>🏢 {current.employer}</span>
              <span className="text-amber-500 font-black text-sm drop-shadow-sm">⭐ {current.rating?.toFixed(1) || '5.0'} <span className="text-slate-300 text-xs font-bold ml-1 hover:underline cursor-pointer">({current.reviewsCount || 0} отзывов)</span></span>
              <span className="mt-1">📍 {current.dist}</span>
            </div>

            <div className="absolute bottom-6 flex gap-2">
              {jobs.map((_, idx) => (
                <div key={idx} className={`w-2 h-2 rounded-full ${idx === index ? 'bg-blue-500' : 'bg-slate-200'}`} />
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="py-8 flex justify-center gap-8 mb-4 shrink-0">
        <button onClick={() => handleAction('left')} className="w-20 h-20 glass bg-white rounded-full flex items-center justify-center text-red-500 text-3xl shadow-lg border border-red-50 active:scale-90 transition-transform">X</button>
        <button onClick={() => handleAction('right')} className="w-20 h-20 glass bg-white rounded-full flex items-center justify-center text-emerald-500 text-3xl shadow-lg border border-emerald-50 active:scale-95 transition-transform">✓</button>
      </div>

      <p className="text-center text-xs font-bold text-slate-400 pb-2">Листайте ↔ чтобы посмотреть другие</p>

      <AnimatePresence>
        {confirmSkip && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm glass bg-white p-8 rounded-[2.5rem] shadow-2xl text-center">
              <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6"><X size={40} /></div>
              <h3 className="text-xl font-black text-slate-800">{tr('confirm_skip')}</h3>
              <div className="mt-8 flex flex-col gap-3">
                <button onClick={() => { setIndex(i => i + 1); setConfirmSkip(false); }} className="w-full bg-red-500 text-white p-5 rounded-2xl font-black text-sm active:scale-95 transition-all shadow-lg shadow-red-100">{tr('yes_skip')}</button>
                <button onClick={() => setConfirmSkip(false)} className="w-full p-5 font-black text-slate-400 text-sm border-2 border-slate-50 rounded-2xl bg-slate-100/50">{tr('cancel')}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- EMPLOYER DASHBOARD ---
function EmployerDashboard({ onCreate, onEdit, onSelectChat }: { onCreate: () => void, onEdit: (j: Job) => void, onSelectChat: (id: string) => void }) {
  const tr = useTranslation();
  const jobs = useAppStore(s => s.jobs);
  const matches = useAppStore(s => s.matches);
  const fetchJobs = useAppStore(s => s.fetchJobs);
  const fetchConversations = useAppStore(s => s.fetchConversations);

  useEffect(() => {
    fetchJobs();
    fetchConversations();
  }, [fetchJobs, fetchConversations]);

  const [confirmData, setConfirmData] = useState<{ id: string, type: 'match' | 'job' } | null>(null);

  return (
    <div className="p-6 pt-12 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-black text-slate-800">{tr('dashboard')}</h1>
        <button className="bg-slate-200 text-slate-500 p-3 rounded-2xl hover:bg-slate-300 transition-colors"><Settings size={20} /></button>
      </div>

      <div className="bg-blue-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-blue-200 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10"><Briefcase size={80} /></div>
        <p className="text-blue-100 font-bold">{tr('active_jobs')}</p>
        <h2 className="text-5xl font-black mt-1">{jobs.length}</h2>
        <button onClick={onCreate} className="mt-6 w-full bg-white/20 backdrop-blur-md p-4 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-white/30 transition-all">
          <Plus size={20} /> {tr('create_new')}
        </button>
      </div>

      <h3 className="text-xl font-black text-slate-800 pt-4 uppercase text-[10px] tracking-widest text-slate-400">{tr('my_vacancies')}</h3>
      <div className="space-y-3">
        {jobs.map(j => (
          <div key={j.id} className="glass p-4 rounded-3xl flex items-center justify-between bg-white border border-slate-50 shadow-sm transition-all group">
            <div className="flex items-center gap-3">
              <div className="text-3xl">{j.icon}</div>
              <div>
                <p className="font-black text-slate-800 text-sm leading-tight">{j.title}</p>
                <p className="text-xs font-bold text-emerald-500 underline decoration-emerald-200 mt-1">{j.salary}</p>
              </div>
            </div>
            <div className="flex gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
              <button onClick={() => onEdit(j)} className="p-2.5 rounded-xl bg-slate-100 text-slate-400 hover:bg-blue-100 hover:text-blue-600 transition-colors"><Edit2 size={16} /></button>
              <button onClick={() => setConfirmData({ id: j.id, type: 'job' })} className="p-2.5 rounded-xl bg-slate-100 text-slate-400 hover:bg-red-100 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
      </div>

      <h3 className="text-xl font-black text-slate-800 pt-6">{tr('recent_responses')}</h3>
      <div className="space-y-4 pb-20">
        {matches.length === 0 ? (
          <div className="p-12 text-center text-slate-300 font-bold border-2 border-dashed border-slate-100 rounded-[2.5rem]">Пока нет откликов</div>
        ) : matches.map(m => (
          <div key={m.id} className="glass p-5 rounded-3xl flex items-center justify-between group hover:bg-white transition-all border border-slate-50 shadow-sm">
            <div className="flex items-center gap-4 cursor-pointer" onClick={() => onSelectChat(m.id)}>
              <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center text-2xl shadow-inner relative">
                👷
              </div>
              <div>
                <p className="font-black text-slate-800 leading-tight flex items-center gap-2">Рабочий #{m.id.slice(0, 4)} <span className="text-amber-500 font-black text-xs drop-shadow-sm flex items-center gap-0.5"><Star size={10} fill="currentColor" /> {(4.5 + Math.random() * 0.5).toFixed(1)}</span></p>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 tracking-wider">Отклик на вашу вакансию</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={(e) => { e.stopPropagation(); setConfirmData({ id: m.id, type: 'match' }); }} className="w-12 h-12 rounded-full glass bg-red-50 flex items-center justify-center text-red-400 hover:bg-red-500 hover:text-white transition-all shadow-sm"><X size={20} /></button>
              <button onClick={() => onSelectChat(m.id)} className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold shadow-md hover:scale-110 transition-transform leading-none">✓</button>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {confirmData && (
          <ConfirmModal
            data={confirmData}
            onClose={() => setConfirmData(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --- MODALS & FORMS ---

function ConfirmModal({ data, onClose }: { data: { id: string, type: 'match' | 'job' }, onClose: () => void }) {
  const tr = useTranslation();
  const rejectMatch = useAppStore(s => s.rejectMatch);
  const deleteJob = useAppStore(s => s.deleteJob);

  const handleConfirm = () => {
    if (data.type === 'match') rejectMatch(data.id);
    else deleteJob(data.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-sm glass bg-white p-8 rounded-[2.5rem] shadow-2xl text-center">
        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6"><AlertCircle size={40} /></div>
        <h3 className="text-xl font-black text-slate-800">{data.type === 'match' ? tr('confirm_reject') : tr('confirm_delete')}</h3>
        <div className="mt-8 flex flex-col gap-3">
          <button onClick={handleConfirm} className="w-full bg-red-500 text-white p-5 rounded-2xl font-black text-sm active:scale-95 transition-all shadow-lg shadow-red-100">{data.type === 'match' ? tr('yes_reject') : tr('yes_delete')}</button>
          <button onClick={onClose} className="w-full p-5 font-black text-slate-400 text-sm border-2 border-slate-50 rounded-2xl">{tr('cancel')}</button>
        </div>
      </motion.div>
    </div>
  );
}

function JobForm({ job, onClose }: { job?: Job, onClose: () => void }) {
  const tr = useTranslation();
  const addJob = useAppStore(s => s.addJob);
  const updateJob = useAppStore(s => s.updateJob);
  const [title, setTitle] = useState(job?.title || '');
  const [salary, setSalary] = useState(job?.salary || '');
  const [desc, setDesc] = useState(job?.description || '');

  const handlePublish = () => {
    if (!title || !salary) return;
    if (job) updateJob(job.id, { title, salary, description: desc });
    else addJob({ title, salary, description: desc, icon: '👷', skills: [] });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col">
      <header className="p-6 pt-12 flex items-center gap-4 bg-white border-b border-slate-100 shadow-sm shrink-0">
        <button onClick={onClose} className="p-2 text-slate-800 active:scale-90 transition-transform"><ArrowLeft /></button>
        <h2 className="text-2xl font-black text-slate-800">{job ? tr('edit') : tr('create_new')}</h2>
      </header>
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="space-y-5">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1">{tr('job_title')}</p>
            <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Напр: Грузчик 24/7" className="w-full p-5 shadow-inner rounded-3xl outline-none font-bold text-slate-700 bg-white border border-slate-100 focus:border-blue-300 transition-all" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1">{tr('job_salary')}</p>
            <input value={salary} onChange={e => setSalary(e.target.value)} placeholder="3000 ₽" className="w-full p-5 shadow-inner rounded-3xl outline-none font-bold text-slate-700 bg-white border border-slate-100 focus:border-blue-300 transition-all" />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1">{tr('job_desc')}</p>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={6} placeholder="Расскажите о работе..." className="w-full p-5 shadow-inner rounded-3xl outline-none font-bold text-slate-700 bg-white border border-slate-100 focus:border-blue-300 transition-all resize-none font-medium" />
          </div>
        </div>
        <button onClick={handlePublish} className="w-full bg-slate-900 text-white p-6 rounded-[2rem] font-black text-xl shadow-xl active:scale-95 transition-all">{job ? tr('save') : tr('publish')}</button>
      </div>
    </div>
  );
}

// --- CHATS ---
function ChatList({ onSelectChat }: { onSelectChat: (id: string) => void }) {
  const tr = useTranslation();
  const matches = useAppStore(s => s.matches);
  const jobs = useAppStore(s => s.jobs);

  return (
    <div className="p-6 pt-12">
      <h1 className="text-3xl font-black text-slate-800 mb-8">{tr('messages')}</h1>
      {matches.length === 0 ? (
        <div className="mt-20 text-center text-slate-300">
          <MessageCircle size={64} className="mx-auto mb-4 opacity-20" />
          <p className="font-bold">Пока нет активных диалогов</p>
        </div>
      ) : (
        <div className="space-y-4">
          {matches.map(m => {
            const job = jobs.find(j => j.id === m.jobId);
            return (
              <div key={m.id} onClick={() => onSelectChat(m.id)} className="glass group bg-white shadow-sm p-5 rounded-3xl flex items-center gap-4 hover:shadow-md transition-all active:scale-95 cursor-pointer border border-slate-50">
                <div className="text-4xl filter group-hover:scale-110 transition-transform">{job?.icon || '👷'}</div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex justify-between items-start">
                    <p className="font-black text-slate-800 uppercase text-xs tracking-wide">{job?.employer || 'Работодатель'}</p>
                    <span className="text-[10px] font-black text-slate-300 uppercase">2 мин</span>
                  </div>
                  <p className="text-sm font-bold text-slate-500 mt-0.5 truncate">{job?.title || 'Вакансия удалена'}</p>
                  <p className="text-xs text-slate-400 font-medium truncate mt-1 italic">Ожидает ответа...</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChatView({ matchId, onClose }: { matchId: string, onClose: () => void }) {
  const tr = useTranslation();
  const [text, setText] = useState('');
  const [showReviews, setShowReviews] = useState(false);

  // Fix Zustand infinite loop: select the messages array directly, filter in the component
  const allMessages = useAppStore(s => s.messages);
  const messages = useMemo(() => allMessages.filter(m => m.matchId === matchId), [allMessages, matchId]);

  const sendMessage = useAppStore(s => s.sendMessage);
  const jobs = useAppStore(s => s.jobs);
  const matches = useAppStore(s => s.matches);
  const isWorker = useAppStore(s => s.user?.role === 'worker');

  const currentMatch = matches.find(m => m.id === matchId);
  const job = jobs.find(j => j.id === currentMatch?.jobId) || { icon: '⚠️', employer: 'Система', title: 'Информация недоступна', rating: 5.0, reviewsCount: 0 };

  const { send } = useWebSocket();

  const handleSend = () => {
    if (!text.trim()) return;
    send(matchId, text);
    setText('');
  };

  const otherUser = isWorker ? {
    role: 'employer',
    companyLogo: job.icon,
    companyName: job.employer,
    rating: job.rating || 5.0,
    reviews: Array.from({ length: job.reviewsCount || 10 }, (_, i) => ({ id: String(i), author: 'Рабочий', rating: 5, text: 'Отличный работодатель, рекомендую.' }))
  } : {
    role: 'worker',
    companyLogo: '👷',
    name: `Рабочий #${matchId.slice(0, 4)}`,
    rating: 4.8,
    reviews: [{ id: '1', author: 'ООО СтройГрупп', text: 'Пунктуальный и ответственный.', rating: 5 }]
  };

  return (
    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed inset-0 z-50 bg-slate-50 flex flex-col max-w-md mx-auto shadow-2xl">
      <header className="p-6 pt-12 flex items-center justify-between border-b border-slate-100 bg-white shadow-sm shrink-0">
        <div className="flex items-center gap-4 flex-1 cursor-pointer hover:bg-slate-50 p-2 -ml-2 rounded-2xl transition-colors" onClick={() => setShowReviews(true)}>
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-2 text-slate-800 active:scale-90 transition-transform"><ArrowLeft /></button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-xl shadow-inner">{isWorker ? job.icon : '👷'}</div>
            <div className="flex-1 overflow-hidden text-left">
              <p className="font-black text-slate-800 leading-none truncate">{isWorker ? job.employer : `Рабочий #${matchId.slice(0, 4)}`}</p>
              <p className="text-[10px] font-bold text-emerald-500 uppercase mt-1 tracking-widest">{tr('online')}</p>
            </div>
          </div>
        </div>
        <button className="p-3 bg-slate-50 rounded-full text-slate-400 active:scale-90 transition-transform"><Phone size={18} fill="currentColor" /></button>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="flex justify-center my-4"><span className="text-[10px] font-black text-slate-300 bg-white border border-slate-100 px-4 py-1 rounded-full uppercase">{tr('today')}</span></div>

        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs shrink-0 shadow-sm">{isWorker ? job.icon : '👷'}</div>
          <div className="bg-white p-4 rounded-3xl rounded-tl-none max-w-[80%] shadow-sm border border-slate-100">
            <p className="text-slate-700 font-bold text-sm leading-relaxed">{isWorker ? `Здравствуйте! Вижу ваш отклик на вакансию "${job.title}". Завтра можете выйти?` : `Здравствуйте, готов выйти на смену "${job.title}".`}</p>
          </div>
        </div>

        {messages.map(m => (
          <div key={m.id} className="flex justify-end mt-2">
            <div className="bg-blue-600 text-white p-4 rounded-3xl rounded-tr-none max-w-[80%] shadow-lg shadow-blue-100 animate-in fade-in slide-in-from-right-2">
              <p className="font-bold text-sm leading-relaxed">{m.text}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 bg-white border-t border-slate-100">
        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-[2rem]">
          <button className="p-3 text-slate-400 hover:text-blue-500 transition-colors"><Plus size={20} /></button>
          <input
            value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            placeholder={tr('msg_placeholder') as string}
            className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-slate-700 placeholder:text-slate-400"
          />
          {text.trim() ? (
            <button onClick={handleSend} className="p-3 bg-blue-600 text-white rounded-full shadow-md active:scale-90 transition-all"><Send size={16} /></button>
          ) : (
            <button className="p-3 text-slate-400 hover:text-blue-500 transition-colors"><Mic size={20} /></button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showReviews && <ReviewsModal user={otherUser} onClose={() => setShowReviews(false)} />}
      </AnimatePresence>
    </motion.div>
  );
}
// --- PROFILE VIEW ---
function ProfileView({ onLogout, onSwitchRole }: { onLogout: () => void, onSwitchRole: () => void }) {
  const tr = useTranslation();
  const user = useAppStore(s => s.user);
  const setLanguage = useAppStore(s => s.setLanguage);
  const logout = useAppStore(s => s.logout);
  const setRole = useAppStore(s => s.setRole);
  const [isEditing, setIsEditing] = useState(false);
  const [showReviews, setShowReviews] = useState(false);

  const handleLogout = () => {
    logout();
    onLogout();
  };

  const handleToggleRole = () => {
    const newRole = user?.role === 'worker' ? 'employer' : 'worker';
    setRole(newRole as any);
    onSwitchRole();
  };

  return (
    <div className="p-6 pt-12 overflow-y-auto h-full pb-24">
      <div className="flex flex-col items-center text-center">
        <div className="w-32 h-32 rounded-[3.5rem] glass bg-white shadow-2xl flex items-center justify-center text-6xl mb-4 border-4 border-white overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
          {user?.role === 'worker' ? (user?.companyLogo || '👤') : (user?.companyLogo || '🏢')}
        </div>
        <div className="flex items-center justify-center gap-2 mt-2">
          <h2 className="text-2xl font-black text-slate-800">{user?.role === 'employer' ? (user.companyName || 'Прораб') : user?.name}</h2>
          <button onClick={() => setIsEditing(true)} className="p-2 text-slate-400 bg-white rounded-full shadow-sm hover:text-blue-500 hover:bg-blue-50 active:scale-90 transition-all"><Edit2 size={14} /></button>
        </div>
        <div onClick={() => setShowReviews(true)} className="flex items-center gap-1 mt-1 text-amber-500 font-black cursor-pointer hover:scale-105 active:scale-95 transition-transform bg-amber-50 px-3 py-1 rounded-full shadow-sm border border-amber-100">
          <span><Star size={12} fill="currentColor" className="inline-block relative -top-[1px]" /> {user?.rating?.toFixed(1) || '5.0'}</span>
          <span className="text-slate-400 text-[10px] font-bold underline ml-1">({user?.reviews?.length || 0} отзывов)</span>
        </div>
        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mt-2">{user?.phone || '+7 900 000-00-00'}</p>
        <div className={`mt-3 px-4 py-1.5 rounded-full text-[10px] font-black uppercase ${user?.role === 'worker' ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
          {user?.role === 'worker' ? tr('search_job') : tr('need_people')}
        </div>
      </div>

      <div className="mt-10 space-y-3">
        <button onClick={handleToggleRole} className="w-full glass p-5 rounded-3xl flex items-center justify-between bg-white hover:shadow-md active:scale-95 transition-all border border-slate-50">
          <div className="flex items-center gap-4"><Briefcase size={20} className={user?.role === 'worker' ? 'text-blue-500' : 'text-emerald-500'} /> <span className="font-black text-slate-700 text-sm">Сменить на {user?.role === 'worker' ? tr('need_people') : tr('search_job')}</span></div>
          <ChevronRight className="text-slate-300" size={16} />
        </button>

        <div className="glass p-5 rounded-3xl flex flex-col gap-4 bg-white border border-slate-50 shadow-sm">
          <div className="flex items-center gap-4"><Globe size={20} className="text-slate-400" /> <span className="font-black text-slate-700 text-sm">{tr('change_lang')}</span></div>
          <div className="flex gap-2">
            {(['ru', 'uz', 'tj', 'kg'] as Language[]).map(l => (
              <button
                key={l}
                onClick={() => setLanguage(l)}
                className={`flex-1 p-3 rounded-xl text-xs font-black transition-all ${user?.language === l ? 'bg-slate-800 text-white scale-105 shadow-md' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="p-8 mt-6 rounded-[2.5rem] bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-100 flex flex-col items-center text-center shadow-inner group">
          <div className="text-4xl mb-2 group-hover:scale-125 transition-transform">⭐</div>
          <p className="text-orange-900 font-black tracking-tight">{tr('pro_account')}</p>
          <p className="text-orange-700 text-[10px] font-bold mt-1 opacity-70">Безлимитные отклики и приоритет</p>
          <button className="mt-6 w-full bg-orange-500 text-white px-8 py-4 rounded-2xl font-black text-sm shadow-xl shadow-orange-200 active:scale-95 transition-all">{tr('upgrade')} 199 ₽</button>
        </div>

        <button onClick={handleLogout} className="w-full mt-6 flex items-center justify-center gap-2 p-5 text-red-500 font-black text-sm hover:bg-red-50 rounded-3xl transition-colors">
          <LogOut size={18} /> {tr('logout')}
        </button>
      </div>

      <AnimatePresence>
        {isEditing && <EditProfileModal onClose={() => setIsEditing(false)} />}
        {showReviews && <ReviewsModal user={user} onClose={() => setShowReviews(false)} />}
      </AnimatePresence>
    </div>
  );
}

function EditProfileModal({ onClose }: { onClose: () => void }) {
  const tr = useTranslation();
  const user = useAppStore(s => s.user);
  const setUser = useAppStore(s => s.setUser);

  const isWorker = user?.role === 'worker';
  const initialName = isWorker ? user?.name : user?.companyName;
  const initialPhoto = isWorker ? (user?.companyLogo || '👤') : (user?.companyLogo || '🏢');

  const [name, setName] = useState(initialName || '');
  const [photo, setPhoto] = useState(initialPhoto);

  const handleSave = () => {
    if (isWorker) {
      setUser({ name, companyLogo: photo });
    } else {
      setUser({ companyName: name, companyLogo: photo });
    }
    onClose();
  };

  const avatars = isWorker ? ['👤', '👨‍💻', '👷', '👨‍🔧', '👨‍🏭', '🚀', '⚡'] : ['🏢', '🏗️', '🏭', '🏪', '🚜', '🚚', '🏘️'];

  return (
    <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed inset-0 z-[150] bg-slate-50 flex flex-col shadow-2xl rounded-t-[3rem] mt-4">
      <header className="p-6 pt-8 flex items-center justify-between bg-white shrink-0 shadow-sm rounded-t-[3rem]">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 text-slate-800 active:scale-90 transition-transform"><ArrowLeft /></button>
          <h2 className="text-2xl font-black text-slate-800">{tr('edit_profile')}</h2>
        </div>
        <button onClick={handleSave} className="font-black text-blue-600 bg-blue-50 px-4 py-2 rounded-xl active:scale-95 transition-transform">{tr('save')}</button>
      </header>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="flex flex-col items-center">
          <div className="w-32 h-32 rounded-[3.5rem] glass bg-white shadow-2xl flex items-center justify-center text-6xl mb-4 border-4 border-white bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
            {photo}
          </div>
          <div className="flex gap-3 flex-wrap justify-center mt-4">
            {avatars.map(a => (
              <button key={a} onClick={() => setPhoto(a)} className={`text-4xl p-4 bg-white rounded-[2rem] glass shadow-sm hover:scale-110 active:scale-95 transition-all ${photo === a ? 'ring-4 ring-blue-500 scale-110 shadow-lg' : ''}`}>{a}</button>
            ))}
          </div>
        </div>

        <div className="mt-10">
          <p className="text-[10px] font-black text-slate-400 uppercase ml-2 mb-1">{isWorker ? tr('your_name') : tr('company_name')}</p>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Иван Иванов" className="w-full p-5 shadow-inner rounded-3xl outline-none font-bold text-slate-700 bg-white border border-slate-100 focus:border-blue-300 transition-all text-xl" />
        </div>
      </div>
    </motion.div>
  );
}

function ReviewsModal({ user, onClose }: { user: any, onClose: () => void }) {
  return (
    <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }} className="fixed inset-0 z-[200] bg-slate-50 flex flex-col shadow-2xl rounded-t-[3rem] mt-4">
      <header className="p-6 pt-8 flex items-center justify-between bg-white shrink-0 shadow-sm rounded-t-[3rem]">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 text-slate-800 active:scale-90 transition-transform"><ArrowLeft /></button>
          <h2 className="text-2xl font-black text-slate-800">Отзывы</h2>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
        <div className="flex items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-50 mb-6">
          <div className="text-5xl">{user.role === 'worker' ? (user.companyLogo || '👤') : (user.companyLogo || '🏢')}</div>
          <div>
            <h3 className="font-black text-xl">{user.role === 'employer' ? (user.companyName || 'Прораб') : user.name}</h3>
            <div className="flex items-center gap-1 mt-1 text-amber-500 font-black">
              <Star size={16} fill="currentColor" /> {user.rating?.toFixed(1) || '5.0'}
            </div>
          </div>
        </div>

        <h3 className="font-black text-slate-800 mb-4">{user.reviews?.length || 0} оценок</h3>
        {!user.reviews || user.reviews.length === 0 ? (
          <div className="p-8 text-center text-slate-400 font-bold border-2 border-dashed border-slate-200 rounded-3xl">Пока нет отзывов</div>
        ) : (
          <div className="space-y-4 pb-20">
            {user.reviews.map((r: any) => (
              <div key={r.id} className="glass bg-white p-5 rounded-3xl shadow-sm border border-slate-50">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-black text-slate-800">{r.author}</p>
                  <div className="flex text-amber-500 gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} size={12} fill={i < r.rating ? 'currentColor' : 'none'} className={i < r.rating ? '' : 'text-slate-300'} />
                    ))}
                  </div>
                </div>
                <p className="text-sm font-medium text-slate-600">{r.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// --- UTILS ---
function StepWrapper({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -300, opacity: 0 }}
      className="p-8 pt-20 h-full flex flex-col overflow-hidden"
    >
      <h2 className="text-3xl font-black text-slate-800 leading-tight pr-4 shrink-0 transition-colors">{title}</h2>
      <div className="flex-1 overflow-y-auto mt-4 pr-1">
        {children}
      </div>
    </motion.div>
  );
}
