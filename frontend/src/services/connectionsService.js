import apiClient from './apiClient';

const unwrapData = (response) => {
  const payload = response?.data;
  if (payload?.data !== undefined) return payload.data;
  return payload;
};

export const getGmailStatus = async () =>
  unwrapData(await apiClient.get('/integrations/gmail/status'));

export const startGmailConnect = async () => {
  const result = unwrapData(await apiClient.get('/integrations/gmail/auth/start'));
  if (!result?.ok || !result?.authUrl) {
    throw new Error(result?.error || 'Failed to start Gmail OAuth.');
  }
  window.location.assign(result.authUrl);
};

export const disconnectGmail = async () =>
  unwrapData(await apiClient.delete('/integrations/gmail/disconnect'));

export const saveGmailSmtpConfig = async (data) =>
  unwrapData(await apiClient.post('/integrations/gmail/smtp', data));

export const getWhatsappConfig = async () =>
  unwrapData(await apiClient.get('/integrations/whatsapp/config'));

export const saveWhatsappConfig = async (data) =>
  unwrapData(await apiClient.post('/integrations/whatsapp/config', data));

export const disconnectWhatsapp = async () =>
  unwrapData(await apiClient.delete('/integrations/whatsapp/disconnect'));
