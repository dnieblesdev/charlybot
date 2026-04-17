import { HttpErrorResponse } from '@angular/common/http';
import { signal, computed } from '@angular/core';
import { getErrorMessage } from './api-errors';

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function createApiState<T>() {
  const data = signal<T | null>(null);
  const loading = signal(false);
  const error = signal<string | null>(null);

  const state = computed(() => ({
    data: data(),
    loading: loading(),
    error: error(),
  }));

  const setLoading = () => {
    loading.set(true);
    error.set(null);
  };

  const setError = (err: HttpErrorResponse | Error | string) => {
    loading.set(false);
    if (typeof err === 'string') {
      error.set(err);
    } else if (err instanceof HttpErrorResponse) {
      error.set(getErrorMessage(err));
    } else {
      error.set(err.message || 'Error desconocido');
    }
  };

  const setData = (newData: T) => {
    loading.set(false);
    error.set(null);
    data.set(newData);
  };

  const reset = () => {
    data.set(null);
    loading.set(false);
    error.set(null);
  };

  return {
    data,
    loading,
    error,
    state,
    setLoading,
    setError,
    setData,
    reset,
  };
}
