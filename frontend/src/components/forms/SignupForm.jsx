import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AtSign,
  Building2,
  Eye,
  EyeOff,
  Globe2,
  Info,
  LockKeyhole,
  Phone,
  User2,
  Workflow,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import authService from '../../services/authService';

const SignupForm = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    country: '',
    companyName: '',
    companyAbout: '',
    companyWebsite: '',
    companyIndustry: '',
    companyPhone: '',
  });

  const [countries, setCountries] = useState([]);
  const [showPassword, setShowPassword] = useState(false);
  const [fetchingCountries, setFetchingCountries] = useState(true);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let internalCancel = false;

    const loadCountries = async () => {
      try {
        const list = await authService.getCountries();
        if (!internalCancel) {
          setCountries(list);
          setFetchingCountries(false);
        }
      } catch (err) {
        if (!internalCancel) {
          console.error('Failed fetching countries:', err);
          setFetchingCountries(false);
        }
      }
    };

    loadCountries();
    return () => {
      internalCancel = true;
    };
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!formData.name || !formData.email || !formData.password || !formData.country) {
      setError('Please fill in your name, email, password, and organization country.');
      setIsLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await authService.signup(formData);
      login(response.user, {
        accessToken: response.token,
        refreshToken: response.refreshToken,
      });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err.code === 'ERR_NETWORK') {
        setError('Could not reach the server. Is the API running?');
      } else {
        setError(
          err.message
            || err.response?.data?.message
            || 'Signup failed. Please try again.',
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-6 rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4">
        <p className="auth-copy text-sm text-cyan-900">
          Complete the essentials first. Add optional organization details below to tailor your Closira communication workspace.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-medium">Signup failed</p>
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="name">
              Your full name
            </label>
            <div className="relative">
              <User2 size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="name"
                name="name"
                type="text"
                placeholder="Jane Doe"
                value={formData.name}
                onChange={handleChange}
                disabled={isLoading}
                required
                className="auth-input w-full pl-10 disabled:bg-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">
              Business email
            </label>
            <div className="relative">
              <AtSign size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@company.com"
                value={formData.email}
                onChange={handleChange}
                disabled={isLoading}
                required
                className="auth-input w-full pl-10 disabled:bg-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="country">
              Organization country
            </label>
            <div className="relative">
              <Globe2 size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                id="country"
                name="country"
                value={formData.country}
                onChange={handleChange}
                disabled={isLoading || fetchingCountries}
                required
                className={`auth-input w-full appearance-none pl-10 disabled:bg-slate-100 ${
                  !formData.country ? 'text-slate-400' : 'text-slate-900'
                }`}
              >
                <option value="" disabled>Select country </option>
                {countries.map((country) => (
                  <option key={country.cca2} value={country.cca2}>
                    {country.name.common}
                  </option>
                ))}
              </select>
            </div>
            {fetchingCountries && (
              <p className="mt-1 pl-1 text-xs text-slate-400">Loading countries...</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <LockKeyhole size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Minimum 6 characters"
                value={formData.password}
                onChange={handleChange}
                disabled={isLoading}
                required
                className="auth-input w-full pl-10 pr-12 disabled:bg-slate-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-700"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Organization profile (optional)
          </p>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="companyName">
                Legal / display company name
              </label>
              <div className="relative">
                <Building2 size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  id="companyName"
                  name="companyName"
                  type="text"
                  placeholder="Leave blank to default from your name"
                  value={formData.companyName}
                  onChange={handleChange}
                  disabled={isLoading}
                  className="auth-input w-full pl-10"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="companyAbout">
                About the company
              </label>
              <textarea
                id="companyAbout"
                name="companyAbout"
                rows={3}
                placeholder="What does your organization do, and what kind of support do you handle?"
                value={formData.companyAbout}
                onChange={handleChange}
                disabled={isLoading}
                className="auth-input w-full resize-y"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="companyIndustry">
                  Industry
                </label>
                <input
                  id="companyIndustry"
                  name="companyIndustry"
                  type="text"
                  placeholder="e.g. Technology"
                  value={formData.companyIndustry}
                  onChange={handleChange}
                  disabled={isLoading}
                  className="auth-input w-full"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="companyPhone">
                  Phone
                </label>
                <div className="relative">
                  <Phone size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="companyPhone"
                    name="companyPhone"
                    type="tel"
                    placeholder="+1 ..."
                    value={formData.companyPhone}
                    onChange={handleChange}
                    disabled={isLoading}
                    className="auth-input w-full pl-10"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="companyWebsite">
                Website
              </label>
              <input
                id="companyWebsite"
                name="companyWebsite"
                type="url"
                placeholder="https://example.com"
                value={formData.companyWebsite}
                onChange={handleChange}
                disabled={isLoading}
                className="auth-input w-full"
              />
            </div>
          </div>
        </div>

      

        <button
          type="submit"
          disabled={isLoading || fetchingCountries}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(120deg,_#0f172a_0%,_#1d4ed8_100%)] px-4 py-2.5 font-semibold text-white shadow-md shadow-blue-200/70 transition-all hover:translate-y-[-1px] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              <span>Setting up your workspace...</span>
            </>
          ) : (
            <span className="inline-flex items-center gap-2">
              <Workflow size={16} />
              Register organization
            </span>
          )}
        </button>
      </form>
    </div>
  );
};

export default SignupForm;
