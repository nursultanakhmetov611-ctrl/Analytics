import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Lock, User, ShieldCheck, Building2, AlertCircle, KeyRound } from 'lucide-react';
import { ArsAuthSession, ArsReferences, ArsUserAccount } from '../types/ars';

export const ARS_USERS: Record<string, ArsUserAccount> = {
  // Головной офис (полный доступ)
  astana: {
    password: 'ars2026',
    role: 'headquarters',
    depot_code: 'ALL',
    display_name: 'Головной офис АРС (Астана)',
  },
  admin: {
    password: 'admin2026',
    role: 'headquarters',
    depot_code: 'ALL',
    display_name: 'Администратор холдинга АРС',
  },

  // Мастера филиалов (строго изолированный контур своего депо)
  kushmurun: {
    password: 'kush2026',
    role: 'branch',
    depot_code: 'KVRD',
    display_name: 'Кушмурунское ВРД (КВРД)',
  },
  arys: {
    password: 'arys2026',
    role: 'branch',
    depot_code: 'AVRD',
    display_name: 'Арысское ВРД (АВРД)',
  },
  balkhash: {
    password: 'balkh2026',
    role: 'branch',
    depot_code: 'BVRD',
    display_name: 'Балхашское ВРД (БВРД)',
  },
  uralsk: {
    password: 'ural2026',
    role: 'branch',
    depot_code: 'UVRD',
    display_name: 'Уральское ВРД (УВРД)',
  },
};

export function buildEffectiveArsUsers(
  references: ArsReferences
): Record<string, ArsUserAccount> {
  const combined: Record<string, ArsUserAccount> = { ...ARS_USERS };

  // Новые депо, добавленные через справочник, автоматически получают логин [код_депо_в_нижнем_регистре] и пароль [код]2026
  const existingDepotCodes = new Set(
    Object.values(ARS_USERS).map((u) => u.depot_code.toUpperCase())
  );

  for (const dep of references.depots) {
    const upperCode = dep.code.trim().toUpperCase();
    const lowerCode = dep.code.trim().toLowerCase();
    if (!lowerCode) continue;

    if (!existingDepotCodes.has(upperCode) && !combined[lowerCode]) {
      combined[lowerCode] = {
        password: `${lowerCode}2026`,
        role: 'branch',
        depot_code: upperCode,
        display_name: dep.name || `Филиал ${upperCode}`,
      };
    }
  }

  return combined;
}

interface LoginModalProps {
  isOpen: boolean;
  references: ArsReferences;
  onLoginSuccess: (session: ArsAuthSession) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  references,
  onLoginSuccess,
}) => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const effectiveUsers = buildEffectiveArsUsers(references);

  const performLogin = useCallback(
    (loginStr?: string, passStr?: string) => {
      const rawUser = (
        loginStr !== undefined
          ? loginStr
          : (document.getElementById('loginUsernameInput') as HTMLInputElement | null)?.value ??
            username
      )
        .trim()
        .toLowerCase();

      const rawPass = (
        passStr !== undefined
          ? passStr
          : (document.getElementById('loginPasswordInput') as HTMLInputElement | null)?.value ??
            password
      ).trim();

      if (!rawUser || !rawPass) {
        setErrorMsg('Пожалуйста, введите логин и пароль учётной записи АРС.');
        return;
      }

      const account = effectiveUsers[rawUser];
      if (!account || account.password !== rawPass) {
        setErrorMsg('Неверный логин или пароль. Выберите тестовый аккаунт из памятки ниже.');
        return;
      }

      setErrorMsg(null);
      onLoginSuccess({
        username: rawUser,
        role: account.role,
        depot_code: account.depot_code,
        display_name: account.display_name,
      });
    },
    [effectiveUsers, username, password, onLoginSuccess]
  );

  const fillLoginCredentials = useCallback((u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setErrorMsg(null);
    const userEl = document.getElementById('loginUsernameInput') as HTMLInputElement | null;
    const passEl = document.getElementById('loginPasswordInput') as HTMLInputElement | null;
    if (userEl) userEl.value = u;
    if (passEl) passEl.value = p;
  }, []);

  useEffect(() => {
    window.ARS_USERS = effectiveUsers;
    window.handleLogin = () => performLogin();
    window.fillLoginCredentials = fillLoginCredentials;
  }, [effectiveUsers, performLogin, fillLoginCredentials]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLogin(username, password);
  };

  const hqEntries = Object.entries(effectiveUsers).filter(
    ([, acc]) => acc.role === 'headquarters'
  );
  const branchEntries = Object.entries(effectiveUsers).filter(
    ([, acc]) => acc.role === 'branch'
  );

  const modalNode = (
    <div
      id="modalLogin"
      className="modal-backdrop"
      style={{
        display: isOpen ? 'flex' : 'none',
        zIndex: 60,
        backgroundColor: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        className="modal-card"
        style={{
          maxWidth: '680px',
          width: '100%',
          border: '1px solid #CBD5E1',
          borderRadius: '14px',
        }}
      >
        {/* Заголовок окна авторизации */}
        <div
          className="modal-header"
          style={{
            background: '#1B365D',
            color: '#FFFFFF',
            padding: '18px 24px',
            borderBottom: '1px solid #0F223D',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4 text-white" />
            </div>
            <div>
              <div
                className="modal-title"
                style={{ color: '#FFFFFF', fontSize: '16px', fontWeight: 700 }}
              >
                ТОО "Astana Railway Services" | Авторизация в системе
              </div>
              <div className="text-xs text-slate-200 mt-0.5">
                Единый контур управления суточной справкой и ролевой изоляции филиалов (RBAC · 2026)
              </div>
            </div>
          </div>
        </div>

        {/* Тело модального окна входа */}
        <div className="modal-body" style={{ padding: '24px' }}>
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="ref-form-group">
                <label htmlFor="loginUsernameInput">Логин пользователя:</label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="loginUsernameInput"
                    type="text"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="Например: astana или kushmurun"
                    autoComplete="username"
                    style={{ paddingLeft: '34px', height: '38px', fontSize: '13px' }}
                    className="font-mono"
                  />
                </div>
              </div>

              <div className="ref-form-group">
                <label htmlFor="loginPasswordInput">Пароль:</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="loginPasswordInput"
                    type="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="Введите пароль..."
                    autoComplete="current-password"
                    style={{ paddingLeft: '34px', height: '38px', fontSize: '13px' }}
                    className="font-mono"
                  />
                </div>
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-4 pt-1">
              <div className="text-xs text-slate-500">
                Нажмите на любую тестовую учётную запись ниже для мгновенного автозаполнения
              </div>
              <button
                id="loginSubmitBtn"
                type="submit"
                className="btn btn-primary"
                style={{
                  background: '#1B365D',
                  borderColor: '#1B365D',
                  padding: '9px 22px',
                  fontSize: '13px',
                }}
              >
                Войти в систему
              </button>
            </div>
          </form>

          {/* Интерактивная подсказка с тестовыми аккаунтами */}
          <div className="mt-6 pt-5 border-t border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Тестовые учётные записи для проверки ролей (клик автозаполняет поля)
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Всего аккаунтов: {Object.keys(effectiveUsers).length}
              </span>
            </div>

            {/* Группа 1: Головной офис */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1B365D]">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Головной офис (полный доступ ко всем филиалам — ALL):</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {hqEntries.map(([loginKey, acc]) => {
                  const isSelected = username === loginKey && password === acc.password;
                  return (
                    <div
                      key={loginKey}
                      onClick={() => fillLoginCredentials(loginKey, acc.password)}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-blue-50/80 border-blue-600 ring-1 ring-blue-600/30'
                          : 'bg-slate-50/80 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {acc.display_name}
                        </div>
                        <div className="text-[11px] font-mono text-slate-600 mt-0.5">
                          логин: <strong className="text-[#1B365D]">{loginKey}</strong> · пароль:{' '}
                          <strong className="text-slate-900">{acc.password}</strong>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          fillLoginCredentials(loginKey, acc.password);
                          performLogin(loginKey, acc.password);
                        }}
                        className="px-2 py-1 text-[11px] font-semibold bg-white border border-slate-300 hover:border-[#1B365D] hover:text-[#1B365D] rounded text-slate-700 shrink-0 cursor-pointer"
                        title="Быстрый вход в 1 клик"
                      >
                        Вход →
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Группа 2: Мастера филиалов / Депо */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                <Building2 className="w-3.5 h-3.5" />
                <span>Мастера филиалов (строго изолированный контур своего депо):</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {branchEntries.map(([loginKey, acc]) => {
                  const isSelected = username === loginKey && password === acc.password;
                  return (
                    <div
                      key={loginKey}
                      onClick={() => fillLoginCredentials(loginKey, acc.password)}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-emerald-50/80 border-emerald-600 ring-1 ring-emerald-600/30'
                          : 'bg-slate-50/80 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900">
                            {acc.depot_code}
                          </span>
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {acc.display_name}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-slate-600 mt-0.5">
                          логин: <strong className="text-emerald-800">{loginKey}</strong> · пароль:{' '}
                          <strong className="text-slate-900">{acc.password}</strong>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          fillLoginCredentials(loginKey, acc.password);
                          performLogin(loginKey, acc.password);
                        }}
                        className="px-2 py-1 text-[11px] font-semibold bg-white border border-slate-300 hover:border-emerald-700 hover:text-emerald-800 rounded text-slate-700 shrink-0 cursor-pointer"
                        title="Быстрый вход в 1 клик"
                      >
                        Вход →
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="text-[11px] text-slate-500 pt-1">
                💡 Новые депо, добавленные через «⚙️ Справочники», автоматически получают логин{' '}
                <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-700">
                  [код_депо_в_нижнем_регистре]
                </code>{' '}
                и пароль{' '}
                <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-700">
                  [код]2026
                </code>
                .
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(modalNode, document.body);
};
