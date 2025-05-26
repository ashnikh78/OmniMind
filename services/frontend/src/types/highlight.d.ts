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

  interface LanguageDefinition {
    name: string;
    aliases?: string[];
    keywords?: Record<string, unknown>;
    contains?: unknown[];
    case_insensitive?: boolean;
    subLanguage?: string[];
    className?: string;
    begin?: string | RegExp;
    end?: string | RegExp;
    contains?: unknown[];
    starts?: unknown;
    lexemes?: string | RegExp;
    subLanguage?: string[];
    relevance?: number;
  }

  interface HighlightConfig {
    tabReplace?: string;
    useBR?: boolean;
    classPrefix?: string;
    languages?: string[];
    ignoreUnescapedHTML?: boolean;
  }

  function highlight(text: string, options: HighlightOptions): HighlightResult;
  function highlightAuto(text: string): HighlightResult;
  function getLanguage(name: string): string | undefined;
  function listLanguages(): string[];
  function registerLanguage(name: string, language: LanguageDefinition): void;
  function configure(options: HighlightConfig): void;

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