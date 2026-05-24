/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import loadingService from '../services/loadingService';

const GlobalLoadingContext = createContext({
  isLoading: false,
  startManualLoading: () => {},
  stopManualLoading: () => {},
  wrapAsync: async (callback) => callback(),
});

export const GlobalLoadingProvider = ({ children }) => {
  const [requestCount, setRequestCount] = useState(0);
  const [manualCount, setManualCount] = useState(0);

  useEffect(() => loadingService.subscribeLoading(setRequestCount), []);

  const startManualLoading = () => setManualCount((prev) => prev + 1);
  const stopManualLoading = () => setManualCount((prev) => Math.max(0, prev - 1));

  const wrapAsync = useCallback(async (callback) => {
    startManualLoading();
    try {
      return await callback();
    } finally {
      stopManualLoading();
    }
  }, []);

  const contextValue = useMemo(() => ({
    isLoading: requestCount + manualCount > 0,
    startManualLoading,
    stopManualLoading,
    wrapAsync,
  }), [requestCount, manualCount, wrapAsync]);

  return (
    <GlobalLoadingContext.Provider value={contextValue}>
      {children}
    </GlobalLoadingContext.Provider>
  );
};

export const useGlobalLoading = () => useContext(GlobalLoadingContext);
