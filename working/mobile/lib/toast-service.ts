/**
 * Toast Service - Global toast notification manager
 * Provides a simple API to show toast messages from anywhere in the app
 */

import { ToastType } from '../components/ui/Toast';

type ToastListener = (message: string, type: ToastType) => void;

class ToastService {
  private listeners: ToastListener[] = [];

  subscribe(listener: ToastListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  show(message: string, type: ToastType = 'info') {
    this.listeners.forEach((listener) => listener(message, type));
  }

  success(message: string) {
    this.show(message, 'success');
  }

  error(message: string) {
    this.show(message, 'error');
  }

  warning(message: string) {
    this.show(message, 'warning');
  }

  info(message: string) {
    this.show(message, 'info');
  }
}

export const toastService = new ToastService();
