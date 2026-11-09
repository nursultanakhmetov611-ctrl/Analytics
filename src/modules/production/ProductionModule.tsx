import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Sparkles,
  BarChart3,
  Train,
  CircleDot,
  CalendarCheck,
  ShieldCheck,
  Building2,
  AlertTriangle,
} from 'lucide-react';
import { ArsDataset, ArsReferences, ChatMessage } from '../../types/ars';
import { PlatformUserSession } from '../../types/platform';
import { AnalystWorkspace } from '../../components/AnalystWorkspace';
import { PlanSummaryView } from '../../components/PlanSummaryView';
import { DislocationView } from '../../components/DislocationView';
import { WheelPairsView } from '../../components/WheelPairsView';
import { DailyOutputView } from '../../components/DailyOutputView';
import { generateAnalyticalAnswer } from '../../utils/arsEngine';

export type ProductionTab = 'analyst' | 'plans' | 'dislocation' | 'wheelsets' | 'daily';

interface ProductionModuleProps {
  data: ArsDataset;
  references: ArsReferences;
  currentUser: PlatformUserSession;
  initialTab?: ProductionTab;
  initialDepotFilter?: string;
  onUpdateReferences?: (next: ArsReferences) => void;
}

const BRANCH_KPI_PRESETS: Record<string, {
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
}> = {
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
| **Текущий отцепочный ремонт (ТОР)** | **20** | **23** | **+3** | **115,0%** | **0** |`,
  AVRD: `### Оперативная аналитическая сводка филиала АВРД (Арысское ВРД)

Активирован изолированный контур филиала **АВРД (г. Арыс)** за **2026 год** (суточная мощность **8 ваг/сут**, свод выполнения плана на 20.10.2026).

#### 1. Выполнение плана выпуска по филиалу АВРД за октябрь 2026 г. (на 20.10.2026)

| Филиал (Депо) | Город | Мощность | План окт. | Факт окт. | Отклонение | % выполнения | Выпуск сутки | Подача | Неоконч. ремонт | Выпуск YTD |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **АВРД** | Арыс | 8 ваг/сут | 280 | 202 | -78 | **72,1%** | 8 | 0 | **14** | **1 940** |`,
  BVRD: `### Оперативная аналитическая сводка филиала БВРД (Балхашское ВРД)

Активирован изолированный контур филиала **БВРД (г. Балхаш)** за **2026 год** (суточная мощность **6 ваг/сут**, свод выполнения плана на 20.10.2026).

#### 1. Выполнение плана выпуска по филиалу БВРД за октябрь 2026 г. (на 20.10.2026)

| Филиал (Депо) | Город | Мощность | План окт. | Факт окт. | Отклонение | % выполнения | Выпуск сутки | Подача | Неоконч. ремонт | Выпуск YTD |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **БВРД** | Балхаш | 6 ваг/сут | 89 | 51 | -38 | **57,3%** | 1 | 6 | **2** | **718** |`,
  UVRD: `### Оперативная аналитическая сводка филиала УВРД (Уральское ВРД)

Активирован изолированный контур филиала **УВРД (г. Уральск)** за **2026 год** (суточная мощность **7 ваг/сут**, свод выполнения плана на 20.10.2026).

#### 1. Выполнение плана выпуска по филиалу УВРД за октябрь 2026 г. (на 20.10.2026)

| Филиал (Депо) | Город | Мощность | План окт. | Факт окт. | Отклонение | % выполнения | Выпуск сутки | Подача | Неоконч. ремонт | Выпуск YTD |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **УВРД** | Уральск | 7 ваг/сут | 120 | 75 | -45 | **62,5%** | 0 | 0 | **3** | **880** |`,
};

function getInitialBriefing(user: PlatformUserSession): string {
  if (user.role === 'branch') {
    const code = (user.branchCode || 'KVRD').toUpperCase();
    return (
      BRANCH_BRIEFING_BY_DEPOT[code] ||
      BRANCH_BRIEFING_BY_DEPOT.KVRD
    );
  }
  return `### Оперативная сводка ПДО ТОО «Astana Railway Services» за октябрь 2026 г.

По состоянию на **20.10.2026 г.** общий выпуск по холдингу составил **448 вагонов** при месячном плане **690 вагонов** (**64,9%** выполнения, отставание **-242 вагона**). С начала 2026 года (YTD) отремонтировано **5 058 вагонов**.

#### 1. Выполнение общего плана в разрезе филиалов (депо)

| Филиал (Депо) | Город | Суточная мощность | План на окт. | Факт за окт. | Отклонение | % выполнения | Выпуск сутки | Подача | Неоконч. ремонт | Выпуск YTD |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **БВРД** | Балхаш | 6 ваг/сут | 89 | 51 | -38 | **57,3%** | 1 | 6 | 2 | 718 |
| **АВРД** | Арыс | 8 ваг/сут | 280 | 202 | -78 | **72,1%** | 8 | 0 | **14** | 1 940 |
| **КВРД** | Кушмурун | 7 ваг/сут | 201 | 120 | -81 | **59,7%** | 6 | 7 | 2 | 1 520 |
| **УВРД** | Уральск | 7 ваг/сут | 120 | 75 | -45 | **62,5%** | 0 | 0 | 3 | 880 |
| **ИТОГО ХОЛДИНГ** | Астана | **28 ваг/сут** | **690** | **448** | **-242** | **64,9%** | **15** | **13** | **21** | **5 058** |`;
}

export const ProductionModule: React.FC<ProductionModuleProps> = ({
  data,
  references,
  currentUser,
  initialTab = 'plans',
  initialDepotFilter = 'ALL',
}) => {
  const [activeTab, setActiveTab] = useState<ProductionTab>(initialTab);
  const [activeBriefing, setActiveBriefing] = useState<string>(() => getInitialBriefing(currentUser));

  // Chat / AI analyst messages state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => [
    {
      id: 'msg-welcome',
      role: 'model',
      text: getInitialBriefing(currentUser),
      timestamp: '2026-10-20 08:00',
      source: 'АРС Аналитическая База 2026',
    },
  ]);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [selectedWagonNumber, setSelectedWagonNumber] = useState<string>('');

  // Synchronize initialTab if changed externally
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const handleAskAnalyst = useCallback(
    async (promptText: string) => {
      setActiveTab('analyst');
      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}-user`,
        role: 'user',
        text: promptText,
        timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      };

      setChatMessages((prev) => [...prev, userMsg]);
      setIsTyping(true);

      try {
        const res = await fetch('/api/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: promptText, context: data }),
        });

        if (res.ok) {
          const json = await res.json();
          if (json.answer) {
            setChatMessages((prev) => [
              ...prev,
              {
                id: `msg-${Date.now()}-ai`,
                role: 'model',
                text: json.answer,
                timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
                source: 'ИИ Модель Gemini 2.5 Flash',
              },
            ]);
            setIsTyping(false);
            return;
          }
        }
      } catch (_e) {
        // Fallback to local rule-based analytical engine
      }

      const localAnswer = generateAnalyticalAnswer(promptText, data, references);
      setChatMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-ai`,
          role: 'model',
          text: localAnswer,
          timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
          source: 'Локальное аналитическое ядро АРС 2026',
        },
      ]);
      setIsTyping(false);
    },
    [data, references]
  );

  const handleInspectWagon = useCallback(
    (wagonNumber: string) => {
      handleAskAnalyst(
        `Дай полную информацию по вагону № ${wagonNumber}: история ремонтов, заказчик, текущий статус, локация/путь и причины простоя.`
      );
    },
    [handleAskAnalyst]
  );

  const effectiveDepotKey = currentUser.role === 'branch' ? currentUser.branchCode : 'ALL';
  const kpiData = BRANCH_KPI_PRESETS[effectiveDepotKey] || BRANCH_KPI_PRESETS.ALL;

  return (
    <div className="space-y-6">
      {/* Module Context & Navigation Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-800 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                Модуль №1
              </span>
              <h1 className="text-base font-bold text-slate-900">
                Производственный отдел ТОО «Astana Railway Services»
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Контроль выполнения плана ремонта вагонов, дислокации путей отстоя, оборота колёсных пар и суточных смен по 4 ВРД за 2026 г.
            </p>
          </div>

          {/* Module Tab Switcher */}
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('plans')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'plans'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
              <span>Сводка планов</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('dislocation')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'dislocation'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Train className="w-3.5 h-3.5 text-amber-600" />
              <span>Дислокация вагонов</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('wheelsets')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'wheelsets'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CircleDot className="w-3.5 h-3.5 text-emerald-600" />
              <span>Колёсные пары</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('daily')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'daily'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarCheck className="w-3.5 h-3.5 text-indigo-600" />
              <span>Суточный выпуск</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('analyst')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === 'analyst'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>ИИ-Аналитик</span>
            </button>
          </div>
        </div>
      </div>

      {/* Production KPIs Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white border border-slate-200 rounded-lg p-3.5">
          <div className="text-[11px] text-slate-500 font-medium truncate">План на октябрь</div>
          <div className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-0.5">
            {kpiData.plan}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">{kpiData.planSub}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5">
          <div className="text-[11px] text-slate-500 font-medium truncate">Факт выпуска (окт)</div>
          <div className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-0.5">
            {kpiData.fact}
          </div>
          <div className="text-[11px] text-blue-700 font-semibold mt-1 truncate">
            {kpiData.pct} {kpiData.factSub}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5">
          <div className="text-[11px] text-slate-500 font-medium truncate">Отклонение от плана</div>
          <div
            className={`text-xl font-bold font-mono tabular-nums mt-0.5 ${
              kpiData.variance < 0 ? 'text-red-700' : 'text-emerald-700'
            }`}
          >
            {kpiData.variance > 0 ? `+${kpiData.variance}` : kpiData.variance}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">{kpiData.varSub}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5">
          <div className="text-[11px] text-slate-500 font-medium truncate">Парк КТТ / Собств.</div>
          <div className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-0.5">
            {kpiData.ktt} / {kpiData.own}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">{kpiData.parkSub}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5">
          <div className="text-[11px] text-slate-500 font-medium truncate">Неоконченный ремонт</div>
          <div
            className={`text-xl font-bold font-mono tabular-nums mt-0.5 ${
              kpiData.unfinished > 5 ? 'text-red-700' : 'text-amber-700'
            }`}
          >
            {kpiData.unfinished}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 truncate">{kpiData.unfinishedSub}</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-3.5">
          <div className="text-[11px] text-slate-500 font-medium truncate">Выпуск с начала года</div>
          <div className="text-xl font-bold text-slate-900 font-mono tabular-nums mt-0.5">
            {kpiData.ytd}
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-1 truncate">
            {kpiData.ytdSub}
          </div>
        </div>
      </div>

      {/* Main View Port based on Active Production Tab */}
      <div className="transition-opacity duration-150">
        {activeTab === 'analyst' && (
          <AnalystWorkspace
            data={data}
            currentUser={currentUser}
            messages={chatMessages}
            isLoading={isTyping}
            onSendPrompt={handleAskAnalyst}
            onResetChat={() =>
              setChatMessages([
                {
                  id: 'msg-welcome',
                  role: 'model',
                  text: getInitialBriefing(currentUser),
                  timestamp: '2026-10-20 08:00',
                  source: 'АРС Аналитическая База 2026',
                },
              ])
            }
            selectedWagonNumber={selectedWagonNumber}
            onSelectWagonNumber={(num) => {
              setSelectedWagonNumber(num);
              handleInspectWagon(num);
            }}
          />
        )}

        {activeTab === 'plans' && (
          <PlanSummaryView data={data} onAskAnalyst={handleAskAnalyst} />
        )}

        {activeTab === 'dislocation' && (
          <DislocationView
            data={data}
            onAskAnalyst={handleAskAnalyst}
            onInspectWagon={handleInspectWagon}
          />
        )}

        {activeTab === 'wheelsets' && (
          <WheelPairsView data={data} onAskAnalyst={handleAskAnalyst} />
        )}

        {activeTab === 'daily' && (
          <DailyOutputView
            data={data}
            references={references}
            onAskAnalyst={handleAskAnalyst}
            currentUser={currentUser}
          />
        )}
      </div>
    </div>
  );
};
