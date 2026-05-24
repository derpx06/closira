import axios from 'axios';
import apiClient from './apiClient';
import loadingService from './loadingService';

function pickErrorMessage(error) {
  const data = error.response?.data;
  if (data && typeof data.message === 'string') return data.message;
  if (Array.isArray(data?.errors) && data.errors[0]?.message) return data.errors[0].message;
  return error.message || 'Request failed';
}

function wrapAxiosError(err) {
  const wrapped = new Error(pickErrorMessage(err));
  if (err.response) wrapped.response = err.response;
  if (err.code) wrapped.code = err.code;
  return wrapped;
}

const authService = {
  login: async (email, password) => {
    try {
      const { data } = await apiClient.post('/auth/login', { email, password });
      return {
        user: data.user,
        token: data.token,
        refreshToken: data.refreshToken,
      };
    } catch (err) {
      throw wrapAxiosError(err);
    }
  },

  signup: async (userData) => {
    try {
      const { data } = await apiClient.post('/auth/register', {
        fullName: userData.name,
        email: userData.email,
        password: userData.password,
        countryCode: userData.country,
        companyName: userData.companyName || undefined,
        companyAbout: userData.companyAbout || undefined,
        companyWebsite: userData.companyWebsite || undefined,
        companyIndustry: userData.companyIndustry || undefined,
        companyPhone: userData.companyPhone || undefined,
      });

      return {
        user: data.user,
        token: data.token,
        refreshToken: data.refreshToken,
      };
    } catch (err) {
      throw wrapAxiosError(err);
    }
  },

  getCountries: async () => {
    const response = await axios.get('https://restcountries.com/v3.1/all?fields=name,currencies,cca2');
    return response.data
      .filter((country) => country.cca2)
      .sort((a, b) => a.name.common.localeCompare(b.name.common));
  },
};

export default authService;
