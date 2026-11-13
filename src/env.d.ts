// Vite の `?inline` の import は、CSS の中身を文字列として返す
declare module '*.css?inline' {
  const css: string;
  export default css;
}

// 画面の入口で読み込む CSS（ビルドで別のファイルに出力される）
declare module '*.css';
