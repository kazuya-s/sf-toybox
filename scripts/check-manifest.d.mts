/** scripts/check-manifest.mjs の型の宣言（テストから読み込むため） */
export declare const ALLOWED_PERMISSIONS: string[];
export declare const SALESFORCE_MATCHES: string[];
export declare const PAGE_SIZE_BAR_ENTRY_NAME: string;
export declare const CONTENT_ENTRY_NAME: string;

export declare function checkBuild(options: { outDir: string; permissionsDoc: string }): {
  errors: string[];
};
