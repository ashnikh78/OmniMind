declare module 'react-toastify' {
  import { ReactNode } from 'react';

  export interface ToastOptions {
    position?: 'top-right' | 'top-center' | 'top-left' | 'bottom-right' | 'bottom-center' | 'bottom-left';
    autoClose?: number | false;
    hideProgressBar?: boolean;
    closeOnClick?: boolean;
    pauseOnHover?: boolean;
    draggable?: boolean;
    progress?: number;
    onOpen?: () => void;
    onClose?: () => void;
    onClick?: () => void;
    className?: string;
    bodyClassName?: string;
    progressClassName?: string;
    closeButton?: ReactNode;
    closeButtonClassName?: string;
    transition?: any;
    type?: 'info' | 'success' | 'warning' | 'error' | 'default';
    theme?: 'light' | 'dark' | 'colored';
    rtl?: boolean;
    pauseOnFocusLoss?: boolean;
    newestOnTop?: boolean;
    limit?: number;
    enableMultiContainer?: boolean;
    containerId?: string;
    role?: string;
    delay?: number;
    isLoading?: boolean;
    updateId?: string;
    render?: (props: any) => ReactNode;
  }

  export interface Toast {
    (content: ReactNode, options?: ToastOptions): string;
    success: (content: ReactNode, options?: ToastOptions) => string;
    info: (content: ReactNode, options?: ToastOptions) => string;
    warning: (content: ReactNode, options?: ToastOptions) => string;
    error: (content: ReactNode, options?: ToastOptions) => string;
    dismiss: (toastId?: string) => void;
    isActive: (toastId: string) => boolean;
    update: (toastId: string, options?: ToastOptions) => void;
    done: (toastId: string) => void;
    onChange: (callback: (toast: any) => void) => void;
    configure: (config: ToastOptions) => void;
  }

  export const toast: Toast;

  export interface ToastContainerProps extends ToastOptions {
    enableMultiContainer?: boolean;
    containerId?: string;
    limit?: number;
    newestOnTop?: boolean;
    closeOnClick?: boolean;
    pauseOnHover?: boolean;
    pauseOnFocusLoss?: boolean;
    draggable?: boolean;
    draggablePercent?: number;
    draggableDirection?: 'x' | 'y';
    role?: string;
    rtl?: boolean;
    theme?: 'light' | 'dark' | 'colored';
    closeButton?: ReactNode;
    position?: 'top-right' | 'top-center' | 'top-left' | 'bottom-right' | 'bottom-center' | 'bottom-left';
    hideProgressBar?: boolean;
    autoClose?: number | false;
    transition?: any;
    style?: React.CSSProperties;
    toastClassName?: string;
    bodyClassName?: string;
    progressClassName?: string;
    closeButtonClassName?: string;
  }

  export const ToastContainer: React.FC<ToastContainerProps>;
} 