import React from 'react';
import {
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Building2,
  Wrench,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react';
import { ArsDataset } from '../../types/ars';
import { PlatformUserSession } from '../../types/platform';
import { PLATFORM_MODULES } from '../registry';

interface ExecutiveDashboardProps {
  data: ArsDataset;
  currentUser: PlatformUserSession;
  onNavigateToProduction: (tab?: 'analyst' | 'plans' | 'dislocation' | 'wheelsets' | 'daily', depotCode?: string) => void;
  onSelectModule: (moduleId: string) => void;
}

export const ExecutiveDashboard: React.FC<ExecutiveDashboardProps> = ({
  data,
  currentUser,
  onNavigateToProduction,
  onSelectModule,
}) => {
  // Aggregate KPI numbers from summary reports for HQ
  const totalRow = data.summary_reports.find((r) => r.row_index === 80) || {
    month_plan: 690,
    done_month: 448,
    plan_variance: -242,
    completion_pct: 64.9,
    done_today: 15,
    staged_today: 13,
    unfinished_repair: 21,
    ytd_total: 5058,
  };

  const depotRows = data.summary_reports.filter(
    (r) => r.row_index >= 76 && r.row_index <= 79
  );

  return (
    <div className="space-y-6">
      {/* Executive Welcome & Context Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              <span>{currentUser.departmentName}</span>
              <span aria-hidden="true">·</span>
              <span>{currentUser.position}</span>
            </div>
            <h1 className="text-xl lg:text-2xl font-bold text-slate-900 tracking-tight">
              Ситуационный центр высшего руководства холдинга АРС
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl">
              Консолидированная картина производственно-хозяйственной деятельности ТОО «Astana Railway Services» за 2026 год.
              Сводная отчетность по 4 вагоноремонтным депо (АВРД, КВРД, БВРД, УВРД) и статус подключения подразделений корпоративной платформы.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
            <button
              type="button"
              onClick={() => onNavigateToProduction('analyst')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Запросить ИИ-анализ холдинга</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateToProduction('plans')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <Wrench className="w-4 h-4 text-slate-600" />
              <span>В производственный модуль</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Top Enterprise Macro KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Выпуск за октябрь 2026 г.</span>
            <span className="font-mono tabular-nums">20.10.2026</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {totalRow.done_month}
              <span className="text-xs font-normal text-slate-500 ml-1">ваг.</span>
            </span>
            <span className="font-mono tabular-nums text-sm font-bold text-blue-700">
              {totalRow.completion_pct.toFixed(1)}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden my-2.5">
            <div
              className="h-full bg-blue-600 rounded-full"
              style={{ width: `${Math.min(100, totalRow.completion_pct)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>План: {totalRow.month_plan} ваг.</span>
            <span className="text-red-700 font-mono font-semibold">Откл.: {totalRow.plan_variance}</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Выпуск с начала года (YTD)</span>
            <span className="text-emerald-700 font-semibold">+958 к плану</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {totalRow.ytd_total?.toLocaleString('ru-RU')}
              <span className="text-xs font-normal text-slate-500 ml-1">ваг.</span>
            </span>
            <span className="font-mono tabular-nums text-sm font-bold text-emerald-700">
              123,4%
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden my-2.5">
            <div className="h-full bg-emerald-600 rounded-full" style={{ width: '100%' }} />
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>План YTD: 4 100 ваг.</span>
            <span className="text-slate-600">Факт за 10 мес.</span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Суточный выпуск / Подача</span>
            <span className="font-mono tabular-nums">Мощность: 28</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-slate-900 font-mono tabular-nums">
              {totalRow.done_today}
              <span className="text-xs font-normal text-slate-500 ml-1">ваг/сут</span>
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-600">
              Подача: <strong>{totalRow.staged_today}</strong> ваг.
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden my-2.5">
            <div
              className="h-full bg-amber-500 rounded-full"
              style={{ width: `${Math.min(100, (totalRow.done_today / 28) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>Загрузка мощностей: 53,6%</span>
            <span className="text-blue-700 cursor-pointer" onClick={() => onNavigateToProduction('daily')}>
              Детализация →
            </span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Неоконченный ремонт</span>
            <span className="text-amber-700 font-semibold">Внимание ПДО</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-red-700 font-mono tabular-nums">
              {totalRow.unfinished_repair}
              <span className="text-xs font-normal text-slate-500 ml-1">ваг.</span>
            </span>
            <span className="text-xs text-slate-500">
              КП: 4 · Сцепка: 1 · ХДВ: 3
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden my-2.5">
            <div className="h-full bg-red-600 rounded-full" style={{ width: '45%' }} />
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>АВРД: 14 ваг. · КВРД: 2 ваг.</span>
            <span className="text-blue-700 cursor-pointer" onClick={() => onNavigateToProduction('dislocation')}>
              Пути отстоя →
            </span>
          </div>
        </div>
      </div>

      {/* Branch Operational Matrix Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Производственные филиалы холдинга АРС (Статус на 20.10.2026)
            </h2>
            <p className="text-xs text-slate-500">
              Сводная готовность депо, исполнение графиков и выявление узких мест с возможностью перехода в изолированный контур филиала
            </p>
          </div>
          <span className="text-xs font-medium text-slate-500">
            Всего предприятий в контуре: <strong>4 ВРД</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {depotRows.map((dRow) => {
            const meta = data.depots.find((d) => d.code === dRow.depot_code);
            const isCritical = dRow.completion_pct < 60;
            return (
              <div
                key={dRow.depot_code}
                className="border border-slate-200 rounded-lg p-4 bg-slate-50/60 hover:bg-slate-50 transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                    <span>{meta?.city || dRow.depot_code}</span>
                    <span className="font-mono tabular-nums">Мощность: {meta?.daily_capacity} в/сут</span>
                  </div>
                  <div className="flex items-baseline justify-between mb-2">
                    <h3 className="text-base font-bold text-slate-900">{dRow.depot_code}</h3>
                    <span
                      className={`font-mono tabular-nums text-sm font-bold ${
                        dRow.completion_pct >= 70
                          ? 'text-emerald-700'
                          : isCritical
                          ? 'text-amber-700'
                          : 'text-slate-900'
                      }`}
                    >
                      {dRow.completion_pct.toFixed(1)}%
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span>План / Факт:</span>
                      <span className="font-mono tabular-nums font-semibold text-slate-900">
                        {dRow.done_month} из {dRow.month_plan} ваг.
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Отклонение:</span>
                      <span className="font-mono tabular-nums font-semibold text-red-700">
                        {dRow.plan_variance} ваг.
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Неоконченный ремонт:</span>
                      <span
                        className={`font-mono tabular-nums font-semibold ${
                          dRow.unfinished_repair > 5 ? 'text-red-700' : 'text-slate-800'
                        }`}
                      >
                        {dRow.unfinished_repair} ваг.
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Выпуск за сутки:</span>
                      <span className="font-mono tabular-nums text-slate-800">
                        {dRow.done_today} ваг.
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    YTD: <strong className="text-slate-700 font-mono">{dRow.ytd_total}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigateToProduction('plans', dRow.depot_code)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
                  >
                    <span>Анализ депо</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Corporate Platform Scaling Architecture (Roadmap Overview) */}
      <div className="bg-slate-900 text-white border border-slate-800 rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Layers className="w-4 h-4 text-blue-400 shrink-0" />
              <h2 className="text-base font-bold text-white tracking-tight">
                Архитектурная дорожная карта: Единая цифровая платформа холдинга ARS
              </h2>
            </div>
            <p className="text-xs text-slate-400 max-w-3xl">
              Стратегический план масштабирования платформы на все функциональные подразделения Astana Railway Services.
              Каждый модуль функционирует автономно с сохранением единой дизайн-системы, авторизации и разграничения доступа (RBAC).
            </p>
          </div>
          <span className="px-2.5 py-1 text-[11px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-md self-start lg:self-center">
            Платформа 2026–2027 гг.
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PLATFORM_MODULES.map((mod) => {
            const isActive = mod.status === 'active';
            return (
              <div
                key={mod.id}
                className={`p-4 rounded-lg border transition-all ${
                  isActive
                    ? 'bg-slate-800/90 border-blue-500/50 shadow-xs'
                    : 'bg-slate-800/40 border-slate-700/60'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                      {mod.departmentName}
                    </span>
                    <h3 className="text-sm font-bold text-white mt-0.5">{mod.title}</h3>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 ${
                      isActive
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-slate-700 text-slate-300 border border-slate-600'
                    }`}
                  >
                    {isActive ? 'Активен' : mod.roadmapQuarter || 'В плане'}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed mb-3">{mod.description}</p>

                {mod.roadmapSummary && (
                  <div className="text-[11px] text-slate-400 bg-slate-900/60 p-2.5 rounded border border-slate-800 mb-3">
                    <strong className="text-slate-300">План интеграции:</strong> {mod.roadmapSummary}
                  </div>
                )}

                <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    {isActive ? 'Полный функционал' : 'Готовность архитектуры: 100%'}
                  </span>
                  {isActive && mod.id === 'production' && (
                    <button
                      type="button"
                      onClick={() => onSelectModule('production')}
                      className="text-xs font-semibold text-blue-400 hover:text-blue-300 cursor-pointer inline-flex items-center gap-1"
                    >
                      <span>Открыть модуль</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
