let activeCount = 0;
const subscribers = new Set();

const emit = () => {
  subscribers.forEach((listener) => listener(activeCount));
};

const startLoading = () => {
  activeCount += 1;
  emit();
};

const stopLoading = () => {
  activeCount = Math.max(0, activeCount - 1);
  emit();
};

const withGlobalLoading = async (callback) => {
  startLoading();
  try {
    return await callback();
  } finally {
    stopLoading();
  }
};

const subscribeLoading = (listener) => {
  subscribers.add(listener);
  listener(activeCount);

  return () => {
    subscribers.delete(listener);
  };
};

const loadingService = {
  startLoading,
  stopLoading,
  withGlobalLoading,
  subscribeLoading,
};

export default loadingService;
