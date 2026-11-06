import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CrestMark } from '../components/ivy/CrestMark';
import { HeraldicDivider } from '../components/ivy/HeraldicDivider';
import { TapButton } from '../components/ivy/TapButton';
import { MobileWrapper } from '../components/layout/MobileWrapper';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import type { DemoAccount } from '../types/auth';

export function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<DemoAccount[]>([]);
  const [email, setEmail] = useState('student@scholara.demo');
  const [password, setPassword] = useState('demo123');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate('/app', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    api
      .get<DemoAccount[]>('/auth/demo-accounts')
      .then((res) => setAccounts(res.data))
      .catch(() => undefined);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const loggedIn = await login(email, password);
      toast.success(`Signed in as ${loggedIn.fullName}`);
      navigate('/app');
    } catch {
      toast.error('Login failed. Seed the database and check the API.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <MobileWrapper>
      <div className="relative flex flex-1 flex-col justify-center overflow-hidden">
        <div aria-hidden className="ivy-ambient pointer-events-none absolute inset-0" />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 top-8 opacity-[0.08]"
        >
          <CrestMark size={220} />
        </div>

        <div className="no-scrollbar relative z-10 flex flex-1 flex-col justify-center overflow-y-auto px-5 py-10">
          <div className="mb-6 flex items-center gap-3">
            <CrestMark size={44} />
            <div>
              <p className="font-serif text-2xl font-semibold leading-none text-foreground">
                Scholara
              </p>
              <p className="label-caps mt-1 tracking-[0.25em]">
                Est. Admissions Office
              </p>
            </div>
          </div>

          <p className="font-mono text-[10px] font-semibold tracking-[0.22em] text-gold-ink">
            ADMISSIONS PORTAL · SECURE ACCESS
          </p>
          <p className="mt-3 text-sm font-semibold text-muted-foreground">
            Demo login for Student, Guardian, and Consultant roles.
          </p>
          <HeraldicDivider className="mt-4" />

          <form onSubmit={onSubmit} className="ivy-card mt-6 space-y-4 p-4">
            <label className="grid gap-1.5 text-sm font-semibold text-foreground">
              Email
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                autoComplete="username"
                className="min-h-12 rounded-xl border border-black/[0.06] bg-background px-3 outline-none focus:shadow-[0_0_0_2px_rgba(212,175,55,0.35)]"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold text-foreground">
              Password
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                autoComplete="current-password"
                className="min-h-12 rounded-xl border border-black/[0.06] bg-background px-3 outline-none focus:shadow-[0_0_0_2px_rgba(212,175,55,0.35)]"
              />
            </label>
            <TapButton
              type="submit"
              disabled={loading}
              className="btn-metallic shimmer-sweep flex w-full items-center justify-center rounded-xl"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </TapButton>
          </form>

          {accounts.length > 0 ? (
            <div className="mt-8 pt-2">
              <p className="label-caps">Quick fill · password demo123</p>
              <ul className="ivy-card mt-3 overflow-hidden">
                {accounts.map((account, i) => (
                  <li key={account.email}>
                    <button
                      type="button"
                      className={
                        'flex min-h-12 w-full items-center justify-between px-4 text-left text-sm font-semibold text-foreground transition-colors hover:bg-secondary' +
                        (i > 0 ? ' border-t border-black/[0.06]' : '')
                      }
                      onClick={() => {
                        setEmail(account.email);
                        setPassword('demo123');
                      }}
                    >
                      <span>{account.fullName}</span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-gold-ink">
                        {account.role}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </MobileWrapper>
  );
}
