// Vite `?inline` imports return the CSS content as a string
declare module '*.css?inline' {
  const css: string;
  export default css;
}

// CSS imported by page entries (emitted as separate files at build time)
declare module '*.css';
