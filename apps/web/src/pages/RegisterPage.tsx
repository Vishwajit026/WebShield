import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { z } from 'zod';

const RegisterSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().email('Please enter a valid email address'),
    password: z
      .string()
      .min(8, 'Must be at least 8 characters')
      .max(128)
      .regex(/[A-Z]/, 'Must include an uppercase letter')
      .regex(/[a-z]/, 'Must include a lowercase letter')
      .regex(/[0-9]/, 'Must include a number'),
    confirmPassword: z.string(),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormErrors = {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
};

function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: '', color: '' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { score, label: 'Weak', color: 'bg-red-500' };
  if (score <= 4) return { score, label: 'Fair', color: 'bg-yellow-500' };
  return { score, label: 'Strong', color: 'bg-green-500' };
}

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const strength = getPasswordStrength(password);

  function validate(): boolean {
    const result = RegisterSchema.safeParse({ name, email, password, confirmPassword });
    if (!result.success) {
      const fieldErrors: FormErrors = {};
      result.error.errors.forEach(e => {
        const field = e.path[0] as keyof FormErrors;
        if (field !== 'general') fieldErrors[field] = e.message;
      });
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    setErrors({});

    try {
      await register(name, email, password);
      toast.success('Account created! Welcome to WebShield.');
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      const message =
        axiosErr.response?.data?.error?.message ??
        'Registration failed. Please try again.';
      setErrors({ general: message });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-shield-600/20 border border-shield-500/30 mb-4">
            <ShieldIcon className="w-8 h-8 text-shield-400" />
          </div>
          <h1 className="text-3xl font-bold text-white">Create your account</h1>
          <p className="text-slate-400 mt-2">Start securing your web applications</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} noValidate aria-label="Registration form">
            {errors.general && (
              <div role="alert" className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-700/50 text-red-300 text-sm">
                {errors.general}
              </div>
            )}

            {/* Name */}
            <div className="mb-4">
              <label htmlFor="register-name" className="block text-sm font-medium text-slate-300 mb-1.5">
                Full name
              </label>
              <input
                id="register-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={e => setName(e.target.value)}
                disabled={isLoading}
                className={`w-full px-3.5 py-2.5 bg-surface-700 border rounded-lg text-white placeholder-slate-500
                  focus:outline-none focus:ring-2 focus:ring-shield-500 focus:border-transparent transition-colors
                  disabled:opacity-50 ${errors.name ? 'border-red-500/70' : 'border-slate-600'}`}
                placeholder="Jane Smith"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'name-error' : undefined}
              />
              {errors.name && <p id="name-error" className="mt-1 text-xs text-red-400">{errors.name}</p>}
            </div>

            {/* Email */}
            <div className="mb-4">
              <label htmlFor="register-email" className="block text-sm font-medium text-slate-300 mb-1.5">
                Email address
              </label>
              <input
                id="register-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={isLoading}
                className={`w-full px-3.5 py-2.5 bg-surface-700 border rounded-lg text-white placeholder-slate-500
                  focus:outline-none focus:ring-2 focus:ring-shield-500 focus:border-transparent transition-colors
                  disabled:opacity-50 ${errors.email ? 'border-red-500/70' : 'border-slate-600'}`}
                placeholder="you@example.com"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'register-email-error' : undefined}
              />
              {errors.email && <p id="register-email-error" className="mt-1 text-xs text-red-400">{errors.email}</p>}
            </div>

            {/* Password */}
            <div className="mb-4">
              <label htmlFor="register-password" className="block text-sm font-medium text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  disabled={isLoading}
                  className={`w-full px-3.5 py-2.5 pr-11 bg-surface-700 border rounded-lg text-white placeholder-slate-500
                    focus:outline-none focus:ring-2 focus:ring-shield-500 focus:border-transparent transition-colors
                    disabled:opacity-50 ${errors.password ? 'border-red-500/70' : 'border-slate-600'}`}
                  placeholder="At least 8 characters"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'register-password-error' : 'password-strength'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-0.5"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOffIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && <p id="register-password-error" className="mt-1 text-xs text-red-400">{errors.password}</p>}

              {/* Password strength indicator */}
              {password && (
                <div id="password-strength" className="mt-2" aria-live="polite">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                          i <= strength.score ? strength.color : 'bg-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-slate-400">
                    Strength: <span className={
                      strength.label === 'Strong' ? 'text-green-400' :
                      strength.label === 'Fair' ? 'text-yellow-400' : 'text-red-400'
                    }>{strength.label}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div className="mb-6">
              <label htmlFor="register-confirm" className="block text-sm font-medium text-slate-300 mb-1.5">
                Confirm password
              </label>
              <input
                id="register-confirm"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                className={`w-full px-3.5 py-2.5 bg-surface-700 border rounded-lg text-white placeholder-slate-500
                  focus:outline-none focus:ring-2 focus:ring-shield-500 focus:border-transparent transition-colors
                  disabled:opacity-50 ${errors.confirmPassword ? 'border-red-500/70' : 'border-slate-600'}`}
                placeholder="Repeat your password"
                aria-invalid={!!errors.confirmPassword}
                aria-describedby={errors.confirmPassword ? 'confirm-error' : undefined}
              />
              {errors.confirmPassword && <p id="confirm-error" className="mt-1 text-xs text-red-400">{errors.confirmPassword}</p>}
            </div>

            <button
              type="submit"
              id="register-submit"
              disabled={isLoading}
              className="btn-primary w-full justify-center"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating account…
                </>
              ) : (
                'Create account'
              )}
            </button>
          </form>

          <p className="text-center mt-6 text-sm text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="text-shield-400 hover:text-shield-300 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-center mt-4 text-xs text-slate-600">
          By creating an account, all validation is enforced on the server.
        </p>
      </div>
    </div>
  );
}

// ── Inline icons ──────────────────────────────────────────────────────────────

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L4 6v6c0 5.25 3.4 10.15 8 11.5C16.6 22.15 20 17.25 20 12V6L12 2z" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" fill="currentColor" fillOpacity="0.15" />
      <path d="M9 12l2.5 2.5L15.5 10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
