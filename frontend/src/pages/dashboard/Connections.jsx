import React, { useEffect, useMemo, useState } from 'react';
import { Mail, Link2, Unplug, ShieldCheck, CircleCheck, CircleAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import {
  disconnectGmail,
  getGmailStatus,
  startGmailConnect,
  saveGmailSmtpConfig,
  getWhatsappConfig,
  saveWhatsappConfig,
  disconnectWhatsapp,
} from '../../services/connectionsService';

const Connections = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [gmailEmail, setGmailEmail] = useState('');
  const [useSmtp, setUseSmtp] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
  
  // SMTP State
  const [smtpForm, setSmtpForm] = useState({ smtpEmail: '', smtpPassword: '' });
  const [isSavingSmtp, setIsSavingSmtp] = useState(false);
  const [isEditingSmtp, setIsEditingSmtp] = useState(false);

  // WhatsApp State
  const [whatsappConfig, setWhatsappConfig] = useState(null);
  const [isSavingWhatsapp, setIsSavingWhatsapp] = useState(false);
  const [isEditingWhatsapp, setIsEditingWhatsapp] = useState(false);
  const [waForm, setWaForm] = useState({ accountSid: '', authToken: '', whatsappNumber: '' });

  useEffect(() => {
    let cancelled = false;
    const loadStatus = async () => {
      try {
        setIsLoadingStatus(true);
        const [gmailStatus, waStatus] = await Promise.all([
          getGmailStatus().catch(() => null),
          getWhatsappConfig().catch(() => null)
        ]);
        
        if (!cancelled) {
          setGmailEmail(gmailStatus?.connected ? String(gmailStatus?.email || '') : '');
          setUseSmtp(gmailStatus?.useSmtp || false);
          if (gmailStatus?.useSmtp) {
             setSmtpForm(prev => ({ ...prev, smtpEmail: gmailStatus.email || '' }));
          }
          if (waStatus?.connected) {
             setWhatsappConfig(waStatus);
             setWaForm({
               accountSid: waStatus.accountSid || '',
               authToken: waStatus.authToken || '',
               whatsappNumber: waStatus.whatsappNumber || ''
             });
          }
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(error?.response?.data?.detail || error?.message || 'Failed to load Gmail status.');
        }
      } finally {
        if (!cancelled) setIsLoadingStatus(false);
      }
    };

    loadStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const status = searchParams.get('gmail');
    const emailFromCallback = searchParams.get('email') || '';
    const errorMessage = searchParams.get('error') || '';

    if (!status && !emailFromCallback && !errorMessage) {
      return;
    }

    if (status === 'success') {
      if (emailFromCallback) setGmailEmail(emailFromCallback);
      toast.success('Gmail connected successfully.');
    }

    if (status === 'error') {
      toast.error(errorMessage || 'Gmail connection failed. Please try again.');
    }

    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const isConnected = Boolean(gmailEmail) || Boolean(whatsappConfig?.connected);

  const statusPill = useMemo(() => {
    if (isConnected) {
      return {
        label: 'Connected',
        className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        icon: <CircleCheck size={14} />,
      };
    }

    return {
      label: 'Not Connected',
      className: 'border-amber-200 bg-amber-50 text-amber-700',
      icon: <CircleAlert size={14} />,
    };
  }, [isConnected]);

  const handleConnect = () => {
    setIsRedirecting(true);
    startGmailConnect().catch((error) => {
      setIsRedirecting(false);
      toast.error(error?.response?.data?.detail || error?.message || 'Could not start Gmail authentication.');
    });
  };

  const handleDisconnect = async () => {
    try {
      await disconnectGmail();
      setGmailEmail('');
      setUseSmtp(false);
      setSmtpForm({ smtpEmail: '', smtpPassword: '' });
      setIsEditingSmtp(false);
      toast.success('Gmail disconnected.');
    } catch (error) {
      toast.error(error?.response?.data?.detail || error?.message || 'Failed to disconnect Gmail.');
    }
  };

  const handleSaveSmtp = async (e) => {
    e.preventDefault();
    try {
      setIsSavingSmtp(true);
      await saveGmailSmtpConfig(smtpForm);
      toast.success('Gmail SMTP connected successfully!');
      
      const updated = await getGmailStatus();
      setGmailEmail(updated.email || '');
      setUseSmtp(updated.useSmtp || false);
      setIsEditingSmtp(false);
    } catch (error) {
      toast.error(error?.response?.data?.detail || error?.message || 'Failed to save SMTP config.');
    } finally {
      setIsSavingSmtp(false);
    }
  };

  const handleSaveWhatsapp = async (e) => {
    e.preventDefault();
    try {
      setIsSavingWhatsapp(true);
      await saveWhatsappConfig(waForm);
      toast.success('WhatsApp connected successfully!');
      
      const updated = await getWhatsappConfig();
      setWhatsappConfig(updated);
      setWaForm({
        accountSid: updated.accountSid || '',
        authToken: updated.authToken || '',
        whatsappNumber: updated.whatsappNumber || ''
      });
      setIsEditingWhatsapp(false);
    } catch (error) {
      toast.error(error?.response?.data?.detail || error?.message || 'Failed to save WhatsApp config.');
    } finally {
      setIsSavingWhatsapp(false);
    }
  };

  const handleDisconnectWhatsapp = async () => {
    try {
      await disconnectWhatsapp();
      setWhatsappConfig(null);
      setWaForm({ accountSid: '', authToken: '', whatsappNumber: '' });
      toast.success('WhatsApp disconnected.');
    } catch (error) {
      toast.error(error?.response?.data?.detail || error?.message || 'Failed to disconnect WhatsApp.');
    }
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="relative overflow-hidden border-b border-slate-200 bg-[linear-gradient(120deg,_rgba(15,23,42,1)_0%,_rgba(30,64,175,1)_62%,_rgba(37,99,235,1)_100%)] px-4 py-5 text-white sm:px-6">
          <div className="relative flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                <Link2 size={22} />
                Connections
              </h1>
              <p className="mt-1 text-sm text-blue-100">
                Connect external channels so Closira agents can receive and send customer messages.
              </p>
            </div>
            <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${statusPill.className}`}>
              {statusPill.icon}
              {isLoadingStatus ? 'Checking...' : statusPill.label}
            </span>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <article className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Mail size={17} /> Gmail
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Authorize one Gmail account for inbound and outbound email handling from the Closira dashboard.
                </p>
                <p className="mt-2 inline-flex items-center gap-2 text-xs text-slate-500">
                  <ShieldCheck size={14} /> OAuth or App Password authentication
                </p>
                {isConnected && !isEditingSmtp ? (
                  <p className="mt-3 text-sm font-medium text-emerald-700">
                    Connected account: {gmailEmail} {useSmtp ? '(via App Password)' : '(via OAuth)'}
                  </p>
                ) : null}
              </div>

              {!isConnected || isEditingSmtp ? (
                <div className="w-full mt-4 lg:mt-0 lg:w-1/2">
                  <form onSubmit={handleSaveSmtp} className="space-y-3 p-4 bg-white border border-slate-200 rounded-xl">
                    <p className="text-sm font-semibold text-slate-800 mb-2">Connect via App Password</p>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Gmail Address</label>
                      <input
                        type="email"
                        required
                        value={smtpForm.smtpEmail}
                        onChange={e => setSmtpForm(p => ({ ...p, smtpEmail: e.target.value }))}
                        className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="you@gmail.com"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">App Password</label>
                      <input
                        type={isEditingSmtp ? "text" : "password"}
                        required={!useSmtp}
                        value={smtpForm.smtpPassword}
                        onChange={e => setSmtpForm(p => ({ ...p, smtpPassword: e.target.value }))}
                        className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="16-character code"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="submit"
                        disabled={isSavingSmtp}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70"
                      >
                        {isSavingSmtp ? 'Saving...' : 'Save App Password'}
                      </button>
                      {isEditingSmtp && (
                        <button
                          type="button"
                          onClick={() => setIsEditingSmtp(false)}
                          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                  
                  <div className="mt-4 flex items-center gap-4">
                    <div className="h-px flex-1 bg-slate-200"></div>
                    <span className="text-xs font-medium text-slate-500 uppercase">OR</span>
                    <div className="h-px flex-1 bg-slate-200"></div>
                  </div>
                  
                  <div className="mt-4 text-center">
                    <button
                      type="button"
                      onClick={handleConnect}
                      disabled={isRedirecting}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <Mail size={16} />
                      {isRedirecting ? 'Redirecting...' : 'Connect via Google OAuth'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-2 mt-4 lg:mt-0">
                  {useSmtp && (
                    <button
                      type="button"
                      onClick={() => setIsEditingSmtp(true)}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Edit Config
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                  >
                    <Unplug size={16} />
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          </article>
          
          <article className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex-1">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21"/><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1"/></svg>
                  WhatsApp (Twilio)
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Configure Twilio credentials to allow agents to receive and send messages on WhatsApp.
                </p>
                
                {whatsappConfig?.connected && !isEditingWhatsapp ? (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium text-emerald-700 flex items-center gap-2">
                      <CircleCheck size={14} /> Connected: {whatsappConfig.whatsappNumber}
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSaveWhatsapp} className="mt-4 space-y-3 max-w-md">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Twilio Account SID</label>
                      <input
                        type="text"
                        required
                        value={waForm.accountSid}
                        onChange={e => setWaForm(p => ({ ...p, accountSid: e.target.value }))}
                        className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="AC..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Twilio Auth Token</label>
                      <input
                        type={isEditingWhatsapp && whatsappConfig?.connected ? "password" : "text"}
                        required
                        value={waForm.authToken}
                        onChange={e => setWaForm(p => ({ ...p, authToken: e.target.value }))}
                        className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder={whatsappConfig?.connected ? "Enter new token to update" : "Enter Auth Token"}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">WhatsApp Number</label>
                      <input
                        type="text"
                        required
                        value={waForm.whatsappNumber}
                        onChange={e => setWaForm(p => ({ ...p, whatsappNumber: e.target.value }))}
                        className="block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="e.g. +1234567890"
                      />
                    </div>
                    <div className="pt-2 flex gap-2">
                      <button
                        type="submit"
                        disabled={isSavingWhatsapp}
                        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-70"
                      >
                        {isSavingWhatsapp ? 'Saving...' : 'Save Credentials'}
                      </button>
                      {isEditingWhatsapp && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingWhatsapp(false);
                            setWaForm({
                               accountSid: whatsappConfig.accountSid || '',
                               authToken: whatsappConfig.authToken || '',
                               whatsappNumber: whatsappConfig.whatsappNumber || ''
                            });
                          }}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {whatsappConfig?.connected && !isEditingWhatsapp && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setWaForm(p => ({ ...p, authToken: '' })); // Clear token for edit
                        setIsEditingWhatsapp(true);
                      }}
                      className="inline-flex justify-center items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Edit Config
                    </button>
                    <button
                      type="button"
                      onClick={handleDisconnectWhatsapp}
                      className="inline-flex justify-center items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                    >
                      <Unplug size={16} />
                      Disconnect
                    </button>
                  </>
                )}
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
};

export default Connections;
