import React, { createContext, useContext } from 'react';
import { authAPI } from '../api';  // import your real API functions here

// If you want, you can merge or add more APIs here
const api = {
  authAPI,
  // Add more API modules or functions here, e.g.:
  // userAPI,
  // productAPI,
  // or utility fetchData method if needed
};

export const ApiContext = createContext();

export const ApiProvider = ({ children }) => {
  return (
    <ApiContext.Provider value={{ api }}>
      {children}
    </ApiContext.Provider>
  );
};

// Helper hook to easily access ApiContext
export const useApi = () => useContext(ApiContext);
