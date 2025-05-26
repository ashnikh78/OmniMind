declare module 'marked' {
  interface MarkedOptions {
    highlight?: (code: string, lang: string) => string;
    gfm?: boolean;
    breaks?: boolean;
    sanitize?: boolean;
    smartLists?: boolean;
    smartypants?: boolean;
    xhtml?: boolean;
  }

  function marked(text: string, options?: MarkedOptions): string;
  function setOptions(options: MarkedOptions): void;

  export { marked, setOptions };
  export default marked;
} 