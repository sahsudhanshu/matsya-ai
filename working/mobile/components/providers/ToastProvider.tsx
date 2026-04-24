import React, { useState, useEffect } from 'react';
import { Toast, ToastType } from '../ui/Toast';
import { toastService } from '../../lib/toast-service';

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<ToastType>('info');

  useEffect(() => {
    const unsubscribe = toastService.subscribe((msg, toastType) => {
      setMessage(msg);
      setType(toastType);
      setVisible(true);
    });

    return unsubscribe;
  }, []);

  const handleHide = () => {
    setVisible(false);
  };

  return (
    <>
      {children}
      <Toast visible={visible} message={message} type={type} onHide={handleHide} />
    </>
  );
}
