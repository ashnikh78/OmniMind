declare module 'react-toastify' {
  import { ComponentType, ReactNode } from 'react';

  export type ToastPosition = 'top-right' | 'top-center' | 'top-left' | 'bottom-right' | 'bottom-center' | 'bottom-left';
  export type ToastType = 'info' | 'success' | 'warning' | 'error' | 'default';
  export type ToastTransition = 'bounce' | 'slide' | 'zoom' | 'flip';

  export interface ToastOptions {
    position?: ToastPosition;
    autoClose?: number | false;
    hideProgressBar?: boolean;
    closeOnClick?: boolean;
    pauseOnHover?: boolean;
    draggable?: boolean;
    progress?: number;
    onOpen?: () => void;
    onClose?: () => void;
    type?: ToastType;
    transition?: ToastTransition;
    theme?: 'light' | 'dark' | 'colored';
    style?: React.CSSProperties;
    className?: string;
    bodyClassName?: string;
    progressClassName?: string;
    role?: string;
    rtl?: boolean;
    closeButton?: boolean | ReactNode;
    icon?: ReactNode;
  }

  export interface ToastContainerProps extends ToastOptions {
    newestOnTop?: boolean;
    limit?: number;
    enableMultiContainer?: boolean;
    containerId?: string;
    stacked?: boolean;
  }

  export const toast: {
    success: (message: string | ReactNode, options?: ToastOptions) => void;
    error: (message: string | ReactNode, options?: ToastOptions) => void;
    info: (message: string | ReactNode, options?: ToastOptions) => void;
    warning: (message: string | ReactNode, options?: ToastOptions) => void;
    dismiss: () => void;
  };

  export const ToastContainer: ComponentType<ToastContainerProps>;
} 