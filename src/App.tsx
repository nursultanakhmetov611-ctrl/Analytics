import React, { useState, useEffect } from 'react';
import { ArsDataset, ChatMessage } from './types/ars';
import { AnalystWorkspace } from './components/AnalystWorkspace';
import { PlanSummaryView } from './components/PlanSummaryView';
import { DislocationView } from './components/DislocationView';
import { WheelPairsView } from './components/WheelPairsView';
import { DailyOutputView } from './components/DailyOutputView';

type ActiveTab = 'analyst' | 'plans' | 'dislocation' | 'wheelsets' | 'daily';

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
  const [activeTab, setActiveTab] = useState<ActiveTab>('analyst');
  const [selectedWagonNumber, setSelectedWagonNumber] = useState<string>('52509312');
  const [isQuerying, setIsQuerying] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'initial-briefing',
      role: 'model',
      text: INITIAL_BRIEFING_MARKDOWN,
      timestamp: '20.10.2026 · Свод ПТО АРС',
    },
  ]);

  useEffect(() => {
    async function loadDataset() {
      try {
        const res = await fetch('/api/data');
        if (res.ok) {
          const json = await res.json();
          setData(json);
          setLoadingData(false);
          return;
        }
      } catch (_err) {
        // Fallback to static public asset if needed
      }

      try {
        const fallbackRes = await fetch('/assets/aistudio/ars_ai_studio_context_1a90262a.json');
        const raw = await fallbackRes.json();
        setData(raw);
      } catch (e) {
        console.error('Failed to load ARS dataset:', e);
      } finally {
        setLoadingData(false);
      }
    }
    loadDataset();
  }, []);

  const handleSendPrompt = async (promptText: string) => {
    setActiveTab('analyst');
    const nowStr = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: promptText,
      timestamp: nowStr,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsQuerying(true);

    try {
      const response = await fetch('/api/analyst/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          history: messages.map((m) => ({ role: m.role, text: m.text })),
        }),
      });
      const result = await response.json();
      const replyTime = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      setMessages((prev) => [
        ...prev,
        {
          id: `model-${Date.now()}`,
          role: 'model',
          text: result.answer || 'Не удалось сформировать ответ.',
          timestamp: replyTime,
          source: result.source,
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'model',
          text: 'Произошла ошибка соединения с аналитическим сервером. Пожалуйста, повторите запрос.',
          timestamp: nowStr,
        },
      ]);
    } finally {
      setIsQuerying(false);
    }
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: 'initial-briefing',
        role: 'model',
        text: INITIAL_BRIEFING_MARKDOWN,
        timestamp: '20.10.2026 · Свод ПТО АРС',
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-8 px-6 py-3.5">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('analyst');
            }}
            className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            Astana Railway Services
          </a>

          {/* Zone 2: 5 concise single-line text navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => setActiveTab('analyst')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'analyst'
                  ? 'text-slate-950 font-semibold underline decoration-blue-600 decoration-2 underline-offset-8'
                  : 'hover:text-slate-900'
              }`}
            >
              ИИ-Аналитик
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('plans')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'plans'
                  ? 'text-slate-950 font-semibold underline decoration-blue-600 decoration-2 underline-offset-8'
                  : 'hover:text-slate-900'
              }`}
            >
              План и факт
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('dislocation')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'dislocation'
                  ? 'text-slate-950 font-semibold underline decoration-blue-600 decoration-2 underline-offset-8'
                  : 'hover:text-slate-900'
              }`}
            >
              Дислокация вагонов
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('wheelsets')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'wheelsets'
                  ? 'text-slate-950 font-semibold underline decoration-blue-600 decoration-2 underline-offset-8'
                  : 'hover:text-slate-900'
              }`}
            >
              Колёсные пары
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('daily')}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'daily'
                  ? 'text-slate-950 font-semibold underline decoration-blue-600 decoration-2 underline-offset-8'
                  : 'hover:text-slate-900'
              }`}
            >
              Суточный выпуск
            </button>
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() =>
                handleSendPrompt(
                  'Сформируй развернутый доклад руководству ТОО "Astana Railway Services" по итогам октября 2026 г.: 1) Выполнение плана по 4 депо (БВРД, АВРД, КВРД, УВРД), 2) Анализ по заказчикам (КТТ, KTZ Express, ЦЖС, собственники), 3) Пономерной разбор неоконченного ремонта и причин простоев, 4) Баланс колёсных пар.'
                )
              }
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Сформировать доклад руководству
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-6 space-y-6">
        {/* Executive Context & Full-Width KPI Strip */}
        <section className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-200">
            <div>
              <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2 mb-1">
                <span>ТОО «Astana Railway Services» (АРС)</span>
                <span aria-hidden="true">·</span>
                <span>Производственный отдел</span>
                <span aria-hidden="true">·</span>
                <span>БВРД (6 ваг/сут) / АВРД (8 ваг/сут) / КВРД (7 ваг/сут) / УВРД (7 ваг/сут)</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight text-balance">
                Ситуационный центр и интеллектуальный аналитик ремонта грузовых вагонов (2026 г.)
              </h1>
            </div>

            {/* Mobile Tab Switcher */}
            <div className="flex md:hidden flex-wrap gap-1 p-1 bg-slate-100 rounded-lg">
              {[
                { id: 'analyst', label: 'ИИ-Аналитик' },
                { id: 'plans', label: 'План/Факт' },
                { id: 'dislocation', label: 'Дислокация' },
                { id: 'wheelsets', label: 'Колёсные пары' },
                { id: 'daily', label: 'Суточный' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id as ActiveTab)}
                  className={`px-2.5 py-1 text-xs font-medium rounded ${
                    activeTab === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* 6-Metric Executive Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 pt-5">
            <div>
              <div className="text-xs text-slate-500">План на октябрь 2026</div>
              <div className="font-mono tabular-nums text-xl font-bold text-slate-900 mt-1">
                690 ваг.
              </div>
              <div className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                Плановый: 630 · ТОР: 60
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Факт за октябрь (на 20.10)</div>
              <div className="font-mono tabular-nums text-xl font-bold text-slate-900 mt-1">
                448 ваг. <span className="text-sm font-semibold text-blue-700">(64,9%)</span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                ДР: 305 · КР: 79 · ТОР: 64
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Отклонение от плана</div>
              <div className="font-mono tabular-nums text-xl font-bold text-red-700 mt-1">
                -242 ваг.
              </div>
              <div className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                Плановый: -246 · ТОР: +4
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Парк КТТ / Собственники</div>
              <div className="font-mono tabular-nums text-xl font-bold text-slate-900 mt-1">
                223 / 161 ваг.
              </div>
              <div className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                Вып.: 59,5% КТТ · 63,1% Собств.
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Неоконченный ремонт</div>
              <div className="font-mono tabular-nums text-xl font-bold text-amber-700 mt-1">
                21 ваг.
              </div>
              <div className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                АВРД: 14 · УВРД: 3 · БВРД: 2 · КВРД: 2
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500">Выпуск с начала 2026 г.</div>
              <div className="font-mono tabular-nums text-xl font-bold text-emerald-700 mt-1">
                5 058 ваг.
              </div>
              <div className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                Плановый: 4 131 · ТОР: 927
              </div>
            </div>
          </div>
        </section>

        {/* Active View Content */}
        {loadingData || !data ? (
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
                data={data}
                messages={messages}
                isLoading={isQuerying}
                onSendPrompt={handleSendPrompt}
                onResetChat={handleResetChat}
                selectedWagonNumber={selectedWagonNumber}
                onSelectWagonNumber={setSelectedWagonNumber}
              />
            )}

            {activeTab === 'plans' && (
              <PlanSummaryView data={data} onAskAnalyst={handleSendPrompt} />
            )}

            {activeTab === 'dislocation' && (
              <DislocationView
                data={data}
                onAskAnalyst={handleSendPrompt}
                onInspectWagon={handleInspectWagon}
              />
            )}

            {activeTab === 'wheelsets' && (
              <WheelPairsView data={data} onAskAnalyst={handleSendPrompt} />
            )}

            {activeTab === 'daily' && (
              <DailyOutputView data={data} onAskAnalyst={handleSendPrompt} />
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
              onClick={() => setActiveTab('analyst')}
              className="hover:text-slate-900 cursor-pointer"
            >
              ИИ-Аналитик
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setActiveTab('plans')}
              className="hover:text-slate-900 cursor-pointer"
            >
              Сводные планы
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setActiveTab('dislocation')}
              className="hover:text-slate-900 cursor-pointer"
            >
              Пономерная дислокация
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
