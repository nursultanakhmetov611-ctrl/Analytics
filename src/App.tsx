import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  LogOut,
  ShieldCheck,
  Building2,
  LayoutDashboard,
  Wrench,
  Layers,
  ChevronDown,
  ArrowRight,
  Database,
  Calendar,
  Lock,
} from 'lucide-react';
import { ArsDataset, ArsReferences } from './types/ars';
import { PlatformUserSession } from './types/platform';
import { PLATFORM_MODULES } from './modules/registry';
import { PLATFORM_ACCOUNTS } from './core/auth/accounts';
import { ExecutiveDashboard } from './modules/executive/ExecutiveDashboard';
import { ProductionModule, ProductionTab } from './modules/production/ProductionModule';
import { ReferencesModal, DEFAULT_ARS_REFERENCES, loadInitialRepairTypes } from './components/ReferencesModal';
import { LoginModal } from './components/LoginModal';
import { AuditLogModal } from './components/AuditLogModal';
import { enrichDataset } from './utils/arsEngine';
import arsDatasetFallback from './data/ars_dataset.json';

const STORAGE_KEY_REFS = 'ars_references_2026_v1';
const STORAGE_KEY_AUTH = 'ars_auth_session_2026_v2';
const STORAGE_KEY_MODULE = 'ars_active_module_2026';

export default function App() {
  // Enriched initial dataset
  const dataset: ArsDataset = useMemo(() => enrichDataset(arsDatasetFallback), []);

  // References state
  const [references, setReferences] = useState<ArsReferences>(() => {
    if (typeof window === 'undefined') return DEFAULT_ARS_REFERENCES;
    try {
      const stored = localStorage.getItem(STORAGE_KEY_REFS);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.customers && parsed.wagonTypes && parsed.sections && parsed.depots) {
          if (!parsed.repairs || !Array.isArray(parsed.repairs) || parsed.repairs.length === 0) {
            parsed.repairs = loadInitialRepairTypes();
          }
          return parsed;
        }
      }
    } catch (_e) {
      // fallback
    }
    return {
      ...DEFAULT_ARS_REFERENCES,
      repairs: loadInitialRepairTypes(),
    };
  });

  // Current user / RBAC session state
  const [currentUser, setCurrentUser] = useState<PlatformUserSession | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(STORAGE_KEY_AUTH);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (_e) {
      // fallback
    }
    // Default session: General Director (Management)
    const def = PLATFORM_ACCOUNTS.director;
    return {
      username: def.username,
      displayName: def.displayName,
      department: def.department,
      departmentName: def.departmentName,
      position: def.position,
      branchCode: def.branchCode,
      role: def.role,
      dataScope: def.dataScope,
      permissions: def.permissions,
      availableModules: def.availableModules,
      depot_code: def.branchCode,
      display_name: def.displayName,
    };
  });

  // Active platform module
  const [activeModuleId, setActiveModuleId] = useState<string>(() => {
    if (typeof window === 'undefined') return 'executive';
    try {
      const stored = localStorage.getItem(STORAGE_KEY_MODULE);
      if (stored) return stored;
    } catch (_e) {
      // ignore
    }
    return 'executive';
  });

  // Production module internal routing
  const [productionTab, setProductionTab] = useState<ProductionTab>('plans');
  const [productionDepotFilter, setProductionDepotFilter] = useState<string>('ALL');

  // Modals state
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [isModuleDropdownOpen, setIsModuleDropdownOpen] = useState<boolean>(false);

  // Scroll to top button visibility
  const [showScrollTop, setShowScrollTop] = useState<boolean>(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Switch active module with RBAC validation
  const handleSelectModule = useCallback(
    (moduleId: string) => {
      setIsModuleDropdownOpen(false);
      const mod = PLATFORM_MODULES.find((m) => m.id === moduleId);
      if (!mod) return;

      // If branch user tries to open executive, branch users are scoped to production
      if (currentUser && currentUser.role === 'branch' && moduleId === 'executive') {
        alert('Доступ к Сводке высшего руководства ограничен. Для филиалов открыт контур Производственного отдела.');
        return;
      }

      setActiveModuleId(moduleId);
      try {
        localStorage.setItem(STORAGE_KEY_MODULE, moduleId);
      } catch (_e) {
        // ignore
      }
    },
    [currentUser]
  );

  // Seamless transition from Executive Dashboard into Production Module
  const handleNavigateToProduction = useCallback(
    (tab: ProductionTab = 'plans', depotCode: string = 'ALL') => {
      setProductionTab(tab);
      setProductionDepotFilter(depotCode);
      setActiveModuleId('production');
      try {
        localStorage.setItem(STORAGE_KEY_MODULE, 'production');
      } catch (_e) {
        // ignore
      }
    },
    []
  );

  const handleLoginSuccess = useCallback((session: PlatformUserSession) => {
    setCurrentUser(session);
    try {
      localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(session));
    } catch (_e) {
      // ignore
    }

    // Branch users automatically land in production module
    if (session.role === 'branch') {
      setActiveModuleId('production');
    } else {
      setActiveModuleId('executive');
    }
  }, []);

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    try {
      localStorage.removeItem(STORAGE_KEY_AUTH);
    } catch (_e) {
      // ignore
    }
    setIsLoginModalOpen(true);
  }, []);

  const handleUpdateReferences = useCallback((next: ArsReferences) => {
    setReferences(next);
    try {
      localStorage.setItem(STORAGE_KEY_REFS, JSON.stringify(next));
    } catch (_e) {
      // ignore
    }
  }, []);

  // Global window bindings for backwards-compatibility
  useEffect(() => {
    window.currentUser = currentUser ? {
      username: currentUser.username,
      role: currentUser.role,
      depot_code: currentUser.branchCode,
      display_name: currentUser.displayName,
    } : null;
    window.currentDepot = currentUser?.branchCode || 'ALL';
    window.handleLogout = handleLogout;
    window.switchTab = (tabId: string) => {
      if (['analyst', 'plans', 'dislocation', 'wheelsets', 'daily'].includes(tabId)) {
        setActiveModuleId('production');
        setProductionTab(tabId as ProductionTab);
      }
    };
  }, [currentUser, handleLogout]);

  const activeModuleMeta = useMemo(() => {
    return PLATFORM_MODULES.find((m) => m.id === activeModuleId) || PLATFORM_MODULES[0];
  }, [activeModuleId]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar Contract (1 row, 3 zones, gap-8) */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand title & Platform Identity */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold text-xs tracking-wider">
              АРС
            </div>
            <div className="leading-tight">
              <span className="font-bold text-sm text-slate-900 tracking-tight block whitespace-nowrap">
                Astana Railway Services
              </span>
              <span className="text-[11px] text-slate-500 block whitespace-nowrap">
                Корпоративная цифровая платформа
              </span>
            </div>
          </div>

          {/* Zone 2: Global Module Switcher (App Shell) */}
          <div className="relative">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => handleSelectModule('executive')}
                disabled={currentUser?.role === 'branch'}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  activeModuleId === 'executive'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : currentUser?.role === 'branch'
                    ? 'text-slate-400 cursor-not-allowed opacity-60'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title={
                  currentUser?.role === 'branch'
                    ? 'Доступно только высшему руководству и ЦА'
                    : 'Консолидированная витрина высшего руководства'
                }
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-blue-600" />
                <span>Сводка руководства</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectModule('production')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  activeModuleId === 'production'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Wrench className="w-3.5 h-3.5 text-amber-600" />
                <span>Производственный отдел</span>
                <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.2 rounded ml-0.5">
                  Модуль №1
                </span>
              </button>

              {/* All Modules Popover Trigger */}
              <button
                type="button"
                onClick={() => setIsModuleDropdownOpen((v) => !v)}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  isModuleDropdownOpen || !['executive', 'production'].includes(activeModuleId)
                    ? 'bg-slate-200 text-slate-900'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-purple-600" />
                <span>Модули холдинга</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
            </div>

            {/* Dropdown Menu of All Platform Modules */}
            {isModuleDropdownOpen && (
              <div
                className="absolute left-0 mt-1.5 w-80 bg-white border border-slate-200 rounded-xl shadow-lg p-2 z-50 divide-y divide-slate-100"
                onMouseLeave={() => setIsModuleDropdownOpen(false)}
              >
                <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Модули корпоративной платформы АРС
                </div>
                <div className="py-1 space-y-0.5">
                  {PLATFORM_MODULES.map((mod) => {
                    const isActiveModule = activeModuleId === mod.id;
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => handleSelectModule(mod.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between text-xs transition-colors cursor-pointer ${
                          isActiveModule
                            ? 'bg-blue-50 text-blue-900 font-semibold'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="font-bold truncate">{mod.title}</div>
                          <div className="text-[10px] text-slate-500 truncate">{mod.departmentName}</div>
                        </div>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${
                            mod.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {mod.status === 'active' ? 'Активен' : mod.roadmapQuarter || 'В плане'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Zone 3: RBAC Session Context & Actions */}
          <div className="flex items-center gap-3 shrink-0">
            {currentUser ? (
              <div className="flex items-center gap-3">
                <div className="hidden lg:block text-right">
                  <div className="text-xs font-bold text-slate-900 leading-tight">
                    {currentUser.displayName}
                  </div>
                  <div className="text-[11px] text-slate-500 leading-tight">
                    {currentUser.position} ·{' '}
                    <strong className="text-blue-700">
                      {currentUser.role === 'branch' ? currentUser.branchCode : 'Холдинг'}
                    </strong>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (window.openReferencesModal) window.openReferencesModal();
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                  title="Справочники АРС"
                >
                  <span>⚙️ Справочники</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (window.openAuditLogModal) window.openAuditLogModal();
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                  title="Журнал аудита действий"
                >
                  <span>📋 Аудит</span>
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1 p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  title="Сменить учётную запись / Выход"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsLoginModalOpen(true)}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                Войти в систему
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentUser ? (
          <>
            {activeModuleId === 'executive' && (
              <ExecutiveDashboard
                data={dataset}
                currentUser={currentUser}
                onNavigateToProduction={handleNavigateToProduction}
                onSelectModule={handleSelectModule}
              />
            )}

            {activeModuleId === 'production' && (
              <ProductionModule
                data={dataset}
                references={references}
                currentUser={currentUser}
                initialTab={productionTab}
                initialDepotFilter={productionDepotFilter}
                onUpdateReferences={handleUpdateReferences}
              />
            )}

            {!['executive', 'production'].includes(activeModuleId) && (
              <div className="bg-white border border-slate-200 rounded-xl p-8 max-w-3xl mx-auto text-center space-y-4">
                <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center mx-auto">
                  <Layers className="w-6 h-6" />
                </div>
                <div className="inline-block px-2.5 py-0.5 rounded text-[11px] font-bold bg-purple-100 text-purple-800 uppercase tracking-wider">
                  План масштабирования · {activeModuleMeta.roadmapQuarter || '2027'}
                </div>
                <h2 className="text-xl font-bold text-slate-900">{activeModuleMeta.title}</h2>
                <p className="text-xs text-slate-500 max-w-xl mx-auto leading-relaxed">
                  {activeModuleMeta.description}
                </p>

                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-left text-xs text-slate-700 space-y-2 mt-4 max-w-lg mx-auto">
                  <div className="font-bold text-slate-900">Архитектурная спецификация модуля:</div>
                  <div>• <strong>Подразделение:</strong> {activeModuleMeta.departmentName}</div>
                  <div>• <strong>Статус реализации:</strong> {activeModuleMeta.roadmapSummary || 'Проектирование схемы данных'}</div>
                  <div>• <strong>Изоляция:</strong> Автономная бизнес-логика с подключением к единому RBAC и аудиту</div>
                </div>

                <div className="pt-4">
                  <button
                    type="button"
                    onClick={() => handleSelectModule('production')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  >
                    <span>Вернуться в Производственный отдел</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center py-24">
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center max-w-md shadow-sm">
              <Lock className="w-8 h-8 text-blue-600 mx-auto mb-3" />
              <h2 className="text-base font-bold text-slate-900 mb-1">
                Требуется авторизация в платформе АРС
              </h2>
              <p className="text-xs text-slate-500 mb-4">
                Пожалуйста, выберите учётную запись для входа в ваше рабочее пространство.
              </p>
              <button
                type="button"
                onClick={() => setIsLoginModalOpen(true)}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                Открыть окно авторизации
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Global Modals */}
      <ReferencesModal
        references={references}
        onUpdateReferences={handleUpdateReferences}
        currentUser={currentUser}
      />

      <AuditLogModal
        currentUser={currentUser}
        references={references}
      />

      <LoginModal
        isOpen={isLoginModalOpen || !currentUser}
        references={references}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Floating Scroll-to-Top Button */}
      {showScrollTop && (
        <button
          type="button"
          onClick={handleScrollToTop}
          className="fixed bottom-6 right-6 p-2.5 rounded-full bg-slate-900 text-white shadow-lg hover:bg-slate-800 transition-all cursor-pointer z-30"
          title="Наверх"
          aria-label="Наверх"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 19V5" />
            <path d="m5 12 7-7 7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}
