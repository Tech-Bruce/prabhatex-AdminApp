import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AlertModal, AlertType, AlertButton } from '../components/AlertModal';

export interface AlertOptions {
  title: string;
  message?: string;
  type?: AlertType;
  buttons?: AlertButton[];
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface AlertContextType {
  showAlert: (options: AlertOptions) => void;
  showConfirm: (options: ConfirmOptions) => void;
  showSuccess: (title: string, message?: string, onOk?: () => void) => void;
  showError: (title: string, message?: string, onOk?: () => void) => void;
  hideAlert: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

// Global bridge reference for AppAlert static calls
let globalAlertHandler: AlertContextType | null = null;

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modalState, setModalState] = useState<{
    visible: boolean;
    title: string;
    message?: string;
    type?: AlertType;
    buttons?: AlertButton[];
  }>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    buttons: [],
  });

  const hideAlert = useCallback(() => {
    setModalState((prev) => ({ ...prev, visible: false }));
  }, []);

  const showAlert = useCallback(
    ({ title, message, type = 'info', buttons }: AlertOptions) => {
      // Auto-detect type if not explicitly set
      let resolvedType = type;
      const lowerTitle = title.toLowerCase();
      if (lowerTitle.includes('error') || lowerTitle.includes('failed')) {
        resolvedType = 'error';
      } else if (lowerTitle.includes('success')) {
        resolvedType = 'success';
      }

      setModalState({
        visible: true,
        title,
        message,
        type: resolvedType,
        buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK', style: 'default' }],
      });
    },
    []
  );

  const showConfirm = useCallback(
    ({
      title,
      message,
      confirmText = 'Confirm',
      cancelText = 'Cancel',
      isDestructive = false,
      onConfirm,
      onCancel,
    }: ConfirmOptions) => {
      setModalState({
        visible: true,
        title,
        message,
        type: isDestructive ? 'confirm' : 'warning',
        buttons: [
          {
            text: cancelText,
            style: 'cancel',
            onPress: onCancel,
          },
          {
            text: confirmText,
            style: isDestructive ? 'destructive' : 'default',
            onPress: onConfirm,
          },
        ],
      });
    },
    []
  );

  const showSuccess = useCallback((title: string, message?: string, onOk?: () => void) => {
    showAlert({
      title,
      message,
      type: 'success',
      buttons: [{ text: 'OK', style: 'default', onPress: onOk }],
    });
  }, [showAlert]);

  const showError = useCallback((title: string, message?: string, onOk?: () => void) => {
    showAlert({
      title,
      message,
      type: 'error',
      buttons: [{ text: 'OK', style: 'default', onPress: onOk }],
    });
  }, [showAlert]);

  const contextValue: AlertContextType = {
    showAlert,
    showConfirm,
    showSuccess,
    showError,
    hideAlert,
  };

  globalAlertHandler = contextValue;

  return (
    <AlertContext.Provider value={contextValue}>
      {children}
      <AlertModal
        visible={modalState.visible}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
        buttons={modalState.buttons}
        onDismiss={hideAlert}
      />
    </AlertContext.Provider>
  );
};

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};

/**
 * Static imperative replacement for React Native's native Alert.alert(...)
 * Works everywhere in the app with the same syntax.
 */
export const AppAlert = {
  alert: (
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: { type?: AlertType }
  ) => {
    if (globalAlertHandler) {
      let resolvedType: AlertType = options?.type || 'info';
      const lowerTitle = (title || '').toLowerCase();
      const hasDestructive = buttons?.some((b) => b.style === 'destructive');

      if (hasDestructive) {
        resolvedType = 'confirm';
      } else if (lowerTitle.includes('error') || lowerTitle.includes('failed') || lowerTitle.includes('validation')) {
        resolvedType = 'error';
      } else if (lowerTitle.includes('success')) {
        resolvedType = 'success';
      } else if (buttons && buttons.length > 1) {
        resolvedType = 'warning';
      }

      globalAlertHandler.showAlert({
        title,
        message,
        type: resolvedType,
        buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK', style: 'default' }],
      });
    } else {
      console.warn('AppAlert called before AlertProvider was mounted:', title, message);
    }
  },

  confirm: (options: ConfirmOptions) => {
    if (globalAlertHandler) {
      globalAlertHandler.showConfirm(options);
    }
  },

  success: (title: string, message?: string, onOk?: () => void) => {
    if (globalAlertHandler) {
      globalAlertHandler.showSuccess(title, message, onOk);
    }
  },

  error: (title: string, message?: string, onOk?: () => void) => {
    if (globalAlertHandler) {
      globalAlertHandler.showError(title, message, onOk);
    }
  },
};
