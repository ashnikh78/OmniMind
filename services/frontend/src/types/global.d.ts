declare module 'marked' {
  interface MarkedOptions {
    gfm?: boolean;
    breaks?: boolean;
    sanitize?: boolean;
    smartLists?: boolean;
    smartypants?: boolean;
    xhtml?: boolean;
    highlight?: (code: string, lang: string) => string;
    langPrefix?: string;
    headerPrefix?: string;
    renderer?: unknown;
    pedantic?: boolean;
    mangle?: boolean;
    sanitizer?: (text: string) => string;
    silent?: boolean;
  }

  export function marked(text: string, options?: MarkedOptions): string;
  export function setOptions(options: MarkedOptions): void;
}

declare module 'highlight.js' {
  export function highlight(code: string, options: { language: string }): { value: string };
  export function highlightAuto(code: string): { value: string };
  export function getLanguage(lang: string): boolean;
}

declare module 'react-dropzone' {
  import { ComponentProps, HTMLAttributes, InputHTMLAttributes } from 'react';

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

  export interface DropzoneRootProps extends HTMLAttributes<HTMLDivElement> {
    refKey?: string;
    [key: string]: unknown;
  }

  export interface DropzoneInputProps extends InputHTMLAttributes<HTMLInputElement> {
    refKey?: string;
    [key: string]: unknown;
  }

  export function useDropzone(options?: DropzoneOptions): {
    getRootProps: (props?: DropzoneRootProps) => DropzoneRootProps;
    getInputProps: (props?: DropzoneInputProps) => DropzoneInputProps;
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