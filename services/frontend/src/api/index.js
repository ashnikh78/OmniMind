// src/api/index.js
export const authAPI = {
  login: async (credentials) => {
    // Replace with your actual API call, e.g., using fetch or axios
    return fetch('/api/v1/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    }).then(res => res.json());
  },

  getCurrentUser: async (token) => {
    return fetch('/api/v1/users/me', {
      headers: { Authorization: `Bearer ${token}` },
    }).then(res => res.json());
  },
};
