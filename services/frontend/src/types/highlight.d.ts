declare module 'highlight.js' {
  interface HighlightOptions {
    language: string;
  }

  interface HighlightResult {
    value: string;
    language: string;
    relevance: number;
    top?: string;
  }

  function highlight(text: string, options: HighlightOptions): HighlightResult;
  function highlightAuto(text: string): HighlightResult;
  function getLanguage(name: string): string | undefined;
  function listLanguages(): string[];
  function registerLanguage(name: string, language: any): void;
  function configure(options: any): void;

  export {
    highlight,
    highlightAuto,
    getLanguage,
    listLanguages,
    registerLanguage,
    configure,
  };

  const hljs: {
    highlight: typeof highlight;
    highlightAuto: typeof highlightAuto;
    getLanguage: typeof getLanguage;
    listLanguages: typeof listLanguages;
    registerLanguage: typeof registerLanguage;
    configure: typeof configure;
  };

  export default hljs;
} 