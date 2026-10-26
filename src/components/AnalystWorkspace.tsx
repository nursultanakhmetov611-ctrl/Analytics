import React, { useState, useRef, useEffect } from 'react';
import { Send, Search, Copy, Check, FileSpreadsheet, RotateCcw, ArrowUpRight } from 'lucide-react';
import { ArsAuthSession, ArsDataset, ChatMessage, WagonDislocationRow } from '../types/ars';
import { MarkdownRenderer } from './MarkdownRenderer';
import { StallReasonsMatrix, isolateAiAnalystForBranch } from './StallReasonsMatrix';

interface AnalystWorkspaceProps {
  data: ArsDataset;
  currentUser?: ArsAuthSession | null;
  messages: ChatMessage[];
  isLoading: boolean;
  onSendPrompt: (prompt: string) => void;
  onResetChat: () => void;
  selectedWagonNumber: string;
  onSelectWagonNumber: (num: string) => void;
}

const HQ_PRESET_QUERIES = [
  {
    label: 'Сводная таблица простоев по депо и причинам',
    prompt: 'Визуализируй сводную таблицу по всем депо: количество вагонов в простое, распределенное по причинам (КП, автосцепка, неисправность механизмов, ожидание подачи).',
  },
  {
    label: 'Свод плана и факта за октябрь 2026',
    prompt: 'Представь полный анализ выполнения плана ремонта вагонов за октябрь 2026 г. по всем 4 филиалам (БВРД, АВРД, КВРД, УВРД) и видам ремонта (ДР, КР, КРП, ТОР) с точными цифрами плана, факта, отклонения и процента выполнения в таблице Markdown.',
  },
  {
    label: 'Неоконченный ремонт и причины простоев',
    prompt: 'Проанализируй неоконченный ремонт по холдингу и пономерной список задержанных вагонов в КВРД: укажи номера вагонов, заказчиков, виды ремонта, пути отстоя (51, 52, 54, 58, 59 пути) и точные причины простоев (брак автосцепки, ожидание/брак КП, неподача в цех/со станции).',
  },
  {
    label: 'Анализ ключевых заказчиков (КТТ, KTZ Express, ЦЖС)',
    prompt: 'Сделай детальный срез выполнения плана за октябрь 2026 и с начала года (YTD) по ключевым заказчикам: АО "Казтемиртранс" (КТТ), АО "KTZ Express", ТОО "ЦЖС" и частным операторам по каждому депо.',
  },
  {
    label: 'Баланс и расход колёсных пар (СОНК, ЦКК, обточка)',
    prompt: 'Представь аналитический отчет по балансу, запасам (СОНК, ЦКК, ремфонд КТТ, оси под КР) и расходу колёсных пар (СР с обточкой, ТР с обточкой, СОНК СР б/о, давальческие) за 2026 год в таблицах Markdown.',
  },
  {
    label: 'Загрузка мощностей депо (28 ваг/сут)',
    prompt: 'Сравни нормативную суточную мощность 4 депо (БВРД — 6, АВРД — 8, КВРД — 7, УВРД — 7 ваг/сут) с фактическим среднесуточным и пиковым выпуском в октябре 2026 года. Где имеются резервы и узкие места?',
  },
];

const QUICK_WAGON_EXAMPLES = [
  { num: '52509312', note: 'Феникс Рейл · КР · брак автосцепки' },
  { num: '94511425', note: 'KTZ Express · ДР · ожидание КП' },
  { num: '64780950', note: 'ПГК Центр. Азия · ТОР · Брак КП' },
  { num: '98333826', note: 'KTZ Express · ДР · не подали со ст.' },
  { num: '42526723', note: 'ЦЖС · ДР · на 54 пути' },
  { num: '28808749', note: 'КТТ · КР · на 59 пути' },
  { num: '61895488', note: 'КТТ · КР · не подан в цех' },
  { num: '00032771', note: 'ЦЖС · КРП · ст.№00000044' },
];

export const AnalystWorkspace: React.FC<AnalystWorkspaceProps> = ({
  data,
  currentUser,
  messages,
  isLoading,
  onSendPrompt,
  onResetChat,
  selectedWagonNumber,
  onSelectWagonNumber,
}) => {
  const [inputPrompt, setInputPrompt] = useState('');
  const [wagonQuery, setWagonQuery] = useState(selectedWagonNumber || '52509312');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isBranch = currentUser?.role === 'branch';
  const myDepot = isBranch ? (currentUser?.depot_code || 'KVRD').toUpperCase() : 'ALL';

  const activePresets = isBranch
    ? [
        {
          label: `Таблица простоев филиала ${myDepot}`,
          prompt: `Покажи аналитическую таблицу филиала ${myDepot}: распределение вагонов в простое и ожидании по причинам.`,
        },
        {
          label: `План и факт филиала ${myDepot} (Октябрь 2026)`,
          prompt: `Дай детальный анализ выполнения плана ремонта вагонов по депо ${myDepot} за октябрь 2026 г. в разрезе видов ремонта и заказчиков.`,
        },
        {
          label: `Неоконченный ремонт и пути (${myDepot})`,
          prompt: `Проанализируй неоконченный ремонт и пономерной список задержанных вагонов в филиале ${myDepot}: укажи номера вагонов, заказчиков, пути отстоя и причины простоев.`,
        },
        {
          label: `Баланс и расход КП (${myDepot})`,
          prompt: `Представь аналитический отчет по балансу, запасам (СОНК, ЦКК, ремфонд КТТ) и расходу колёсных пар по филиалу ${myDepot} за 2026 год.`,
        },
      ]
    : HQ_PRESET_QUERIES;

  useEffect(() => {
    if (selectedWagonNumber) {
      setWagonQuery(selectedWagonNumber);
    }
  }, [selectedWagonNumber]);

  useEffect(() => {
    isolateAiAnalystForBranch();
    const t = setTimeout(isolateAiAnalystForBranch, 60);
    return () => clearTimeout(t);
  }, [currentUser, messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPrompt.trim() || isLoading) return;
    onSendPrompt(inputPrompt.trim());
    setInputPrompt('');
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Find matching wagon records in dislocation database
  const cleanSearch = wagonQuery.trim().toLowerCase();
  const matchedWagons: WagonDislocationRow[] = cleanSearch
    ? data.wagon_dislocations_and_stalls.filter(
        (w) =>
          w.wagon_number.toLowerCase().includes(cleanSearch) ||
          w.customer_name.toLowerCase().includes(cleanSearch) ||
          w.reason_details.toLowerCase().includes(cleanSearch) ||
          w.track_or_location.toLowerCase().includes(cleanSearch)
      )
    : [];

  return (
    <div id="analystWorkspaceRoot" className="analyst-workspace-root space-y-6">
      {/* Cross-Depot Idle & Unfinished Repair Visualization Matrix */}
      <StallReasonsMatrix
        data={data}
        currentUser={currentUser}
        onAskAnalyst={onSendPrompt}
        onInspectWagon={(wNum) => {
          setWagonQuery(wNum);
          onSelectWagonNumber(wNum);
        }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 Columns: Main AI Production Analyst Console */}
      <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl flex flex-col">
        {/* Console Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              {isBranch
                ? `Интеллектуальный аналитик филиала ${myDepot} (${currentUser?.display_name})`
                : 'Интеллектуальный аналитик производственного отдела АРС'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isBranch
                ? `База 2026 г. · Изолированный контур депо ${myDepot} · Свод на 20.10.2026 и дислокация на 22.10.2026`
                : 'База 2026 г. · 4 филиала (БВРД, АВРД, КВРД, УВРД) · Свод на 20.10.2026 и дислокация на 22.10.2026'}
            </p>
          </div>
          <button
            type="button"
            onClick={onResetChat}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/70 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Сбросить диалог
          </button>
        </div>

        {/* Preset Executive Queries Bar */}
        <div className="px-6 py-3 bg-slate-50/70 border-b border-slate-200">
          <div className="text-xs font-medium text-slate-500 mb-2">
            {isBranch
              ? `Быстрые аналитические запросы филиала ${myDepot}:`
              : 'Быстрые аналитические запросы руководства:'}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {activePresets.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                disabled={isLoading}
                onClick={() => onSendPrompt(preset.prompt)}
                className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-blue-50 hover:text-blue-700 border border-slate-200 hover:border-blue-200 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Messages Feed */}
        <div className="p-6 space-y-6 max-h-[680px] overflow-y-auto">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`${
                msg.role === 'user'
                  ? 'bg-slate-900 text-white rounded-xl px-5 py-3.5 ml-auto max-w-2xl'
                  : 'bg-slate-50/60 border border-slate-200 rounded-xl p-5 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between gap-4 mb-2 pb-2 border-b border-slate-200/60">
                <div className="flex items-center gap-2 text-xs">
                  <span className={msg.role === 'user' ? 'font-semibold text-slate-200' : 'font-semibold text-slate-900'}>
                    {msg.role === 'user' ? 'Запрос руководства' : 'Ведущий аналитик ПТО АРС'}
                  </span>
                  <span aria-hidden="true" className="text-slate-400">·</span>
                  <span className={`font-mono tabular-nums ${msg.role === 'user' ? 'text-slate-400' : 'text-slate-500'}`}>
                    {msg.timestamp}
                  </span>
                </div>
                {msg.role === 'model' && (
                  <button
                    type="button"
                    onClick={() => handleCopy(msg.id, msg.text)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
                    title="Скопировать ответ в Markdown"
                  >
                    {copiedId === msg.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Скопировано</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Копировать Markdown</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {msg.role === 'user' ? (
                <p className="text-sm leading-relaxed">{msg.text}</p>
              ) : (
                <MarkdownRenderer
                  content={msg.text}
                  onWagonClick={(wNum) => {
                    setWagonQuery(wNum);
                    onSelectWagonNumber(wNum);
                  }}
                />
              )}
            </div>
          ))}

          {isLoading && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 animate-pulse space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">
                  Ведущий аналитик ПТО АРС формирует сводку по базе 2026 г...
                </span>
                <span className="text-xs font-mono tabular-nums text-slate-400">Обработка таблиц</span>
              </div>
              <div className="h-3 bg-slate-200 rounded w-3/4"></div>
              <div className="h-24 bg-slate-200/70 rounded w-full"></div>
              <div className="h-3 bg-slate-200 rounded w-1/2"></div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="p-4 bg-slate-50 border-t border-slate-200 rounded-b-xl">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              placeholder="Задайте вопрос по номеру вагона, плану/факту депо, путям отстоя или балансу КП..."
              className="flex-1 bg-white border border-slate-300 focus:border-blue-600 focus:outline-none rounded-lg px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={isLoading || !inputPrompt.trim()}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              Запросить расчёт
            </button>
          </div>
        </form>
      </div>

      {/* Right 4 Columns: Instant Wagon Number Passport & Stall Inspector */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Пономерная проверка вагона
            </h3>
            <span className="text-xs text-slate-500 font-mono tabular-nums">
              {data.wagon_dislocations_and_stalls.length} зап.
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Введите номер вагона (например, <span className="font-mono">52509312</span>), заказчика или путь отстоя для мгновенной выгрузки карточки.
          </p>

          <div className="relative mb-3">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={wagonQuery}
              onChange={(e) => setWagonQuery(e.target.value)}
              placeholder="Номер вагона, заказчик, путь..."
              className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white focus:outline-none rounded-lg text-slate-900"
            />
          </div>

          {/* Quick Wagon Buttons */}
          <div className="mb-4">
            <div className="text-xs text-slate-500 mb-1.5">Контрольные вагоны с замечаниями:</div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_WAGON_EXAMPLES.map((item) => (
                <button
                  key={item.num}
                  type="button"
                  onClick={() => setWagonQuery(item.num)}
                  className={`px-2 py-1 text-xs font-mono tabular-nums rounded border transition-colors cursor-pointer ${
                    wagonQuery === item.num
                      ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                  title={item.note}
                >
                  № {item.num}
                </button>
              ))}
            </div>
          </div>

          {/* Wagon Results */}
          {matchedWagons.length === 0 ? (
            <div className="py-8 px-4 text-center border border-dashed border-slate-200 rounded-lg">
              <p className="text-xs text-slate-500">
                По запросу «{wagonQuery}» вагонов в пономерной дислокации не найдено.
              </p>
              <button
                type="button"
                onClick={() => setWagonQuery('52509312')}
                className="mt-2 px-3 py-1.5 text-xs font-medium text-blue-700 hover:underline cursor-pointer"
              >
                Показать вагон № 52509312
              </button>
            </div>
          ) : (
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {matchedWagons.slice(0, 12).map((w) => (
                <div
                  key={w.id}
                  className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-lg space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono tabular-nums text-sm font-bold text-slate-900">
                      Вагон № {w.wagon_number}
                    </span>
                    <span className="text-xs font-mono tabular-nums text-slate-500">
                      {w.report_date} · {w.raw_sheet}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>Депо: <strong className="text-slate-900">{w.depot_code}</strong></span>
                    <span aria-hidden="true">·</span>
                    <span>Ремонт: <strong className="text-slate-900">{w.repair_type}</strong></span>
                    <span aria-hidden="true">·</span>
                    <span>Подача: <strong className="font-mono tabular-nums text-slate-900">{w.formatted_submission_date}</strong></span>
                  </div>

                  <div className="text-xs space-y-1 pt-1 border-t border-slate-200/80">
                    <div>
                      <span className="text-slate-500">Заказчик: </span>
                      <span className="font-medium text-slate-900">
                        {w.customer_name || 'Не указан'}
                        {w.contract_info ? ` (${w.contract_info})` : ''}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Статус: </span>
                      <span
                        className={`font-semibold ${
                          w.status === 'UNFINISHED'
                            ? 'text-red-700'
                            : w.status === 'RELEASE'
                            ? 'text-emerald-700'
                            : w.status === 'LIFTING'
                            ? 'text-blue-700'
                            : 'text-amber-700'
                        }`}
                      >
                        {w.status_ru}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Локация / Путь: </span>
                      <span className="font-mono text-slate-900 font-medium">
                        {w.track_or_location || 'Пути ВРД / Цех'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Причина / Детали: </span>
                      <span className={`font-medium ${w.status === 'UNFINISHED' ? 'text-red-700' : 'text-slate-800'}`}>
                        {w.reason_details || 'Без замечаний'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        onSendPrompt(
                          `Дай полную аналитическую справку по вагону № ${w.wagon_number}: укажи заказчика, вид ремонта, депо, текущую локацию/путь, историю статусов и причину простоя.`
                        )
                      }
                      className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900 transition-colors cursor-pointer"
                    >
                      <span>Запросить досье у ИИ-аналитика</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Reference Card: Depot Capacities & Workload Coefficients */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileSpreadsheet className="w-4 h-4 text-slate-600" />
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Нормативы мощности и трудоемкости АРС
            </h3>
          </div>
          <div className="space-y-2 text-xs">
            {data.depots.map((d) => (
              <div key={d.code} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                <div>
                  <span className="font-semibold text-slate-900">{d.code}</span>
                  <span className="text-slate-400 mx-1.5">·</span>
                  <span className="text-slate-600">г. {d.city}</span>
                </div>
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  {d.daily_capacity} ваг/сут
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200">
            <div className="text-xs font-semibold text-slate-700 mb-2">
              Коэффициенты трудоемкости по родам вагонов:
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
              {data.wagon_types.map((wt) => (
                <div key={wt.code} className="flex items-center justify-between">
                  <span className="truncate">{wt.name}</span>
                  <span className="font-mono tabular-nums font-medium text-slate-900">
                    {wt.workload_coefficient.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

