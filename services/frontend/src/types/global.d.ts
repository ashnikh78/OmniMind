declare module 'marked' {
  export function marked(text: string, options?: any): string;
  export function setOptions(options: any): void;
}

declare module 'highlight.js' {
  export function highlight(code: string, options: { language: string }): { value: string };
  export function highlightAuto(code: string): { value: string };
  export function getLanguage(lang: string): boolean;
}

declare module 'react-dropzone' {
  import { ComponentProps } from 'react';

  export interface FileRejection {
    file: File;
    errors: Array<{
      code: string;
      message: string;
    }>;
  }

  export interface DropzoneOptions {
    accept?: Record<string, string[]>;
    disabled?: boolean;
    maxFiles?: number;
    maxSize?: number;
    minSize?: number;
    multiple?: boolean;
    onDrop?: (acceptedFiles: File[], fileRejections: FileRejection[]) => void;
    onDropAccepted?: (files: File[]) => void;
    onDropRejected?: (fileRejections: FileRejection[]) => void;
    onDragEnter?: (event: DragEvent) => void;
    onDragLeave?: (event: DragEvent) => void;
    onDragOver?: (event: DragEvent) => void;
    onFileDialogCancel?: () => void;
    onFileDialogOpen?: () => void;
    useFsAccessApi?: boolean;
    autoFocus?: boolean;
    preventDropOnDocument?: boolean;
    noClick?: boolean;
    noKeyboard?: boolean;
    noDrag?: boolean;
    noDragEventsBubbling?: boolean;
  }

  export interface DropzoneState {
    isFocused: boolean;
    isFileDialogActive: boolean;
    isDragActive: boolean;
    isDragAccept: boolean;
    isDragReject: boolean;
    draggedFiles: File[];
    acceptedFiles: File[];
    fileRejections: FileRejection[];
  }

  export function useDropzone(options?: DropzoneOptions): {
    getRootProps: (props?: any) => any;
    getInputProps: (props?: any) => any;
    open: () => void;
    isFocused: boolean;
    isFileDialogActive: boolean;
    isDragActive: boolean;
    isDragAccept: boolean;
    isDragReject: boolean;
    draggedFiles: File[];
    acceptedFiles: File[];
    fileRejections: FileRejection[];
  };
}

declare module 'react-toastify' {
  import { ComponentType } from 'react';

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
  }

  export const toast: {
    success: (message: string, options?: ToastOptions) => void;
    error: (message: string, options?: ToastOptions) => void;
    info: (message: string, options?: ToastOptions) => void;
    warning: (message: string, options?: ToastOptions) => void;
    dismiss: () => void;
  };

  export const ToastContainer: ComponentType<ToastOptions>;
} 