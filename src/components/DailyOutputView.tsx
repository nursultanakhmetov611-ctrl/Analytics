import React, { useState, useMemo } from 'react';
import { ArrowUpRight, Search } from 'lucide-react';
import { ArsDataset } from '../types/ars';

interface DailyOutputViewProps {
  data: ArsDataset;
  onAskAnalyst: (prompt: string) => void;
}

export const DailyOutputView: React.FC<DailyOutputViewProps> = ({ data, onAskAnalyst }) => {
  const [selectedDepot, setSelectedDepot] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const dailyRows = data.daily_output_october;

  // Build Day-by-Day (1..23 Oct) matrix of total wagon output per depot
  const dailyMatrix = useMemo(() => {
    const days = Array.from({ length: 23 }, (_, i) => i + 1);
    const byDay: Record<number, { AVRD: number; BVRD: number; KVRD: number; UVRD: number; total: number }> = {};
    for (const d of days) {
      byDay[d] = { AVRD: 0, BVRD: 0, KVRD: 0, UVRD: 0, total: 0 };
    }

    for (const row of dailyRows) {
      if (row.customer_name.includes('ВСЕГО ПО РЕМОНТУ ВАГОНОВ')) {
        const day = row.day_of_month;
        if (byDay[day] && (row.depot_code === 'AVRD' || row.depot_code === 'BVRD' || row.depot_code === 'KVRD' || row.depot_code === 'UVRD')) {
          byDay[day][row.depot_code] = row.wagons_output;
        }
      }
    }

    for (const d of days) {
      byDay[d].total = byDay[d].AVRD + byDay[d].BVRD + byDay[d].KVRD + byDay[d].UVRD;
    }

    return { days, byDay };
  }, [dailyRows]);

  const filteredDetailRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return dailyRows.filter((r) => {
      const matchDepot = selectedDepot === 'ALL' ? true : r.depot_code === selectedDepot;
      const matchQuery =
        !q ||
        r.customer_name.toLowerCase().includes(q) ||
        r.wagon_type.toLowerCase().includes(q) ||
        r.report_date.includes(q);
      return matchDepot && matchQuery;
    });
  }, [dailyRows, selectedDepot, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Daily Matrix across 4 Depots vs Daily Capacity (28 wagons/day) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Суточный график выпуска вагонов по 4 филиалам за октябрь 2026 г. (норматив холдинга — 28 ваг/сут)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Сравнение ежедневного фактического выпуска из ремонта с паспортной суточной мощностью депо: АВРД (8), КВРД (7), УВРД (7), БВРД (6)
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              onAskAnalyst(
                'Проанализируй суточную динамику выпуска вагонов и колёсных пар за октябрь 2026 г. по депо АВРД, БВРД, КВРД и УВРД в сравнении с их суточной мощностью.'
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <span>Анализ ритмичности выпуска в ИИ</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2.5 px-3 text-left whitespace-nowrap">Депо (Мощность)</th>
                {dailyMatrix.days.map((d) => (
                  <th key={d} className="py-2.5 px-2 text-right font-mono tabular-nums">
                    {String(d).padStart(2, '0')}.10
                  </th>
                ))}
                <th className="py-2.5 px-3 text-right whitespace-nowrap bg-slate-100">Сумма</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70">
              {[
                { code: 'AVRD' as const, label: 'АВРД (8 ваг/сут)', cap: 8 },
                { code: 'KVRD' as const, label: 'КВРД (7 ваг/сут)', cap: 7 },
                { code: 'UVRD' as const, label: 'УВРД (7 ваг/сут)', cap: 7 },
                { code: 'BVRD' as const, label: 'БВРД (6 ваг/сут)', cap: 6 },
              ].map((dep) => {
                let rowSum = 0;
                return (
                  <tr key={dep.code} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-semibold text-slate-900 whitespace-nowrap">
                      {dep.label}
                    </td>
                    {dailyMatrix.days.map((d) => {
                      const val = dailyMatrix.byDay[d][dep.code];
                      rowSum += val;
                      const isAtOrAboveCap = val >= dep.cap;
                      return (
                        <td
                          key={d}
                          className={`py-2.5 px-2 text-right font-mono tabular-nums ${
                            val === 0
                              ? 'text-slate-300'
                              : isAtOrAboveCap
                              ? 'text-emerald-700 font-bold bg-emerald-50/40'
                              : 'text-slate-800'
                          }`}
                        >
                          {val}
                        </td>
                      );
                    })}
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900 bg-slate-50">
                      {rowSum}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-300">
                <td className="py-2.5 px-3 whitespace-nowrap">ИТОГО АРС (28/сут)</td>
                {dailyMatrix.days.map((d) => {
                  const tot = dailyMatrix.byDay[d].total;
                  return (
                    <td key={d} className="py-2.5 px-2 text-right font-mono tabular-nums">
                      {tot}
                    </td>
                  );
                })}
                <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                  {dailyMatrix.days.reduce((acc, d) => acc + dailyMatrix.byDay[d].total, 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Daily Output Records */}
      <div className="bg-white border border-slate-200 rounded-xl">
        <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Посуточный реестр выпуска по заказчикам и родам вагонов ({filteredDetailRows.length} зап.)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Полная детализация ежесуточного выпуска вагонов и освидетельствования колёсных пар за октябрь 2026 г.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {['ALL', 'AVRD', 'KVRD', 'UVRD', 'BVRD'].map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setSelectedDepot(code)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    selectedDepot === code
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {code === 'ALL' ? 'Все депо' : code}
                </button>
              ))}
            </div>

            <div className="relative w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Заказчик, род вагона, дата..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white focus:outline-none rounded-lg text-slate-900"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[540px]">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
                <th className="py-2.5 px-4 text-left">Дата выпуска</th>
                <th className="py-2.5 px-3 text-left">День</th>
                <th className="py-2.5 px-3 text-left">Депо</th>
                <th className="py-2.5 px-4 text-left">Заказчик / Категория</th>
                <th className="py-2.5 px-3 text-left">Базовый код</th>
                <th className="py-2.5 px-4 text-left">Род вагона / Вид работ</th>
                <th className="py-2.5 px-4 text-right">Выпуск (ед.)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70">
              {filteredDetailRows.slice(0, 250).map((r, idx) => {
                const isSummaryRow =
                  r.customer_name.includes('ВСЕГО') || r.customer_name.includes('ИТОГО');
                return (
                  <tr
                    key={idx}
                    className={
                      isSummaryRow
                        ? 'bg-slate-50 font-semibold text-slate-900'
                        : 'hover:bg-slate-50/80 text-slate-800'
                    }
                  >
                    <td className="py-2 px-4 font-mono tabular-nums whitespace-nowrap">{r.report_date}</td>
                    <td className="py-2 px-3 font-mono tabular-nums">{r.day_of_month} окт</td>
                    <td className="py-2 px-3 font-mono font-semibold">{r.depot_code}</td>
                    <td className="py-2 px-4">{r.customer_name}</td>
                    <td className="py-2 px-3 font-mono">{r.repair_type}</td>
                    <td className="py-2 px-4">{r.wagon_type}</td>
                    <td className="py-2 px-4 text-right font-mono tabular-nums font-bold">
                      {r.wagons_output}
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
