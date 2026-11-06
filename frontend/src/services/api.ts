import axios from 'axios';

const baseURL =
  (import.meta.env.VITE_API_URL as string | undefined) ??
  'http://localhost:3000/api';

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('scholara_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
