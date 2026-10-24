import React, { useState } from 'react';
import { ArrowUpRight, Filter } from 'lucide-react';
import { ArsDataset, SummaryReportRow } from '../types/ars';

interface PlanSummaryViewProps {
  data: ArsDataset;
  onAskAnalyst: (prompt: string) => void;
}

const SECTION_FILTERS = [
  { id: 'ALL_KEY', label: 'Генеральная сводка по холдингу АРС' },
  { id: 'КТТ', label: 'Парк АО «Казтемиртранс» (КТТ)' },
  { id: 'СОБСТВЕННИКИ', label: 'Парк собственников (КТZ Express, ЦЖС, частные)' },
  { id: 'ПЛАНОВЫЙ СВОД', label: 'Свод планового ремонта (ДР + КР + КРП)' },
  { id: 'ТОР', label: 'Текущий отцепочный ремонт (ТОР)' },
  { id: 'FULL', label: 'Все строки сводного отчета (81 строка)' },
];

const DEPOT_FILTERS = [
  { code: 'ALL', label: 'Все депо и ИТОГО' },
  { code: 'TOTAL', label: 'Только ИТОГО (Холдинг)' },
  { code: 'BVRD', label: 'БВРД (Балхаш)' },
  { code: 'AVRD', label: 'АВРД (Арыс)' },
  { code: 'KVRD', label: 'КВРД (Кушмурун)' },
  { code: 'UVRD', label: 'Уральск (УВРД)' },
];

export const PlanSummaryView: React.FC<PlanSummaryViewProps> = ({ data, onAskAnalyst }) => {
  const [selectedSection, setSelectedSection] = useState<string>('ALL_KEY');
  const [selectedDepot, setSelectedDepot] = useState<string>('ALL');

  // Extract the final 15 rows (66-80) for top depot performance cards
  const overallByDepot = data.summary_reports.filter(
    (r) => r.row_index >= 76 && r.row_index <= 79
  );

  const filteredRows: SummaryReportRow[] = data.summary_reports.filter((row) => {
    const matchesSection =
      selectedSection === 'FULL'
        ? true
        : selectedSection === 'ALL_KEY'
        ? row.sub_segment === 'ХОЛДИНГ ИТОГО' ||
          row.repair_category.includes('ИТОГО') ||
          row.repair_category.includes('ВСЕГО') ||
          row.repair_category.includes('Общее кол-во')
        : row.sub_segment === selectedSection;

    const matchesDepot = selectedDepot === 'ALL' ? true : row.depot_code === selectedDepot;
    return matchesSection && matchesDepot;
  });

  return (
    <div className="space-y-6">
      {/* Depot Performance Breakdown Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {overallByDepot.map((depotRow) => {
          const depotMeta = data.depots.find((d) => d.code === depotRow.depot_code);
          const isLeader = depotRow.completion_pct >= 70;
          return (
            <div
              key={depotRow.depot_code}
              className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-1">
                  <span>{depotMeta?.city || depotRow.depot_code}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    Мощность {depotMeta?.daily_capacity || 7} ваг/сут
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="text-base font-bold text-slate-900">{depotRow.depot_code}</h3>
                  <span
                    className={`font-mono tabular-nums text-lg font-bold ${
                      isLeader ? 'text-emerald-700' : 'text-slate-900'
                    }`}
                  >
                    {depotRow.completion_pct.toFixed(1)}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden my-3">
                  <div
                    className={`h-full rounded-full ${
                      isLeader ? 'bg-emerald-600' : depotRow.completion_pct >= 59 ? 'bg-blue-600' : 'bg-amber-600'
                    }`}
                    style={{ width: `${Math.min(100, depotRow.completion_pct)}%` }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                  <div>
                    <div className="text-slate-500">План окт.</div>
                    <div className="font-mono tabular-nums font-semibold text-slate-900 text-sm">
                      {depotRow.month_plan}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Факт окт.</div>
                    <div className="font-mono tabular-nums font-semibold text-slate-900 text-sm">
                      {depotRow.done_month}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Отклонение</div>
                    <div className="font-mono tabular-nums font-semibold text-red-700 text-sm">
                      {depotRow.plan_variance}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <div className="font-mono tabular-nums">
                  Сутки: <strong>{depotRow.done_today}</strong> · Неоконч.:{' '}
                  <strong className={depotRow.unfinished_repair > 5 ? 'text-red-700' : 'text-slate-900'}>
                    {depotRow.unfinished_repair}
                  </strong>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onAskAnalyst(
                      `Проанализируй выполнение плана за октябрь 2026 г. по депо ${depotRow.depot_code} (${depotMeta?.name}): план ${depotRow.month_plan}, факт ${depotRow.done_month}, отклонение ${depotRow.plan_variance}, неоконченный ремонт ${depotRow.unfinished_repair} ваг. В разрезе ДР, КР, ТОР и заказчиков (КТТ и собственники).`
                    )
                  }
                  className="inline-flex items-center gap-1 font-medium text-blue-700 hover:text-blue-900 cursor-pointer"
                >
                  <span>Разбор</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Summary Table Card */}
      <div className="bg-white border border-slate-200 rounded-xl">
        <div className="p-5 border-b border-slate-200 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Сводная ведомость выполнения плана ремонта вагонов (отчет на 20.10.2026 г.)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Точные показатели плана, факта, отклонений, процента выполнения, суточной подачи и годового итога (YTD)
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                onAskAnalyst(
                  `Сформируй аналитическую записку по разделу «${
                    SECTION_FILTERS.find((s) => s.id === selectedSection)?.label
                  }» с таблицей планов, фактов, отклонений и процента выполнения.`
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Выгрузить аналитику раздела в ИИ</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Interactive Filter Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {SECTION_FILTERS.map((sec) => (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => setSelectedSection(sec.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedSection === sec.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {sec.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {DEPOT_FILTERS.map((df) => (
                  <button
                    key={df.code}
                    type="button"
                    onClick={() => setSelectedDepot(df.code)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      selectedDepot === df.code
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {df.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* High-Density Data Grid */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4 text-left whitespace-nowrap">Раздел отчета</th>
                <th className="py-3 px-3 text-left whitespace-nowrap">Депо</th>
                <th className="py-3 px-4 text-left whitespace-nowrap">Категория ремонта / Заказчик</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">План (окт)</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Факт (окт)</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Отклонение</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">% вып.</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">За сутки</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Подача</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Неоконч.</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">С нач. года (YTD)</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Действие</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70">
              {filteredRows.map((row) => {
                const isTotal = row.depot_code === 'TOTAL' || row.repair_category.includes('ИТОГО') || row.repair_category.includes('ВСЕГО') || row.repair_category.includes('Общее');
                return (
                  <tr
                    key={row.row_index}
                    className={`${
                      row.depot_code === 'TOTAL'
                        ? 'bg-slate-100/70 font-semibold text-slate-950'
                        : isTotal
                        ? 'bg-slate-50/70 font-medium text-slate-900'
                        : 'hover:bg-slate-50 text-slate-800'
                    } transition-colors`}
                  >
                    <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">{row.section}</td>
                    <td className="py-2.5 px-3 font-mono font-semibold whitespace-nowrap">
                      {row.depot_code === 'TOTAL' ? 'ХОЛДИНГ' : row.depot_code}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">{row.repair_category}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{row.month_plan}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold">{row.done_month}</td>
                    <td
                      className={`py-2.5 px-3 text-right font-mono tabular-nums font-semibold ${
                        row.plan_variance < 0
                          ? 'text-red-700'
                          : row.plan_variance > 0
                          ? 'text-emerald-700'
                          : 'text-slate-600'
                      }`}
                    >
                      {row.plan_variance > 0 ? `+${row.plan_variance}` : row.plan_variance}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {row.month_plan > 0 ? (
                        <span
                          className={
                            row.completion_pct >= 100
                              ? 'text-emerald-700 font-semibold'
                              : row.completion_pct < 55
                              ? 'text-red-700'
                              : 'text-slate-900'
                          }
                        >
                          {row.completion_pct.toFixed(1)}%
                        </span>
                      ) : row.done_month > 0 ? (
                        <span className="text-emerald-700">Сверх плана</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{row.done_today}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{row.staged_today}</td>
                    <td
                      className={`py-2.5 px-3 text-right font-mono tabular-nums ${
                        row.unfinished_repair > 0 ? 'text-amber-700 font-semibold' : 'text-slate-400'
                      }`}
                    >
                      {row.unfinished_repair}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                      {row.ytd_total > 0 ? row.ytd_total.toLocaleString('ru-RU') : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() =>
                          onAskAnalyst(
                            `Дай детальный анализ показателя: Раздел "${row.section}", Депо ${row.depot_code}, Категория "${row.repair_category}". План: ${row.month_plan}, Факт: ${row.done_month}, Отклонение: ${row.plan_variance}, Выполнение: ${row.completion_pct}%, Неоконченный ремонт: ${row.unfinished_repair}.`
                          )
                        }
                        className="text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline cursor-pointer"
                      >
                        Анализ ИИ
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
