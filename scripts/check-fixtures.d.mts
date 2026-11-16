/** Type declarations for scripts/check-fixtures.mjs (imported by tests) */
export declare const ALLOWED_HOST: string;

export declare function checkFixtureText(name: string, text: string): string[];

export declare function checkFixtures(options: { dir: string }): {
  errors: string[];
  checked: number;
};

export declare const JSON_FIXTURE_DIRS: string[];

export declare function checkJsonFixtureText(name: string, text: string): string[];

export declare function checkJsonFixtures(options: { dirs: string[] }): {
  errors: string[];
  checked: number;
};
