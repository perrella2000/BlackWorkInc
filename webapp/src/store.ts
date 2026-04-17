import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { api, saveToken, clearToken } from './api';

export type Role = 'worker' | 'employer';
export type Language = 'ru' | 'uz' | 'tj' | 'kg';

export interface Job {
    id: string;
    title: string;
    salary: string;
    employer: string;
    employer_id?: string;
    dist: string;
    icon: string;
    description: string;
    skills: string[];
    rating: number;
    reviewsCount?: number;
    status?: string;
    created_at?: string;
}

export interface Review {
    id: string;
    author: string;
    text: string;
    rating: number; // 1-5
}

export interface Match {
    id: string;
    jobId: string;
    workerId: string;
    status: 'pending' | 'matched' | 'rejected';
    title?: string;
    icon?: string;
    salary?: string;
    employer_name?: string;
    worker_name?: string;
}

export interface Message {
    id: string;
    matchId: string;
    senderId: string;
    text: string;
    timestamp: number;
}

interface AppState {
    token: string | null;
    user: {
        id: string;
        phone: string;
        role: Role | null;
        skills: string[];
        name: string;
        language: Language;
        city: string;
        avatarEmoji: string;
        companyLogo?: string;
        companyName?: string;
        rating: number;
        reviews: Review[];
    } | null;
    jobs: Job[];
    matches: Match[];
    messages: Message[];

    // Actions
    init: () => Promise<void>;
    sendOtp: (phone: string) => Promise<string>;
    verifyOtp: (phone: string, code: string, role?: Role) => Promise<boolean>;
    setLanguage: (lang: Language) => void;
    setUser: (data: Partial<NonNullable<AppState['user']>>) => void;
    setRole: (role: Role) => void;
    toggleSkill: (skill: string) => void;

    fetchJobs: () => Promise<void>;
    addJob: (job: Omit<Job, 'id' | 'employer' | 'dist' | 'rating'>) => Promise<string>;
    updateJob: (id: string, data: Partial<Job>) => Promise<void>;
    deleteJob: (id: string) => Promise<void>;

    likeJob: (jobId: string) => Promise<string>;
    skipJob: (jobId: string) => Promise<void>;
    rejectMatch: (matchId: string) => void;

    fetchConversations: () => Promise<void>;
    fetchMessages: (matchId: string) => Promise<void>;
    sendMessage: (matchId: string, text: string) => void;
    addIncomingMessage: (msg: Message) => void;

    logout: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
    token: localStorage.getItem('bw_token'),
    user: null,
    jobs: [],
    matches: [],
    messages: [],

    init: async () => {
        const { token } = get();
        if (!token) return;
        try {
            const userData = await api.get<any>('/profile');
            set({
                user: {
                    ...userData,
                    city: userData.city || '',
                    skills: userData.skills || [],
                    avatarEmoji: userData.avatar_emoji || '👤',
                    companyName: userData.company_name,
                    companyLogo: userData.avatar_emoji,
                    reviews: []
                }
            });
            // Don't call fetchJobs/fetchConversations here, 
            // the components (Feed/Dashboard/Chats) will trigger them via effects
        } catch (err) {
            get().logout();
        }
    },

    sendOtp: async (phone) => {
        const res = await api.post<any>('/auth/send-otp', { phone });
        return res.dev_code || '';
    },

    verifyOtp: async (phone, code, role) => {
        const res = await api.post<any>('/auth/verify-otp', { phone, code, role });
        saveToken(res.token);
        set({ token: res.token });
        await get().init();
        return !!res.is_new;
    },

    setLanguage: (language) => {
        set((state) => ({
            user: state.user ? { ...state.user, language } : null
        }));
        if (get().token) api.put('/profile', { language });
    },

    setUser: (data) => {
        set((state) => ({
            user: state.user ? { ...state.user, ...data } : null
        }));
        const user = get().user;
        if (get().token && user) {
            api.put('/profile', {
                name: user.name,
                company_name: user.companyName,
                city: user.city,
                skills: user.skills,
                avatar_emoji: user.avatarEmoji,
                language: user.language,
                role: user.role
            });
        }
    },

    setRole: (role) => {
        set((state) => ({
            user: state.user ? { ...state.user, role } : null
        }));
        if (get().token) api.put('/profile', { role });
    },

    toggleSkill: (skill) => {
        const user = get().user;
        if (!user) return;
        const skills = user.skills.includes(skill)
            ? user.skills.filter(s => s !== skill)
            : [...user.skills, skill];
        set({ user: { ...user, skills } });
    },

    fetchJobs: async () => {
        const user = get().user;
        const path = user?.role === 'employer' ? '/employer/jobs' : '/jobs';
        try {
            // Add cache-buster to avoid stale lists
            const data = await api.get<any[]>(`${path}?t=${Date.now()}`);
            console.log(`💼 Fetched ${data.length} jobs from ${path} (User ID: ${user.id})`);
            set({
                jobs: data.map(j => ({
                    ...j,
                    dist: '1.2 км',
                }))
            });
        } catch (err) {
            console.error('❌ Failed to fetch jobs:', err);
        }
    },

    addJob: async (jobData) => {
        try {
            const res = await api.post<any>('/jobs', jobData);
            // Optimistic update: trigger fetch immediately but also wait a bit
            await get().fetchJobs();
            // Optional: fallback fetch after 500ms to ensure DB consistency
            setTimeout(() => get().fetchJobs(), 500);
            return res.id;
        } catch (err) {
            alert('Ошибка при создании вакансии');
            throw err;
        }
    },

    updateJob: async (id, data) => {
        try {
            await api.put(`/jobs/${id}`, data);
            await get().fetchJobs();
            setTimeout(() => get().fetchJobs(), 500);
        } catch (err) {
            alert('Ошибка при обновлении вакансии');
        }
    },

    deleteJob: async (id) => {
        await api.delete(`/jobs/${id}`);
        set((state) => ({
            jobs: state.jobs.filter(j => j.id !== id),
            matches: state.matches.filter(m => m.jobId !== id)
        }));
    },

    likeJob: async (jobId) => {
        const res = await api.post<any>(`/jobs/${jobId}/like`);
        if (res.conversation_id) {
            await get().fetchConversations();
            return res.conversation_id;
        }
        return '';
    },

    skipJob: async (jobId) => {
        await api.post(`/jobs/${jobId}/skip`);
    },

    rejectMatch: (matchId) => set((state) => ({
        matches: state.matches.filter(m => m.id !== matchId)
    })),

    fetchConversations: async () => {
        const data = await api.get<any[]>('/conversations');
        set({
            matches: data.map(m => ({
                id: m.id,
                jobId: m.job_id,
                workerId: m.worker_id,
                status: 'matched',
                title: m.title,
                icon: m.icon,
                salary: m.salary,
                employer_name: m.employer_name,
                worker_name: m.worker_name
            }))
        });
    },

    fetchMessages: async (matchId) => {
        const data = await api.get<any[]>(`/conversations/${matchId}/messages`);
        const msgs = data.map(m => ({
            id: m.id,
            matchId: matchId,
            senderId: m.sender_id,
            text: m.text,
            timestamp: new Date(m.created_at).getTime()
        }));
        set(state => ({
            messages: [...state.messages.filter(msg => msg.matchId !== matchId), ...msgs]
        }));
    },

    sendMessage: (matchId, text) => {
        // We don't add to state directly here, 
        // we wait for the WebSocket broadcast to ensure sync with DB.
        // But for UX, we could add a "pending" message.
        // For now, let's keep it simple and wait for broadcast.
        console.log('Sending message to', matchId, ':', text);
    },

    addIncomingMessage: (msg) => set(state => {
        if (state.messages.some(m => m.id === msg.id)) return state;
        return { messages: [...state.messages, msg] };
    }),

    logout: () => {
        clearToken();
        set({
            token: null,
            user: null,
            matches: [],
            messages: [],
            jobs: []
        });
    }
}));


// --- TRANSLATIONS ---
export const t = (key: string, lang: Language = 'ru') => {
    const dict: Record<Language, Record<string, string>> = {
        ru: {
            select_lang: 'Выберите язык',
            your_phone: 'Ваш телефон',
            sms_code: 'Код из SMS',
            get_code: 'Получить код',
            continue: 'Продолжить',
            role_title: 'Вы ищите работу или людей?',
            search_job: 'Ищу работу',
            need_people: 'Нужны люди',
            job_sub: 'Хочу выйти на смену сегодня',
            employer_sub: 'Разместить вакансию за 1 минуту',
            what_you_can: 'Что вы умеете?',
            your_company: 'Ваша компания',
            user_data: 'Ваши данные',
            your_name: 'Как вас зовут?',
            name_placeholder: 'Иван Иванов',
            your_city: 'В каком вы городе?',
            city_placeholder: 'Москва',
            company_name_placeholder: 'ООО СтройТех',
            done: 'Готово',
            vacancies: 'Вакансии',
            messages: 'Сообщения',
            profile: 'Профиль',
            dashboard: 'Кабинет',
            active_jobs: 'Активных вакансий',
            create_new: 'Создать новую',
            recent_responses: 'Недавние отклики',
            settings: 'Настройки',
            logout: 'Выйти',
            change_lang: 'Сменить язык',
            pro_account: 'PRO Аккаунт',
            upgrade: 'Улучшить',
            no_more_jobs: 'Больше вакансий нет :(',
            online: 'Онлайн',
            today: 'Сегодня',
            msg_placeholder: 'Сообщение...',
            add_photo: 'Добавить фото/лого',
            company_name: 'Название организации',
            objects_city: 'Город объектов',
            confirm_reject: 'Вы уверены, что хотите отказать?',
            confirm_delete: 'Вы уверены, что хотите удалить вакансию?',
            yes_reject: 'Да, отказать',
            yes_delete: 'Да, удалить',
            cancel: 'Отмена',
            job_title: 'Название вакансии',
            job_salary: 'Оплата за смену',
            job_desc: 'Описание обязанностей',
            publish: 'Опубликовать',
            save: 'Сохранить',
            edit: 'Редактировать',
            delete: 'Удалить',
            my_vacancies: 'Мои вакансии',
            confirm_skip: 'Пропустить эту вакансию?',
            yes_skip: 'Да, пропустить',
            edit_profile: 'Редактировать профиль'
        },
        uz: {
            select_lang: 'Tilni tanlang',
            your_phone: 'Telefon raqamingiz',
            sms_code: 'SMS kodi',
            get_code: 'Kodni olish',
            continue: 'Davom etish',
            role_title: 'Siz ish qidiryapsizmi yoki xodimlarmi?',
            search_job: 'Ish qidiryapman',
            need_people: 'Xodimlar kerak',
            job_sub: 'Bugun ishga chiqmoqchiman',
            employer_sub: '1 daqiqada vakansiya joylashtiring',
            what_you_can: 'Nima qila olasiz?',
            your_company: 'Sizning kompaniyangiz',
            done: 'Tayyor',
            vacancies: 'Vakansiyalar',
            messages: 'Xabarlar',
            profile: 'Profil',
            dashboard: 'Kabinet',
            active_jobs: 'Faol vakansiyalar',
            create_new: 'Yangisini yaratish',
            recent_responses: 'Yaqindagi murojaatlar',
            settings: 'Sozlamalar',
            logout: 'Chiqish',
            change_lang: 'Tilni o\'zgartirish',
            pro_account: 'PRO Hisob',
            upgrade: 'Yaxshilash',
            no_more_jobs: 'Boshqa vakansiyalar yo\'q :(',
            online: 'Onlayn',
            today: 'Bugun',
            msg_placeholder: 'Xabar yozing...',
            add_photo: 'Rasm qo\'shish',
            company_name: 'Tashkilot nomi',
            objects_city: 'Obyektlar shahri',
            confirm_reject: 'Rad etmoqchimisiz?',
            confirm_delete: 'Vakansiyani o\'chirib tashlamoqchimisiz?',
            yes_reject: 'Ha, rad etish',
            yes_delete: 'Ha, o\'chirish',
            cancel: 'Bekor qilish',
            job_title: 'Vakansiya nomi',
            job_salary: 'Smena uchun to\'lov',
            job_desc: 'Majburiyatlar tavsifi',
            publish: 'E\'lon qilish',
            save: 'Saqlash',
            edit: 'Tahrirlash',
            delete: 'O\'chirish',
            my_vacancies: 'Mening vakansiyalarim',
            confirm_skip: 'Bu vakansiyani o\'tkazib yuborasizmi?',
            yes_skip: 'Ha, o\'tkazib yuborish',
            edit_profile: 'Profilni tahrirlash',
            your_name: 'Ismingiz / FIO'
        },
        tj: {
            select_lang: 'Забонро интихоб кунед',
            your_phone: 'Рақами телефони шумо',
            sms_code: 'Рамзи SMS',
            get_code: 'Гирифтани рамз',
            continue: 'Идома додан',
            role_title: 'Шумо кор меҷӯед ё коргарон?',
            search_job: 'Кор меҷӯям',
            need_people: 'Коргарон лозиманд',
            job_sub: 'Мехоҳам имрӯз ба кор бароям',
            employer_sub: 'Дар 1 дақиқа эълон гузоред',
            what_you_can: 'Шумо чиро метавонед?',
            your_company: 'Ширкати шумо',
            done: 'Тайёр',
            vacancies: 'Ҷойҳои холӣ',
            messages: 'Паёмҳо',
            profile: 'Профил',
            dashboard: 'Кабинет',
            active_jobs: 'Ҷойҳои холии фаъол',
            create_new: 'Эҷод кардани нав',
            recent_responses: 'Ҷавобҳои охирин',
            settings: 'Танзимот',
            logout: 'Баромадан',
            change_lang: 'Иваз кардани забон',
            pro_account: 'PRO Ҳисоб',
            upgrade: 'Беҳтар кардан',
            no_more_jobs: 'Дигар ҷои холӣ нест :(',
            online: 'Онлайн',
            today: 'Имрӯз',
            msg_placeholder: 'Паём...',
            add_photo: 'Акс илова кунед',
            company_name: 'Номи ташкилот',
            objects_city: 'Шаҳри объектҳо',
            confirm_reject: 'Шумо мутмаин ҳастед?',
            confirm_delete: 'Оё шумо мехоҳед эълонро нест кунед?',
            yes_reject: 'Ҳа, рад кардан',
            yes_delete: 'Ҳа, нест кардан',
            cancel: 'Бекор кардан',
            job_title: 'Номи ҷойи холӣ',
            job_salary: 'Пардохт барои смена',
            job_desc: 'Тавсифи вазифаҳо',
            publish: 'Нашр кардан',
            save: 'Захира кардан',
            edit: 'Таҳрир кардан',
            delete: 'Нест кардан',
            my_vacancies: 'Ҷойҳои холии ман',
            confirm_skip: 'Ин ҷои холиро гузаронидан мехоҳед?',
            yes_skip: 'Ҳа, гузаронидан',
            edit_profile: 'Таҳрири профил',
            your_name: 'Номи шумо'
        },
        kg: {
            select_lang: 'Тилди тандаңыз',
            your_phone: 'Телефон номериңиз',
            sms_code: 'SMS коду',
            get_code: 'Код алуу',
            continue: 'Улантуу',
            role_title: 'Сиз жумуш издеп жатасызбы же жумушчуларбы?',
            search_job: 'Жумуш издеп жатам',
            need_people: 'Жумушчулар керек',
            job_sub: 'Бүгүн жумушка чыккым келет',
            employer_sub: '1 мүнөттө вакансия түзүңүз',
            what_you_can: 'Эмне кыла аласыз?',
            your_company: 'Сиздин компанияңыз',
            done: 'Даяр',
            vacancies: 'Вакансиялар',
            messages: 'Билдирүүлөр',
            profile: 'Профиль',
            dashboard: 'Кабинет',
            active_jobs: 'Активдүү вакансиялар',
            create_new: 'Жаңы түзүү',
            recent_responses: 'Акыркы кайрылуулар',
            settings: 'Жөндөөлөр',
            logout: 'Чыгуу',
            change_lang: 'Тилди которуу',
            pro_account: 'PRO Аккаунт',
            upgrade: 'Жакшыртуу',
            no_more_jobs: 'Башка вакансиялар жок :(',
            online: 'Онлайн',
            today: 'Бүгүн',
            msg_placeholder: 'Билдирүү...',
            add_photo: 'Сүрөт кошуу',
            company_name: 'Уюмдун аты',
            objects_city: 'Объекттердин шаары',
            confirm_reject: 'Чын эле баш тартасызбы?',
            confirm_delete: 'Вакансияны өчүрүүнү каалайсызбы?',
            yes_reject: 'Ооба, баш тартуу',
            yes_delete: 'Ооба, өчүрүү',
            cancel: 'Жок кылуу',
            job_title: 'Вакансиянын аталышы',
            job_salary: 'Смена үчүн төлөм',
            job_desc: 'Милдеттердин сүрөттөлүшү',
            publish: 'Жарыялоо',
            save: 'Сактоо',
            edit: 'Оңдоо',
            delete: 'Өчүрүү',
            my_vacancies: 'Менин вакансияларым',
            confirm_skip: 'Бул вакансияны өткөрүп жибересизби?',
            yes_skip: 'Ооба, өткөрүп жиберүү',
            edit_profile: 'Профилди оңдоо',
            your_name: 'Сиздин атыңыз / ФАА'
        }
    };
    return dict[lang][key] || dict['ru'][key] || key;
};
