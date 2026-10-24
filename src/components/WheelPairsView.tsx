import React, { useState, useMemo } from 'react';
import { Search, ArrowUpRight } from 'lucide-react';
import { ArsDataset } from '../types/ars';

interface WheelPairsViewProps {
  data: ArsDataset;
  onAskAnalyst: (prompt: string) => void;
}

export const WheelPairsView: React.FC<WheelPairsViewProps> = ({ data, onAskAnalyst }) => {
  const [selectedMonthDate, setSelectedMonthDate] = useState<string>('ALL');
  const [customerQuery, setCustomerQuery] = useState<string>('');
  const [repairFilter, setRepairFilter] = useState<string>('ALL');

  const productionRows = data.wheel_pairs_production;
  const stockRows = data.wheel_pair_stocks;

  const uniqueDates = useMemo(
    () => ['ALL', ...Array.from(new Set(productionRows.map((r) => r.report_date)))],
    [productionRows]
  );

  // Exclude summary duplicate row "Вид ремонта" in 2026-06-30 when computing clean totals
  const filteredProduction = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    return productionRows.filter((r) => {
      if (r.repair_type === 'Вид ремонта') return false;
      const matchDate = selectedMonthDate === 'ALL' ? true : r.report_date === selectedMonthDate;
      const matchRepair = repairFilter === 'ALL' ? true : r.repair_type === repairFilter;
      const matchCustomer =
        !q ||
        r.customer_name.toLowerCase().includes(q) ||
        r.wagon_type.toLowerCase().includes(q);
      return matchDate && matchRepair && matchCustomer;
    });
  }, [productionRows, selectedMonthDate, repairFilter, customerQuery]);

  const totals = useMemo(() => {
    return filteredProduction.reduce(
      (acc, r) => {
        acc.body_units += r.body_units || 0;
        acc.nonk += r.nonk || 0;
        acc.sonk_sr_bo += r.sonk_sr_bo || 0;
        acc.davalcheskie += r.davalcheskie || 0;
        acc.sr_obtochka += r.sr_obtochka || 0;
        acc.tr_obtochka += r.tr_obtochka || 0;
        acc.sr_bez_obtochki += r.sr_bez_obtochki || 0;
        acc.tr_bez_obtochki += r.tr_bez_obtochki || 0;
        acc.total_kp += r.total_kp || 0;
        return acc;
      },
      {
        body_units: 0,
        nonk: 0,
        sonk_sr_bo: 0,
        davalcheskie: 0,
        sr_obtochka: 0,
        tr_obtochka: 0,
        sr_bez_obtochki: 0,
        tr_bez_obtochki: 0,
        total_kp: 0,
      }
    );
  }, [filteredProduction]);

  const latestStockDate = '2026-10-22';
  const latestStocks = stockRows.filter((s) => s.report_date === latestStockDate);

  return (
    <div className="space-y-6">
      {/* Top KPI Summary Cards for Wheelsets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500">Отремонтировано КП (выборка)</div>
          <div className="font-mono tabular-nums text-2xl font-bold text-slate-900 mt-1">
            {totals.total_kp.toLocaleString('ru-RU')} шт.
          </div>
          <div className="text-xs text-slate-600 mt-2 font-mono tabular-nums">
            Под {totals.body_units.toLocaleString('ru-RU')} ваг. (кузовов)
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500">Обточка КП (СР + ТР с обточкой)</div>
          <div className="font-mono tabular-nums text-2xl font-bold text-slate-900 mt-1">
            {(totals.sr_obtochka + totals.tr_obtochka).toLocaleString('ru-RU')} шт.
          </div>
          <div className="text-xs text-slate-600 mt-2 font-mono tabular-nums">
            СР: {totals.sr_obtochka} · ТР: {totals.tr_obtochka}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500">СОНК (СР б/о) + Давальческие</div>
          <div className="font-mono tabular-nums text-2xl font-bold text-slate-900 mt-1">
            {(totals.sonk_sr_bo + totals.davalcheskie).toLocaleString('ru-RU')} шт.
          </div>
          <div className="text-xs text-slate-600 mt-2 font-mono tabular-nums">
            СОНК СР б/о: {totals.sonk_sr_bo} · Давальч.: {totals.davalcheskie}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="text-xs text-slate-500">Остаток на 22.10.2026 (КВРД)</div>
          <div className="font-mono tabular-nums text-2xl font-bold text-slate-900 mt-1">
            83 СОНК · 658 ЦКК
          </div>
          <div className="text-xs text-slate-600 mt-2">
            КТТ: 78 СОНК / 284 ЦКК · KTZ Exp: 5 СОНК / 374 ЦКК
          </div>
        </div>
      </div>

      {/* Wheel Pair Stocks Evolution Table */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Баланс запасов и ремфонда колёсных пар по депо КВРД (динамика Февраль — Октябрь 2026 г.)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Остатки СОНК, цельнокатаных колёс (ЦКК), осей под КР и структура ремфонда АО «Казтемиртранс» и АО «KTZ Express»
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              onAskAnalyst(
                'Проанализируй динамику запасов колёсных пар (СОНК, ЦКК, ремфонд КТТ, оси под КР) с февраля по октябрь 2026 г. и расход КП по видам ремонта.'
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <span>Анализ баланса КП в ИИ</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Latest Snapshot */}
          <div className="lg:col-span-5 border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-100 px-4 py-2.5 text-xs font-semibold text-slate-800 border-b border-slate-200">
              Актуальный баланс запасов на {latestStockDate} (КВРД)
            </div>
            <table className="w-full text-xs border-collapse">
              <tbody className="divide-y divide-slate-200/70">
                {latestStocks.map((st, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-medium text-slate-900">{st.stock_category}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                      {st.quantity} шт.
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-600">
                      {st.details || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Historical Stock Table */}
          <div className="lg:col-span-7 border border-slate-200 rounded-lg overflow-x-auto max-h-64">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
                  <th className="py-2.5 px-4 text-left">Дата отчета</th>
                  <th className="py-2.5 px-3 text-left">Депо</th>
                  <th className="py-2.5 px-4 text-left">Категория запаса / Ремфонд</th>
                  <th className="py-2.5 px-3 text-right">Остаток (шт.)</th>
                  <th className="py-2.5 px-4 text-left">Распределение ремфонда</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {stockRows.slice().reverse().map((st, i) => (
                  <tr key={i} className="hover:bg-slate-50 text-slate-800">
                    <td className="py-2 px-4 font-mono tabular-nums whitespace-nowrap">{st.report_date}</td>
                    <td className="py-2 px-3 font-mono font-semibold">{st.depot_code}</td>
                    <td className="py-2 px-4 font-medium text-slate-900">{st.stock_category}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold">{st.quantity}</td>
                    <td className="py-2 px-4 font-mono text-slate-600">{st.details || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Wheel Pair Consumption & Repair Registry */}
      <div className="bg-white border border-slate-200 rounded-xl">
        <div className="p-5 border-b border-slate-200 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Ведомость расхода и ремонта колёсных пар по заказчикам и родам вагонов
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Детализация по СОНК (СР б/о), давальческим КП, среднему (СР) и текущему (ТР) ремонту с обточкой и без обточки
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                placeholder="Фильтр по заказчику или роду вагона..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white focus:outline-none rounded-lg text-slate-900"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {uniqueDates.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedMonthDate(d)}
                  className={`px-2.5 py-1 text-xs font-mono font-medium rounded-md transition-colors cursor-pointer ${
                    selectedMonthDate === d
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {d === 'ALL' ? 'Все месяцы' : d}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {['ALL', 'ДР', 'КР', 'КРП', 'ТОР', 'ТОР КНР'].map((rt) => (
                <button
                  key={rt}
                  type="button"
                  onClick={() => setRepairFilter(rt)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    repairFilter === rt
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {rt === 'ALL' ? 'Все виды' : rt}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4 text-left whitespace-nowrap">Дата отчета</th>
                <th className="py-3 px-4 text-left whitespace-nowrap">Заказчик</th>
                <th className="py-3 px-3 text-left whitespace-nowrap">Вид рем.</th>
                <th className="py-3 px-3 text-left whitespace-nowrap">Род вагона</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Вагонов</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">СОНК СР б/о</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">Давальч.</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">СР обточка</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">ТР обточка</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">СР б/обт.</th>
                <th className="py-3 px-3 text-right whitespace-nowrap">ТР б/обт.</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Всего КП (рем.)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70">
              {filteredProduction.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50 text-slate-800">
                  <td className="py-2 px-4 font-mono tabular-nums whitespace-nowrap">{row.report_date}</td>
                  <td className="py-2 px-4 font-medium text-slate-900">{row.customer_name}</td>
                  <td className="py-2 px-3 font-mono font-semibold whitespace-nowrap">{row.repair_type}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{row.wagon_type}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold">{row.body_units}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums">
                    {row.sonk_sr_bo > 0 ? <strong className="text-blue-700">{row.sonk_sr_bo}</strong> : '0'}
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums">
                    {row.davalcheskie > 0 ? <strong>{row.davalcheskie}</strong> : '0'}
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums">{row.sr_obtochka}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums">{row.tr_obtochka}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums">{row.sr_bez_obtochki}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums">{row.tr_bez_obtochki}</td>
                  <td className="py-2 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                    {row.total_kp}
                  </td>
                </tr>
              ))}
              {/* Totals Row */}
              <tr className="bg-slate-100 font-bold text-slate-950 border-t-2 border-slate-300">
                <td colSpan={4} className="py-3 px-4 text-left">
                  ИТОГО ПО ВЫБОРКЕ ({filteredProduction.length} записей)
                </td>
                <td className="py-3 px-3 text-right font-mono tabular-nums">{totals.body_units}</td>
                <td className="py-3 px-3 text-right font-mono tabular-nums text-blue-700">{totals.sonk_sr_bo}</td>
                <td className="py-3 px-3 text-right font-mono tabular-nums">{totals.davalcheskie}</td>
                <td className="py-3 px-3 text-right font-mono tabular-nums">{totals.sr_obtochka}</td>
                <td className="py-3 px-3 text-right font-mono tabular-nums">{totals.tr_obtochka}</td>
                <td className="py-3 px-3 text-right font-mono tabular-nums">{totals.sr_bez_obtochki}</td>
                <td className="py-3 px-3 text-right font-mono tabular-nums">{totals.tr_bez_obtochki}</td>
                <td className="py-3 px-4 text-right font-mono tabular-nums">{totals.total_kp}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
