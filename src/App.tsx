import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { LogOut, ShieldCheck, Building2 } from 'lucide-react';
import { ArsAuthSession, ArsDataset, ArsReferences, ChatMessage } from './types/ars';
import { AnalystWorkspace } from './components/AnalystWorkspace';
import { PlanSummaryView } from './components/PlanSummaryView';
import { DislocationView } from './components/DislocationView';
import { WheelPairsView } from './components/WheelPairsView';
import { DailyOutputView } from './components/DailyOutputView';
import { ReferencesModal, DEFAULT_ARS_REFERENCES, loadInitialRepairTypes } from './components/ReferencesModal';
import { LoginModal } from './components/LoginModal';
import { AuditLogModal } from './components/AuditLogModal';
import { enrichDataset, generateAnalyticalAnswer } from './utils/arsEngine';
import arsDatasetFallback from './data/ars_dataset.json';

type ActiveTab = 'analyst' | 'plans' | 'dislocation' | 'wheelsets' | 'daily';

const STORAGE_KEY_REFS = 'ars_references_2026_v1';
const STORAGE_KEY_AUTH = 'ars_auth_session_2026_v1';

interface KpiPresetItem {
  label: string;
  plan: number;
  planPctNum: number;
  planSub: string;
  fact: number;
  pct: string;
  factSub: string;
  variance: number;
  varSub: string;
  ktt: number;
  own: number;
  parkSub: string;
  unfinished: number;
  unfinishedSub: string;
  ytd: string;
  ytdSub: string;
}

const BRANCH_KPI_PRESETS: Record<string, KpiPresetItem> = {
  ALL: {
    label: 'Холдинг АРС (Астана)',
    plan: 690,
    planPctNum: 64.9,
    planSub: 'Выполнение плана: 64,9%',
    fact: 448,
    pct: '64,9%',
    factSub: 'к плану 690 ваг.',
    variance: -242,
    varSub: 'План: 690 | Факт: 448',
    ktt: 223,
    own: 161,
    parkSub: 'КТТ: 223 | Собственный: 161',
    unfinished: 21,
    unfinishedSub: 'Требует внимания',
    ytd: '5 058',
    ytdSub: 'План: 4 100 | +958',
  },
  AVRD: {
    label: 'Арысское ВРД (АВРД)',
    plan: 280,
    planPctNum: 72.1,
    planSub: 'Выполнение плана: 72,1%',
    fact: 202,
    pct: '72,1%',
    factSub: 'к плану 280 ваг.',
    variance: -78,
    varSub: 'План: 280 | Факт: 202',
    ktt: 98,
    own: 85,
    parkSub: 'КТТ: 98 | Собственный: 85',
    unfinished: 14,
    unfinishedSub: 'Требует внимания',
    ytd: '1 940',
    ytdSub: 'План: 1 650 | +290',
  },
  KVRD: {
    label: 'Кушмурунское ВРД (КВРД)',
    plan: 201,
    planPctNum: 59.7,
    planSub: 'Выполнение плана: 59,7%',
    fact: 120,
    pct: '59,7%',
    factSub: 'к плану 201 ваг.',
    variance: -81,
    varSub: 'План: 201 | Факт: 120',
    ktt: 79,
    own: 18,
    parkSub: 'КТТ: 79 | Собственный: 18',
    unfinished: 2,
    unfinishedSub: 'Требует внимания',
    ytd: '1 520',
    ytdSub: 'План: 1 250 | +270',
  },
  BVRD: {
    label: 'Балхашское ВРД (БВРД)',
    plan: 89,
    planPctNum: 57.3,
    planSub: 'Выполнение плана: 57,3%',
    fact: 51,
    pct: '57,3%',
    factSub: 'к плану 89 ваг.',
    variance: -38,
    varSub: 'План: 89 | Факт: 51',
    ktt: 24,
    own: 18,
    parkSub: 'КТТ: 24 | Собственный: 18',
    unfinished: 2,
    unfinishedSub: 'Требует внимания',
    ytd: '718',
    ytdSub: 'План: 550 | +168',
  },
  UVRD: {
    label: 'Уральское ВРД (УВРД)',
    plan: 120,
    planPctNum: 62.5,
    planSub: 'Выполнение плана: 62,5%',
    fact: 75,
    pct: '62,5%',
    factSub: 'к плану 120 ваг.',
    variance: -45,
    varSub: 'План: 120 | Факт: 75',
    ktt: 22,
    own: 40,
    parkSub: 'КТТ: 22 | Собственный: 40',
    unfinished: 3,
    unfinishedSub: 'Требует внимания',
    ytd: '880',
    ytdSub: 'План: 650 | +230',
  },
};

const BRANCH_BRIEFING_BY_DEPOT: Record<string, string> = {
  KVRD: `### Оперативная аналитическая сводка филиала КВРД (Кушмурунское ВРД)

Активирован изолированный контур филиала **КВРД (п. Кушмурун)** за **2026 год** (суточная мощность **7 ваг/сут**, 203 записи пономерной дислокации, остатки и расход КП, выполнение плана на 20.10.2026).

#### 1. Выполнение плана выпуска по филиалу КВРД за октябрь 2026 г. (на 20.10.2026)

| Филиал (Депо) | Город | Мощность | План окт. | Факт окт. | Отклонение | % выполнения | Выпуск сутки | Подача | Неоконч. ремонт | Выпуск YTD |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **КВРД** | Кушмурун | 7 ваг/сут | 201 | 120 | -81 | **59,7%** | 6 | 7 | 2 | **1 520** |

#### 2. Структура выполнения по видам ремонта и заказчикам (КВРД)

| Категория ремонта / Заказчик | План окт. | Факт окт. | Отклонение | % вып. | Неоконч. рем. |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Плановый ремонт (ДР + КР)** | **181** | **97** | **-84** | **53,6%** | **2** |
| — АО «Казтемиртранс» (КТТ) | 105 | 79 | -26 | **75,2%** | 0 |
| — Собственники (частный парк, KTZ Express, ЦЖС) | 76 | 18 | -58 | **23,7%** | 2 |
| **Текущий отцепочный ремонт (ТОР)** | **20** | **23** | **+3** | **115,0%** | **0** |

#### 3. Контроль неоконченного ремонта и простоев по КВРД:
- **По причине колёсных пар (КП):** вагоны \`94511425\`, \`94303880\`, \`94338605\` (*KTZ Express*, ДР — «По КП») и вагон \`64780950\` (*ПГК Центральная Азия*, ТОР — «Брак КП»).
- **По причине брака автосцепки:** вагон \`52509312\` (*Феникс Рейл*, КР — «брак автоцепки»).
- **По причине неподачи в цех / со станции:** вагон \`98333826\` (*АО «KTZ Express»*, ДР — «не подали со станции»), вагон \`61895488\` (*АО «Казтемиртранс»*, КР — «не подан в цех»).
- **Отстой на тракционных путях КВРД:** на **54 пути** находятся вагоны *ЦЖС* \`42526723(68892)\`, \`58421\`, \`58273\`; на **58 и 59 путях** ожидают ремонта вагоны *АО «Казтемиртранс»* (\`28808749\`, \`28811354\`, \`62600515\`, \`44961172\` и др.) и платформы *ЦЖС* (\`42078436\`, \`42582478\`).`,
  AVRD: `### Оперативная аналитическая сводка филиала АВРД (Арысское ВРД)

Активирован изолированный контур филиала **АВРД (г. Арыс)** за **2026 год** (суточная мощность **8 ваг/сут**, свод выполнения плана на 20.10.2026).

#### 1. Выполнение плана выпуска по филиалу АВРД за октябрь 2026 г. (на 20.10.2026)

| Филиал (Депо) | Город | Мощность | План окт. | Факт окт. | Отклонение | % выполнения | Выпуск сутки | Подача | Неоконч. ремонт | Выпуск YTD |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **АВРД** | Арыс | 8 ваг/сут | 280 | 202 | -78 | **72,1%** | 8 | 0 | **14** | **1 940** |

#### 2. Структура по видам ремонта (АВРД):
- **Плановый ремонт:** план 260 ваг., факт 183 ваг. (ДР: 138, КР: 45), неоконченный ремонт — **14 ваг.** (4 ДР, 10 КР).
- **Текущий отцепочный ремонт (ТОР):** план 20 ваг., факт 19 ваг. (**95,0%**).`,
  BVRD: `### Оперативная аналитическая сводка филиала БВРД (Балхашское ВРД)

Активирован изолированный контур филиала **БВРД (г. Балхаш)** за **2026 год** (суточная мощность **6 ваг/сут**, свод выполнения плана на 20.10.2026).

#### 1. Выполнение плана выпуска по филиалу БВРД за октябрь 2026 г. (на 20.10.2026)

| Филиал (Депо) | Город | Мощность | План окт. | Факт окт. | Отклонение | % выполнения | Выпуск сутки | Подача | Неоконч. ремонт | Выпуск YTD |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **БВРД** | Балхаш | 6 ваг/сут | 89 | 51 | -38 | **57,3%** | 1 | 6 | **2** | **718** |

#### 2. Структура по видам ремонта (БВРД):
- **Плановый ремонт:** план 79 ваг., факт 42 ваг. (ДР: 34, КР: 8), неоконченный ремонт — **2 ваг.** (1 ДР КТТ, 1 КР КТТ), суточная подача — **6 ваг.**
- **Текущий отцепочный ремонт (ТОР):** план 10 ваг., факт 9 ваг. (**90,0%**).`,
  UVRD: `### Оперативная аналитическая сводка филиала УВРД (Уральское ВРД)

Активирован изолированный контур филиала **УВРД (г. Уральск)** за **2026 год** (суточная мощность **7 ваг/сут**, свод выполнения плана на 20.10.2026).

#### 1. Выполнение плана выпуска по филиалу УВРД за октябрь 2026 г. (на 20.10.2026)

| Филиал (Депо) | Город | Мощность | План окт. | Факт окт. | Отклонение | % выполнения | Выпуск сутки | Подача | Неоконч. ремонт | Выпуск YTD |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **УВРД** | Уральск | 7 ваг/сут | 120 | 75 | -45 | **62,5%** | 0 | 0 | **3** | **880** |

#### 2. Структура по видам ремонта (УВРД):
- **Плановый ремонт:** план 110 ваг., факт 62 ваг. (ДР: 55, КР: 7), неоконченный ремонт — **2 ваг.** (ДР).
- **Текущий отцепочный ремонт (ТОР):** план 10 ваг., факт 13 ваг. (**130,0%**), неоконченный ремонт — **1 ваг.**`,
};

function getInitialBriefingMarkdown(user: ArsAuthSession | null): string {
  if (user && user.role === 'branch') {
    const code = (user.depot_code || 'KVRD').toUpperCase();
    return (
      BRANCH_BRIEFING_BY_DEPOT[code] ||
      `### Оперативная аналитическая сводка филиала ${code} (${user.display_name})\n\nАктивирован изолированный контур филиала **${code}** за 2026 год.`
    );
  }
  return INITIAL_BRIEFING_MARKDOWN;
}

const INITIAL_BRIEFING_MARKDOWN = `### Оперативная аналитическая сводка руководству ТОО «Astana Railway Services» (АРС)

В базу загружен полный производственный массив холдинга за **2026 год** (4 филиала, суммарная мощность **28 ваг/сут**, 81 строка сводного плана/факта на 20.10.2026, 203 записи пономерной дислокации, 191 запись расхода КП, 40 записей запасов КП и 905 записей суточного выпуска за октябрь).

#### 1. Выполнение плана выпуска за октябрь 2026 г. (по состоянию на 20.10.2026)

| Филиал (Депо) | Город | Мощность | План окт. | Факт окт. | Отклонение | % выполнения | Выпуск сутки | Подача | Неоконч. ремонт | Выпуск YTD |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **АВРД** | Арыс | 8 ваг/сут | 280 | 202 | -78 | **72,1%** | 8 | 0 | **14** | — |
| **УВРД** | Уральск | 7 ваг/сут | 120 | 75 | -45 | **62,5%** | 0 | 0 | 3 | — |
| **КВРД** | Кушмурун | 7 ваг/сут | 201 | 120 | -81 | **59,7%** | 6 | 7 | 2 | — |
| **БВРД** | Балхаш | 6 ваг/сут | 89 | 51 | -38 | **57,3%** | 1 | 6 | 2 | — |
| **ИТОГО АРС** | **Холдинг** | **28 ваг/сут** | **690** | **448** | **-242** | **64,9%** | **15** | **13** | **21** | **5 058** |

#### 2. Выполнение плана по видам ремонта и ключевым заказчикам

| Категория ремонта / Заказчик | План окт. | Факт окт. | Отклонение | % вып. | Неоконч. рем. | С нач. года (YTD) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Плановый ремонт — ВСЕГО** | **630** | **384** | **-246** | **61,0%** | **20** | **4 131** |
| — Деповской ремонт (ДР, всего) | 507 | 305 | -202 | 60,2% | 7 | 3 365 |
| — Капитальный ремонт (КР, всего) | 123 | 79 | -44 | 64,2% | 13 | 737 |
| **АО «Казтемиртранс» (КТТ — всего)** | **375** | **223** | **-152** | **59,5%** | **7** | **1 767** |
| — КТТ: ДР / КР | 294 / 81 | 173 / 50 | -121 / -31 | 58,8% / 61,7% | 2 / 5 | 1 323 / 444 |
| **Собственники (частный парк, KTZ Express, ЦЖС)** | **255** | **161** | **-94** | **63,1%** | **13** | **2 364** |
| **Текущий отцепочный ремонт (ТОР — всего)** | **60** | **64** | **+4** | **106,7%** | **1** | **927** |

#### 3. Контроль неоконченного ремонта и простоев (ключевые позиции):
- **По причине колёсных пар (КП):** вагоны \`94511425\`, \`94303880\`, \`94338605\` (*KTZ Express*, ДР — «По КП») и вагон \`64780950\` (*ПГК Центральная Азия*, ТОР — «Брак КП»).
- **По причине брака автосцепки:** вагон \`52509312\` (*Феникс Рейл*, КР — «брак автоцепки»).
- **По причине неподачи в цех / со станции:** вагон \`98333826\` (*АО «KTZ Express»*, ДР — «не подали со станции»), вагон \`61895488\` (*АО «Казтемиртранс»*, КР — «не подан в цех»).
- **Отстой на тракционных путях КВРД:** на **54 пути** находятся вагоны *ЦЖС* \`42526723(68892)\`, \`58421\`, \`58273\`; на **58 и 59 путях** ожидают ремонта вагоны *АО «Казтемиртранс»* (\`28808749\`, \`28811354\`, \`62600515\`, \`44961172\` и др.) и платформы *ЦЖС* (\`42078436\`, \`42582478\`).`;

export default function App() {
  const [data, setData] = useState<ArsDataset | null>(null);
  const [loadingData, setLoadingData] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('daily');
  const [selectedWagonNumber, setSelectedWagonNumber] = useState<string>('52509312');
  const [isQuerying, setIsQuerying] = useState<boolean>(false);
  const [showScrollTop, setShowScrollTop] = useState<boolean>(false);

  useEffect(() => {
    const handleWindowScroll = () => {
      const currentScroll =
        window.scrollY ||
        window.pageYOffset ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0;
      setShowScrollTop(currentScroll > 70);
    };

    handleWindowScroll();
    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleWindowScroll);
    };
  }, []);

  const handleScrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Active RBAC User Session (null when not logged in -> opens #modalLogin)
  const [currentUser, setCurrentUser] = useState<ArsAuthSession | null>(() => {
    try {
      const saved =
        localStorage.getItem(STORAGE_KEY_AUTH) || localStorage.getItem('ars_current_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.username && parsed.role && parsed.depot_code) {
          return parsed;
        }
      }
    } catch (_e) {
      // ignore localStorage read errors
    }
    return null;
  });

  const [references, setReferences] = useState<ArsReferences>(() => {
    const initialRepairs = loadInitialRepairTypes();
    try {
      const saved = localStorage.getItem(STORAGE_KEY_REFS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.customers) && Array.isArray(parsed.depots)) {
          return {
            ...parsed,
            repairs:
              Array.isArray(parsed.repairs) && parsed.repairs.length > 0
                ? parsed.repairs
                : initialRepairs,
          };
        }
      }
    } catch (_e) {
      // ignore localStorage read errors
    }
    return {
      ...DEFAULT_ARS_REFERENCES,
      repairs: initialRepairs,
    };
  });

  const headerRefBtn = useRef<HTMLButtonElement | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'initial-briefing',
      role: 'model',
      text: getInitialBriefingMarkdown(currentUser),
      timestamp: '20.10.2026 · Свод ПТО АРС',
    },
  ]);

  useEffect(() => {
    window.currentUser = currentUser;
    try {
      if (currentUser) {
        localStorage.setItem('ars_current_user', JSON.stringify(currentUser));
      } else {
        localStorage.removeItem('ars_current_user');
      }
    } catch (_e) {
      // ignore
    }
    setMessages((prev) =>
      prev.map((m) =>
        m.id === 'initial-briefing'
          ? {
              ...m,
              text: getInitialBriefingMarkdown(currentUser),
              timestamp:
                currentUser?.role === 'branch'
                  ? `20.10.2026 · Свод филиала ${currentUser.depot_code}`
                  : '20.10.2026 · Свод ПТО АРС',
            }
          : m
      )
    );
    setTimeout(() => {
      window.isolateAiAnalystForBranch?.();
    }, 30);
  }, [currentUser]);

  useEffect(() => {
    if (activeTab === 'analyst') {
      setTimeout(() => {
        window.isolateAiAnalystForBranch?.();
      }, 40);
    }
  }, [activeTab]);

  const handleLoginSuccess = useCallback((session: ArsAuthSession) => {
    setCurrentUser(session);
    window.currentUser = session;
    try {
      localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(session));
      localStorage.setItem('ars_current_user', JSON.stringify(session));
    } catch (_e) {
      // ignore
    }
    setTimeout(() => {
      window.isolateAiAnalystForBranch?.();
    }, 50);
  }, []);

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    window.currentUser = null;
    try {
      localStorage.removeItem(STORAGE_KEY_AUTH);
      localStorage.removeItem('ars_current_user');
    } catch (_e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    window.handleLogout = handleLogout;
  }, [handleLogout]);

  // Ensure exact inline onclick="openReferencesModal()" attribute on the header button
  useEffect(() => {
    if (headerRefBtn.current) {
      headerRefBtn.current.setAttribute('onclick', 'openReferencesModal()');
    }
  }, []);

  useEffect(() => {
    // 100% autonomous in-browser dataset initialization with local persistence
    try {
      const customSaved = localStorage.getItem('ars_custom_dataset');
      if (customSaved) {
        const parsed = JSON.parse(customSaved);
        if (parsed && Array.isArray(parsed.summary_reports) && parsed.summary_reports.length > 0) {
          setData(enrichDataset(parsed));
          setLoadingData(false);
          return;
        }
      }
    } catch (_e) {
      // ignore
    }
    setData(enrichDataset(arsDatasetFallback));
    setLoadingData(false);
  }, []);

  const handleUpdateReferences = (nextRefs: ArsReferences) => {
    setReferences(nextRefs);
    try {
      localStorage.setItem(STORAGE_KEY_REFS, JSON.stringify(nextRefs));
    } catch (_e) {
      // ignore storage errors
    }
  };

  // Merge active references (depots, wagonTypes) and enforce RBAC branch isolation across all views
  const effectiveData: ArsDataset | null = useMemo(() => {
    if (!data) return null;
    const isBranch = currentUser?.role === 'branch';
    const branchCode = isBranch ? currentUser.depot_code : null;

    const allDepots = references.depots.map((d) => {
      const existing = data.depots.find((orig) => orig.code === d.code);
      return {
        code: d.code,
        name: d.name,
        city: d.city || existing?.city || d.code,
        daily_capacity: d.daily_capacity ?? existing?.daily_capacity ?? 7,
      };
    });

    const allWagonTypes = references.wagonTypes.map((wt) => {
      const existing = data.wagon_types.find(
        (orig) => orig.name.toLowerCase() === wt.name.toLowerCase() || orig.code === wt.code
      );
      return {
        code: wt.code || existing?.code || wt.id,
        name: wt.name,
        workload_coefficient: wt.workload_coefficient ?? existing?.workload_coefficient ?? 1.0,
      };
    });

    if (!branchCode) {
      return {
        ...data,
        depots: allDepots,
        wagon_types: allWagonTypes,
      };
    }

    // Strict isolation for branch master (only their depot's records)
    return {
      ...data,
      depots: allDepots.filter((d) => d.code === branchCode),
      wagon_types: allWagonTypes,
      summary_reports: data.summary_reports.filter((r) => r.depot_code === branchCode),
      wagon_dislocations_and_stalls: data.wagon_dislocations_and_stalls.filter(
        (w) => w.depot_code === branchCode
      ),
      wheel_pairs_production: data.wheel_pairs_production.filter(
        (wp) => wp.depot_code === branchCode
      ),
      wheel_pair_stocks: data.wheel_pair_stocks.filter(
        (ws) => ws.depot_code === branchCode
      ),
      daily_output_october: data.daily_output_october.filter(
        (d) => d.depot_code === branchCode
      ),
    };
  }, [data, references, currentUser]);

  const handleSendPrompt = (promptText: string) => {
    setActiveTab('analyst');
    const nowStr = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const scopedPrompt =
      currentUser?.role === 'branch'
        ? `[Контур филиала ${currentUser.depot_code} — ${currentUser.display_name}] ${promptText}`
        : promptText;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: promptText,
      timestamp: nowStr,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsQuerying(true);

    // Completely autonomous browser analysis execution
    setTimeout(() => {
      try {
        const localAnswer = effectiveData
          ? generateAnalyticalAnswer(scopedPrompt, effectiveData, references)
          : 'Не удалось сформировать аналитический ответ.';
        const replyTime = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        setMessages((prev) => [
          ...prev,
          {
            id: `model-${Date.now()}`,
            role: 'model',
            text: localAnswer,
            timestamp: replyTime,
            source: 'ars-browser-analytical-engine',
          },
        ]);
      } finally {
        setIsQuerying(false);
      }
    }, 120);
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: 'initial-briefing',
        role: 'model',
        text: getInitialBriefingMarkdown(currentUser),
        timestamp:
          currentUser?.role === 'branch'
            ? `20.10.2026 · Свод филиала ${currentUser.depot_code}`
            : '20.10.2026 · Свод ПТО АРС',
      },
    ]);
  };

  const handleInspectWagon = (wagonNum: string) => {
    setSelectedWagonNumber(wagonNum);
    setActiveTab('analyst');
    handleSendPrompt(
      `Дай полную аналитическую справку по вагону № ${wagonNum}: укажи заказчика, вид ремонта, депо, текущую локацию/путь, историю статусов и причину простоя.`
    );
  };

  const isBranchUser = currentUser?.role === 'branch';
  const activeDepotKey = isBranchUser
    ? (currentUser.depot_code || 'BVRD').toUpperCase()
    : 'ALL';

  const [headerDateText, setHeaderDateText] = useState<string>(() => {
    const monthsGenitive = [
      'января',
      'февраля',
      'марта',
      'апреля',
      'мая',
      'июня',
      'июля',
      'августа',
      'сентября',
      'октября',
      'ноября',
      'декабря',
    ];
    const now = new Date();
    return `${now.getDate()} ${monthsGenitive[now.getMonth()]} ${now.getFullYear()}`;
  });

  useEffect(() => {
    (window as unknown as Record<string, unknown>).updateHeaderDateLabel = (isoStr: string) => {
      const monthsGenitive = [
        'января',
        'февраля',
        'марта',
        'апреля',
        'мая',
        'июня',
        'июля',
        'августа',
        'сентября',
        'октября',
        'ноября',
        'декабря',
      ];
      const parts = isoStr.split('-').map(Number);
      if (parts.length === 3 && !parts.some(Number.isNaN)) {
        const dt = new Date(parts[0], parts[1] - 1, parts[2]);
        setHeaderDateText(`${dt.getDate()} ${monthsGenitive[dt.getMonth()]} ${dt.getFullYear()}`);
      }
    };
  }, []);

  const currentKpi = BRANCH_KPI_PRESETS[activeDepotKey] || {
    label: currentUser?.display_name || `Филиал ${activeDepotKey}`,
    plan: 89,
    planPctNum: 57.3,
    planSub: 'Выполнение плана: 57,3%',
    fact: 51,
    pct: '57,3%',
    factSub: 'к плану 89 ваг.',
    variance: -38,
    varSub: 'План: 89 | Факт: 51',
    ktt: 24,
    own: 18,
    parkSub: 'КТТ: 24 | Собственный: 18',
    unfinished: 2,
    unfinishedSub: 'Требует внимания',
    ytd: '718',
    ytdSub: 'План: 550 | +168',
  };

  const updateShiftMasterKpi = useCallback(
    (depotCode?: string, customData: Record<string, unknown> | null = null) => {
      const fallbackDepot =
        isBranchUser && currentUser?.depot_code
          ? currentUser.depot_code
          : typeof window.currentDepot !== 'undefined' && window.currentDepot
          ? window.currentDepot
          : 'ALL';
      const d = (depotCode || fallbackDepot || 'ALL').toUpperCase();

      const depotLabels =
        typeof window.DEPOT_LABELS !== 'undefined' && window.DEPOT_LABELS
          ? window.DEPOT_LABELS
          : {};
      const refDep = references.depots.find((item) => item.code.toUpperCase() === d);
      const preset = BRANCH_KPI_PRESETS[d] || BRANCH_KPI_PRESETS.ALL;

      const dName =
        d === 'ALL'
          ? 'Холдинг АРС (Астана)'
          : depotLabels[d] || refDep?.name || preset.label || d;

      // Обновление бейджей и заголовка
      const badgeDepot = document.getElementById('kpiDepotBadge');
      if (badgeDepot) {
        badgeDepot.textContent = dName;
      }

      const badgeCode = document.getElementById('kpiCodeBadge');
      if (badgeCode) {
        badgeCode.textContent = `Депо: ${d}`;
      }

      const titleEl = document.getElementById('kpiMainTitle');
      if (titleEl) {
        titleEl.textContent =
          d === 'ALL'
            ? 'Ситуационный центр ремонта грузовых вагонов'
            : `Ситуационный центр ремонта грузовых вагонов — ${dName}`;
      }

      // Обновление численных значений 6 плиток
      const setElText = (id: string, val: string | number) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(val);
      };

      setElText('kpiValPlan', (customData?.plan as number) ?? preset.plan);
      setElText('kpiSubPlan', (customData?.planSub as string) ?? preset.planSub);
      setElText('kpiValFact', (customData?.fact as number) ?? preset.fact);
      setElText('kpiFactPercent', (customData?.pct as string) ?? preset.pct);
      setElText('kpiSubFact', (customData?.factSub as string) ?? preset.factSub);
      setElText('kpiValDev', (customData?.variance as number) ?? preset.variance);
      setElText('kpiSubDev', (customData?.varSub as string) ?? preset.varSub);
      setElText('kpiValKTT', (customData?.ktt as number) ?? preset.ktt);
      setElText('kpiValOwn', (customData?.own as number) ?? preset.own);
      setElText('kpiSubPark', (customData?.parkSub as string) ?? preset.parkSub);
      setElText('kpiValUnfinished', (customData?.unfinished as number) ?? preset.unfinished);
      setElText(
        'kpiSubUnfinished',
        (customData?.unfinishedSub as string) ?? preset.unfinishedSub
      );
      setElText('kpiValYear', (customData?.ytd as string) ?? preset.ytd);
      setElText('kpiSubYear', (customData?.ytdSub as string) ?? preset.ytdSub);

      const planBar = document.getElementById('kpiPlanProgressBar');
      if (planBar) {
        planBar.style.width = `${preset.planPctNum}%`;
      }
    },
    [currentUser, isBranchUser, references.depots]
  );

  useEffect(() => {
    window.updateShiftMasterKpi = updateShiftMasterKpi;
    const targetCode = isBranchUser
      ? currentUser?.depot_code || 'BVRD'
      : window.currentDepot || 'ALL';
    updateShiftMasterKpi(targetCode);
  }, [updateShiftMasterKpi, currentUser, isBranchUser]);

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-slate-900 flex flex-col">
      {/* 1. Тёмно-синяя верхняя панель (#17365D, 52px) */}
      <header
        className="sticky top-0 z-30 border-b border-[#0F2542]"
        style={{ background: '#17365D', height: '52px' }}
      >
        <div className="max-w-[1440px] h-full mx-auto flex items-center justify-between gap-4 px-6">
          {/* Бренд + Разделы навигации */}
          <div className="flex items-center gap-6 min-w-0">
            <a
              href="#top"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('daily');
              }}
              className="flex items-center gap-2 text-sm font-extrabold tracking-tight text-white whitespace-nowrap shrink-0"
            >
              <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-[#2563EB] text-white text-xs font-black">
                АРС
              </span>
              <span>Astana Railway Services</span>
            </a>

            <nav className="hidden md:flex items-center gap-1.5 text-xs font-semibold">
              {[
                { id: 'daily', label: 'Суточный выпуск' },
                { id: 'analyst', label: 'ИИ-Аналитик' },
                { id: 'plans', label: 'План и факт' },
                { id: 'dislocation', label: 'Дислокация вагонов' },
                { id: 'wheelsets', label: 'Колёсные пары' },
              ].map((navItem) => {
                const isAct = activeTab === navItem.id;
                return (
                  <button
                    key={navItem.id}
                    type="button"
                    onClick={() => setActiveTab(navItem.id as ActiveTab)}
                    style={{
                      background: isAct ? '#2563EB' : 'transparent',
                      color: isAct ? '#FFFFFF' : '#CBD5E1',
                    }}
                    className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isAct ? 'font-bold shadow-xs' : 'hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {navItem.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Правая зона: Журнал, Справочники и Профиль */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              id="btnHeaderAuditLog"
              onClick={() => window.openAuditLogModal?.('devlog')}
              className="px-2.5 py-1.5 rounded-md text-xs font-semibold text-slate-200 bg-white/10 hover:bg-white/20 border border-white/15 transition-colors cursor-pointer whitespace-nowrap"
              title="Журнал системы и Чёрный ящик разработчика (Flight Recorder)"
            >
              Журнал системы
            </button>

            <button
              ref={headerRefBtn}
              type="button"
              onClick={() => window.openReferencesModal?.()}
              className="px-2.5 py-1.5 rounded-md text-xs font-semibold text-slate-200 bg-white/10 hover:bg-white/20 border border-white/15 transition-colors cursor-pointer whitespace-nowrap"
              title="Управление справочниками"
            >
              Справочники
            </button>

            {currentUser && (
              <div className="flex items-center gap-2 pl-2 border-l border-white/20">
                <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-200">
                  {currentUser.role === 'headquarters' ? (
                    <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                  ) : (
                    <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span className="font-semibold text-white whitespace-nowrap">
                    {currentUser.display_name}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-2.5 py-1.5 rounded-md text-xs font-semibold text-slate-200 bg-white/10 hover:bg-red-600/80 hover:text-white border border-white/15 transition-colors cursor-pointer flex items-center gap-1"
                  title={`Выйти из учётной записи (${currentUser.username})`}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Выйти</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-5 space-y-5">
        {/* 2 & 3. Заголовок «Ситуационный центр ремонта грузовых вагонов» + 6 KPI-карточек в один ряд */}
        <div className="kpi-banner-container" id="bannerKpi">
          {/* Шапка ситуационного центра */}
          <div className="kpi-banner-header flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="kpi-main-title" id="kpiMainTitle">
                {isBranchUser
                  ? `Ситуационный центр ремонта грузовых вагонов — ${currentKpi.label}`
                  : 'Ситуационный центр ремонта грузовых вагонов'}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                <span className="kpi-badge kpi-badge-depot" id="kpiDepotBadge">
                  {currentKpi.label}
                </span>
                <span className="kpi-badge kpi-badge-status" id="kpiStatusBadge">
                  {isBranchUser ? 'Контур филиала' : 'Производственный отдел'}
                </span>
                <span className="sr-only" id="kpiCodeBadge">
                  Депо: {activeDepotKey}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Интерактивный выбор даты справа в заголовке */}
              <button
                type="button"
                id="headerDateSelectorBtn"
                onClick={(e) => {
                  e.stopPropagation();
                  if (activeTab !== 'daily') {
                    setActiveTab('daily');
                    setTimeout(() => window.toggleCalendarPopover?.(e), 50);
                  } else {
                    window.toggleCalendarPopover?.(e);
                  }
                }}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 border border-slate-300 hover:border-blue-400 text-xs font-bold text-slate-800 transition-colors cursor-pointer"
                title="Открыть календарь выбора даты или периода"
              >
                <span>📅</span>
                <span id="headerDateLabelText">{headerDateText}</span>
                <span className="text-[10px] text-slate-500">▾</span>
              </button>
            </div>
          </div>

          {/* 3. 6 KPI-карточек в один ряд */}
          <div className="kpi-grid">
            {/* Карточка 1: План на месяц: 690 ваг. (прогресс-бар, «Выполнение плана: 64,9%») */}
            <div className="kpi-card">
              <div className="kpi-card-label">План на месяц</div>
              <div className="kpi-card-value">
                <span id="kpiValPlan">{currentKpi.plan}</span>
                <span className="kpi-unit">ваг.</span>
              </div>
              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden my-1.5">
                <div
                  id="kpiPlanProgressBar"
                  className="h-full bg-[#2563EB] rounded-full transition-all duration-300"
                  style={{ width: `${currentKpi.planPctNum}%` }}
                />
              </div>
              <div className="kpi-card-sub" id="kpiSubPlan">
                {currentKpi.planSub}
              </div>
            </div>

            {/* Карточка 2: Факт за месяц: 448 ваг. (зелёный бейдж 64,9%, «к плану 690 ваг.») */}
            <div className="kpi-card">
              <div className="kpi-card-label">Факт за месяц</div>
              <div className="kpi-card-value">
                <span id="kpiValFact">{currentKpi.fact}</span>
                <span className="kpi-unit">ваг.</span>
                <span
                  id="kpiFactPercent"
                  className="ml-1.5 px-1.5 py-0.5 text-[11px] font-extrabold rounded bg-emerald-100 text-emerald-800 border border-emerald-200"
                >
                  {currentKpi.pct}
                </span>
              </div>
              <div className="kpi-card-sub" id="kpiSubFact">
                {currentKpi.factSub}
              </div>
            </div>

            {/* Карточка 3: Отклонение: -242 ваг. (красный жирный #DC2626, «План: 690 | Факт: 448») */}
            <div className="kpi-card">
              <div className="kpi-card-label">Отклонение</div>
              <div className="kpi-card-value" style={{ color: '#DC2626', fontWeight: 800 }}>
                <span id="kpiValDev">{currentKpi.variance}</span>
                <span className="kpi-unit" style={{ color: '#DC2626' }}>
                  ваг.
                </span>
              </div>
              <div className="kpi-card-sub" id="kpiSubDev">
                {currentKpi.varSub}
              </div>
            </div>

            {/* Карточка 4: Парк КТТ / собственный: 223 / 161 ваг. («КТТ: 223 | Собственный: 161») */}
            <div className="kpi-card">
              <div className="kpi-card-label">Парк КТТ / собственный</div>
              <div className="kpi-card-value">
                <span id="kpiValKTT">{currentKpi.ktt}</span>
                <span className="kpi-divider">/</span>
                <span id="kpiValOwn">{currentKpi.own}</span>
                <span className="kpi-unit">ваг.</span>
              </div>
              <div className="kpi-card-sub" id="kpiSubPark">
                {currentKpi.parkSub}
              </div>
            </div>

            {/* Карточка 5: Незавершённый ремонт: 21 ваг. (янтарный #D97706, «Требует внимания») */}
            <div className="kpi-card">
              <div className="kpi-card-label">Незавершённый ремонт</div>
              <div className="kpi-card-value" style={{ color: '#D97706', fontWeight: 800 }}>
                <span id="kpiValUnfinished">{currentKpi.unfinished}</span>
                <span className="kpi-unit" style={{ color: '#D97706' }}>
                  ваг.
                </span>
              </div>
              <div
                className="kpi-card-sub"
                id="kpiSubUnfinished"
                style={{ color: '#B45309', fontWeight: 700 }}
              >
                {currentKpi.unfinishedSub}
              </div>
            </div>

            {/* Карточка 6: Выпуск с начала года: 5 058 ваг. (зелёный #16A34A, «План: 4 100 | +958») */}
            <div className="kpi-card">
              <div className="kpi-card-label">Выпуск с начала года</div>
              <div className="kpi-card-value" style={{ color: '#16A34A', fontWeight: 800 }}>
                <span id="kpiValYear">{currentKpi.ytd}</span>
                <span className="kpi-unit" style={{ color: '#16A34A' }}>
                  ваг.
                </span>
              </div>
              <div
                className="kpi-card-sub"
                id="kpiSubYear"
                style={{ color: '#15803D', fontWeight: 700 }}
              >
                {currentKpi.ytdSub}
              </div>
            </div>
          </div>
        </div>

        {/* Active View Content */}
        {loadingData || !effectiveData ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
            <div className="text-sm font-semibold text-slate-700">
              Загрузка производственной базы данных ТОО «Astana Railway Services» за 2026 год...
            </div>
            <div className="text-xs text-slate-400 font-mono">
              Инициализация сводных таблиц БВРД, АВРД, КВРД, УВРД
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'analyst' && (
              <AnalystWorkspace
                data={effectiveData}
                currentUser={currentUser}
                messages={messages}
                isLoading={isQuerying}
                onSendPrompt={handleSendPrompt}
                onResetChat={handleResetChat}
                selectedWagonNumber={selectedWagonNumber}
                onSelectWagonNumber={setSelectedWagonNumber}
              />
            )}

            {activeTab === 'plans' && (
              <PlanSummaryView data={effectiveData} onAskAnalyst={handleSendPrompt} />
            )}

            {activeTab === 'dislocation' && (
              <DislocationView
                data={effectiveData}
                onAskAnalyst={handleSendPrompt}
                onInspectWagon={handleInspectWagon}
              />
            )}

            {activeTab === 'wheelsets' && (
              <WheelPairsView data={effectiveData} onAskAnalyst={handleSendPrompt} />
            )}

            {activeTab === 'daily' && (
              <DailyOutputView
                data={effectiveData}
                references={references}
                currentUser={currentUser}
                onAskAnalyst={handleSendPrompt}
              />
            )}
          </>
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12">
        <div className="max-w-[1440px] mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            ТОО «Astana Railway Services» (АРС) · Производственно-технический отдел · Данные за 2026 год
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => window.openAuditLogModal?.('devlog')}
              className="hover:text-slate-900 cursor-pointer"
            >
              📜 Журнал системы (🐞 Flight Recorder)
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => window.openReferencesModal?.()}
              className="hover:text-slate-900 cursor-pointer"
            >
              ⚙️ Справочники ({references.customers.length + references.wagonTypes.length + references.sections.length + references.depots.length})
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setActiveTab('daily')}
              className="hover:text-slate-900 cursor-pointer"
            >
              Суточный выпуск
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setActiveTab('analyst')}
              className="hover:text-slate-900 cursor-pointer"
            >
              ИИ-Аналитик
            </button>
            {currentUser && (
              <>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-red-700 hover:underline cursor-pointer"
                >
                  Сменить пользователя ({currentUser.username})
                </button>
              </>
            )}
          </div>
        </div>
      </footer>

      {/* Модальное окно справочников (рендерится в конце <body> через Portal) */}
      <ReferencesModal
        references={references}
        onUpdateReferences={handleUpdateReferences}
        currentUser={currentUser}
      />

      {/* Модальное окно журнала системы и Чёрного ящика разработчика (#modalAuditLog через Portal) */}
      <AuditLogModal
        currentUser={currentUser}
        references={references}
      />

      {/* Модальное окно входа (#modalLogin в конце <body> через Portal) */}
      <LoginModal
        isOpen={!currentUser}
        references={references}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Плавающая кнопка-стрелка «Наверх» при скроллинге */}
      <button
        type="button"
        id="btnScrollToTop"
        onClick={handleScrollToTop}
        className={`ars-scroll-top-btn ${showScrollTop ? 'visible' : ''}`}
        title="Наверх"
        aria-label="Наверх"
      >
        <span className="ars-scroll-top-tooltip" role="tooltip">
          Наверх
        </span>
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 19V5" />
          <path d="m5 12 7-7 7 7" />
        </svg>
      </button>
    </div>
  );
}
