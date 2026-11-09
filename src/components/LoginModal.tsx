import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Lock, User, ShieldCheck, Building2, AlertCircle, KeyRound, Wrench, Layers } from 'lucide-react';
import { ArsReferences } from '../types/ars';
import { PlatformUserSession } from '../types/platform';
import { buildEffectivePlatformUsers, PLATFORM_ACCOUNTS } from '../core/auth/accounts';

interface LoginModalProps {
  isOpen: boolean;
  references: ArsReferences;
  onLoginSuccess: (session: PlatformUserSession) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  references,
  onLoginSuccess,
}) => {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const effectiveUsers = buildEffectivePlatformUsers(references);

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
        displayName: account.displayName,
        department: account.department,
        departmentName: account.departmentName,
        position: account.position,
        branchCode: account.branchCode,
        role: account.role,
        dataScope: account.dataScope,
        permissions: account.permissions,
        availableModules: account.availableModules,
        depot_code: account.branchCode,
        display_name: account.displayName,
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
    window.handleLogin = () => performLogin();
    window.fillLoginCredentials = fillLoginCredentials;
  }, [performLogin, fillLoginCredentials]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLogin();
  };

  if (!isOpen) return null;

  // Split into 4 logical groups for RBAC demo
  const managementEntries = Object.entries(effectiveUsers).filter(
    ([, a]) => a.department === 'management'
  );
  const productionHQEntries = Object.entries(effectiveUsers).filter(
    ([, a]) => a.department === 'production' && a.branchCode === 'ALL'
  );
  const branchEntries = Object.entries(effectiveUsers).filter(
    ([, a]) => a.role === 'branch'
  );
  const otherDeptEntries = Object.entries(effectiveUsers).filter(
    ([, a]) => a.department !== 'management' && a.department !== 'production'
  );

  const modalNode = (
    <div
      className="modal-backdrop"
      style={{
        zIndex: 1000,
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(3px)',
      }}
    >
      <div
        className="modal-card"
        style={{
          maxWidth: '820px',
          width: '95%',
          boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          className="modal-header"
          style={{
            background: '#0F172A',
            color: '#FFFFFF',
            borderBottom: '1px solid #1E293B',
            padding: '16px 24px',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                ТОО «Astana Railway Services» · 2026
              </div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Авторизация в Единой корпоративной цифровой платформе ARS
              </h2>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="modal-body overflow-y-auto" style={{ padding: '24px' }}>
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="ref-form-group">
                <label htmlFor="loginUsernameInput" className="text-xs font-semibold text-slate-700 block mb-1">
                  Логин пользователя:
                </label>
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
                    placeholder="Например: director или astana"
                    autoComplete="username"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white focus:outline-none rounded-lg text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div className="ref-form-group">
                <label htmlFor="loginPasswordInput" className="text-xs font-semibold text-slate-700 block mb-1">
                  Пароль:
                </label>
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
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 focus:border-blue-600 focus:bg-white focus:outline-none rounded-lg text-slate-900 font-mono"
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
                Выберите тестовую должность ниже для мгновенного входа в соответствующее рабочее пространство
              </div>
              <button
                id="loginSubmitBtn"
                type="submit"
                className="btn btn-primary"
                style={{
                  background: '#0F172A',
                  borderColor: '#0F172A',
                  padding: '9px 22px',
                  fontSize: '13px',
                }}
              >
                Войти в платформу
              </button>
            </div>
          </form>

          {/* Extended RBAC Accounts Matrix */}
          <div className="mt-6 pt-5 border-t border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Матрица ролевого доступа RBAC по подразделениям и должностям
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Всего профилей: {Object.keys(effectiveUsers).length}
              </span>
            </div>

            {/* Group 1: Высшее руководство */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>1. Высшее руководство холдинга (Executive Dashboard + полный доступ):</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {managementEntries.map(([loginKey, acc]) => {
                  const isSelected = username === loginKey && password === acc.password;
                  return (
                    <div
                      key={loginKey}
                      onClick={() => fillLoginCredentials(loginKey, acc.password)}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-blue-50/80 border-blue-600 ring-1 ring-blue-600/30'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {acc.position} · {acc.displayName}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          логин: <strong className="text-blue-700">{loginKey}</strong> · пароль:{' '}
                          <strong>{acc.password}</strong>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          fillLoginCredentials(loginKey, acc.password);
                          performLogin(loginKey, acc.password);
                        }}
                        className="px-2 py-1 text-[11px] font-semibold bg-white border border-slate-300 hover:border-slate-900 hover:text-slate-900 rounded text-slate-700 shrink-0 cursor-pointer"
                      >
                        Вход →
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Group 2: Производственный отдел ЦА */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <Wrench className="w-3.5 h-3.5 text-indigo-600" />
                <span>2. Производственный отдел ЦА (ПДО холдинга — вся сеть ВРД):</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {productionHQEntries.map(([loginKey, acc]) => {
                  const isSelected = username === loginKey && password === acc.password;
                  return (
                    <div
                      key={loginKey}
                      onClick={() => fillLoginCredentials(loginKey, acc.password)}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-indigo-50/80 border-indigo-600 ring-1 ring-indigo-600/30'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {acc.position} · {acc.displayName}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          логин: <strong className="text-indigo-700">{loginKey}</strong> · пароль:{' '}
                          <strong>{acc.password}</strong>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          fillLoginCredentials(loginKey, acc.password);
                          performLogin(loginKey, acc.password);
                        }}
                        className="px-2 py-1 text-[11px] font-semibold bg-white border border-slate-300 hover:border-indigo-700 hover:text-indigo-800 rounded text-slate-700 shrink-0 cursor-pointer"
                      >
                        Вход →
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Group 3: Руководители филиалов ВРД */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>3. Филиалы (изолированный контур своего вагоноремонтного депо):</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {branchEntries.map(([loginKey, acc]) => {
                  const isSelected = username === loginKey && password === acc.password;
                  return (
                    <div
                      key={loginKey}
                      onClick={() => fillLoginCredentials(loginKey, acc.password)}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-emerald-50/80 border-emerald-600 ring-1 ring-emerald-600/30'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900">
                            {acc.branchCode}
                          </span>
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {acc.position}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                          логин: <strong className="text-emerald-700">{loginKey}</strong> · пароль:{' '}
                          <strong>{acc.password}</strong>
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
                      >
                        Вход →
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Group 4: Смежные подразделения платформы (Roadmap RBAC) */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <Layers className="w-3.5 h-3.5 text-purple-600" />
                <span>4. Смежные подразделения холдинга (масштабирование платформы):</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {otherDeptEntries.map(([loginKey, acc]) => {
                  const isSelected = username === loginKey && password === acc.password;
                  return (
                    <div
                      key={loginKey}
                      onClick={() => fillLoginCredentials(loginKey, acc.password)}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all flex flex-col justify-between gap-1.5 ${
                        isSelected
                          ? 'bg-purple-50/80 border-purple-600 ring-1 ring-purple-600/30'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {acc.position}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate">
                          {acc.departmentName}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-1">
                          логин: <strong className="text-purple-700">{loginKey}</strong>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          fillLoginCredentials(loginKey, acc.password);
                          performLogin(loginKey, acc.password);
                        }}
                        className="w-full py-1 text-[11px] font-semibold bg-white border border-slate-300 hover:border-purple-700 hover:text-purple-800 rounded text-slate-700 cursor-pointer text-center"
                      >
                        Войти
                      </button>
                    </div>
                  );
                })}
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
