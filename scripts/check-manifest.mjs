// ビルドした拡張機能の manifest と公開するファイルを確かめる（cicd-pipeline.md 段階 5・6）。
// 使い方: node scripts/check-manifest.mjs [--out-dir .output/chrome-mv3] [--permissions-doc docs/store/permissions.md] [--package-json package.json]
// U2 以降で権限を足すときは、下の許可の一覧と docs/store/permissions.md を同時に直す。
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** 許可する権限（security-design.md §2） */
export const ALLOWED_PERMISSIONS = ['storage'];

/** 組み込み先と公開先の matches（src/shared/salesforce-matches.ts と同じ値） */
export const SALESFORCE_MATCHES = [
  'https://*.salesforce.com/*',
  'https://*.force.com/*',
  'https://*.salesforce-setup.com/*',
];

/** Vite の部品の一覧での、件数バーの部品と入口の名前 */
export const PAGE_SIZE_BAR_ENTRY_NAME = 'page-size-bar';
export const CONTENT_ENTRY_NAME = 'salesforce.content';
/** Vite の部品の一覧での、追加支援の部品の名前（U4 cicd-pipeline.md 段階 5） */
export const CHANGESET_ADD_ASSIST_ENTRY_NAME = 'changeset-add-assist';

/** 入口から後から読み込む部品。読み込むファイルがすべて web_accessible_resources に載っていること */
const LAZY_ENTRIES = [
  { name: PAGE_SIZE_BAR_ENTRY_NAME, label: '件数バー' },
  { name: CHANGESET_ADD_ASSIST_ENTRY_NAME, label: '追加支援' },
];

/**
 * 入口に入ってはいけない U4 のファイル（U4 cicd-pipeline.md 段階 6）。
 * 入口に入ってよいのは、部品を後から読み込む src/changeset-add-assist/load.ts だけ。
 */
const ADD_ASSIST_SOURCE_PREFIXES = [
  'src/changeset-add-assist/',
  'entrypoints/changeset-add-assist',
];
const ADD_ASSIST_ENTRY_ALLOWED = ['src/changeset-add-assist/load.ts'];

/** package.json の実行時の依存として許す一覧（U2 security-design.md §9、NFR3.4） */
export const ALLOWED_DEPENDENCIES = ['react', 'react-dom', '@salesforce-ux/design-system'];

/** 調べる package.json の欄。devDependencies はビルドに入らないので対象にしない */
const DEPENDENCY_FIELDS = ['dependencies', 'optionalDependencies', 'peerDependencies'];

/**
 * ビルドに入ってよい node_modules のパッケージ（U2 cicd-pipeline.md 段階 5）。
 * 決めた依存とその依存（react・react-dom・scheduler・@salesforce-ux）に加え、
 * ビルドの道具 WXT（team.md「Code Style」）が入口に入れる実行時の部品（wxt、@wxt-dev/browser）。
 */
export const ALLOWED_BUNDLED_PACKAGES = [
  'react',
  'react-dom',
  'scheduler',
  '@salesforce-ux/*',
  'wxt',
  '@wxt-dev/browser',
];

/** ビルドに入ってよい、リポジトリの中のフォルダとファイル */
const ALLOWED_SOURCE_DIRS = ['src/', 'entrypoints/', 'assets/', 'public/'];
const ALLOWED_ROOT_FILES = ['package.json'];

/** 入口に入っていてはいけないモジュール（performance-design.md §1） */
const FORBIDDEN_ENTRY_MODULES = ['node_modules/react/', 'node_modules/react-dom/'];

/** 外部の URL から読み込む書き方（NFR3.1） */
const EXTERNAL_LOAD_PATTERNS = [
  { label: 'import()', pattern: /\bimport\s*\(\s*["'`]https?:\/\//i },
  { label: 'import from', pattern: /\bimport\b[^;]*?\bfrom\s*["'`]https?:\/\//i },
  { label: 'import', pattern: /\bimport\s*["'`]https?:\/\//i },
  { label: 'src / href', pattern: /\b(?:src|href)\s*[=:]\s*["'`]?https?:\/\//i },
  { label: 'url()', pattern: /\burl\(\s*["']?https?:\/\//i },
  { label: '@import', pattern: /@import\s+(?:url\()?\s*["']?https?:\/\//i },
];

const SCANNED_EXTENSIONS = new Set(['.js', '.mjs', '.css', '.html']);

/** @param {string} path */
function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** @param {unknown} value @returns {string[]} */
function asStringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}

/** @param {string} dir @returns {string[]} */
function listFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

/** @param {string} pattern @param {string} file */
function matchesResource(pattern, file) {
  const escaped = pattern.replace(/^\//, '').replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(
    `^${escaped
      .replace(/\*\*/g, '\u0000')
      .replace(/\*/g, '[^/]*')
      .replace(/\u0000/g, '.*')}$`,
  );
  return regex.test(file.replace(/^\//, ''));
}

/** ライセンスの注記のコメントを除く */
function stripLicenseComments(source) {
  return source
    .replace(/\/\*![\s\S]*?\*\//g, '')
    .replace(/\/\*(?:(?!\*\/)[\s\S])*?@(?:license|preserve)(?:(?!\*\/)[\s\S])*\*\//g, '');
}

/** @param {any} manifest @param {string[]} errors */
function checkPermissions(manifest, errors) {
  const permissions = asStringArray(manifest.permissions);
  const extra = permissions.filter((permission) => !ALLOWED_PERMISSIONS.includes(permission));
  if (extra.length > 0) errors.push(`許可していない権限があります: ${extra.join(', ')}`);
  const missing = ALLOWED_PERMISSIONS.filter((permission) => !permissions.includes(permission));
  if (missing.length > 0) errors.push(`必要な権限がありません: ${missing.join(', ')}`);
  if ('host_permissions' in manifest) {
    errors.push('host_permissions は書きません（U1 は通信しない）');
  }
  if ('optional_host_permissions' in manifest || 'optional_permissions' in manifest) {
    errors.push('optional_permissions / optional_host_permissions は書きません');
  }
  if ('content_security_policy' in manifest) {
    errors.push('content_security_policy は書きません（Manifest V3 の既定のまま。NFR3.2）');
  }
  if ('externally_connectable' in manifest) {
    errors.push('externally_connectable は書きません（NFR3.5）');
  }
}

/** @param {string} where @param {unknown} matches @param {string[]} errors */
function checkMatchList(where, matches, errors) {
  const list = asStringArray(matches);
  const outside = list.filter((match) => !SALESFORCE_MATCHES.includes(match));
  if (outside.length > 0)
    errors.push(`${where} の matches に Salesforce 以外があります: ${outside.join(', ')}`);
  if (list.length === 0) errors.push(`${where} の matches が空です`);
}

/** @param {any} manifest @param {string[]} errors */
function checkMatches(manifest, errors) {
  const scripts = Array.isArray(manifest.content_scripts) ? manifest.content_scripts : [];
  if (scripts.length === 0) errors.push('content_scripts がありません');
  scripts.forEach((script, index) =>
    checkMatchList(`content_scripts[${index}]`, script.matches, errors),
  );
  const resources = Array.isArray(manifest.web_accessible_resources)
    ? manifest.web_accessible_resources
    : [];
  resources.forEach((entry, index) => {
    checkMatchList(`web_accessible_resources[${index}]`, entry.matches, errors);
    if (entry.use_dynamic_url !== true) {
      errors.push(`web_accessible_resources[${index}] に use_dynamic_url: true がありません`);
    }
  });
}

/** @param {any} manifest @param {string | null} docText @param {string[]} errors */
function checkPermissionsDoc(manifest, docText, errors) {
  if (docText === null) {
    errors.push('権限の説明の文書（docs/store/permissions.md）がありません');
    return;
  }
  for (const permission of asStringArray(manifest.permissions)) {
    if (!docText.includes(`\`${permission}\``)) {
      errors.push(`docs/store/permissions.md に権限 \`${permission}\` の項目がありません`);
    }
  }
}

/** .vite/ の中の Vite の部品の一覧をすべて読み、1 つにまとめる */
function loadViteManifests(outDir) {
  const viteDir = join(outDir, '.vite');
  const files = listFiles(viteDir).filter((path) => /[\\/]manifest(?:-[^\\/]+)?\.json$/.test(path));
  return files.reduce((merged, path) => ({ ...merged, ...readJson(path) }), {});
}

/** .vite/ の中の部品ごとのモジュールの一覧（wxt.config.ts の moduleListPlugin が書く） */
function loadModuleLists(outDir) {
  const viteDir = join(outDir, '.vite');
  return listFiles(viteDir)
    .filter((path) => /[\\/]modules-[^\\/]+\.json$/.test(path))
    .flatMap((path) => readJson(path));
}

/** @param {Record<string, any>} viteManifest @param {string} name */
function findEntryKey(viteManifest, name) {
  return Object.keys(viteManifest).find(
    (key) => viteManifest[key]?.isEntry === true && viteManifest[key]?.name === name,
  );
}

/** 件数バーの部品と、それが読み込むファイル（imports・css・assets）を集める */
function collectLoadedFiles(viteManifest, entryKey) {
  const files = new Set();
  const visited = new Set();
  const visit = (key) => {
    if (visited.has(key) || !viteManifest[key]) return;
    visited.add(key);
    const chunk = viteManifest[key];
    if (chunk.file) files.add(chunk.file);
    asStringArray(chunk.css).forEach((file) => files.add(file));
    asStringArray(chunk.assets).forEach((file) => files.add(file));
    asStringArray(chunk.imports).forEach(visit);
  };
  visit(entryKey);
  return [...files];
}

/** @param {any} manifest @param {Record<string, any>} viteManifest @param {string[]} errors */
function checkWebAccessibleResources(manifest, viteManifest, errors) {
  const patterns = (
    Array.isArray(manifest.web_accessible_resources) ? manifest.web_accessible_resources : []
  ).flatMap((entry) => asStringArray(entry.resources));
  for (const { name, label } of LAZY_ENTRIES) {
    const entryKey = findEntryKey(viteManifest, name);
    if (!entryKey) {
      errors.push(`Vite の部品の一覧に${label}の部品（${name}）がありません`);
      continue;
    }
    for (const file of collectLoadedFiles(viteManifest, entryKey)) {
      if (!patterns.some((pattern) => matchesResource(pattern, file))) {
        errors.push(`${label}が読み込む ${file} が web_accessible_resources に載っていません`);
      }
    }
  }
}

/** @param {string} outDir @param {string[]} errors */
function checkExternalUrls(outDir, errors) {
  const files = listFiles(outDir).filter((path) => {
    const rel = relative(outDir, path).split('\\').join('/');
    return !rel.startsWith('.vite/') && SCANNED_EXTENSIONS.has(extname(path));
  });
  for (const path of files) {
    const source = stripLicenseComments(readFileSync(path, 'utf8'));
    for (const { label, pattern } of EXTERNAL_LOAD_PATTERNS) {
      if (pattern.test(source)) {
        errors.push(
          `${relative(outDir, path)} に外部の URL から読み込む書き方（${label}）があります`,
        );
      }
    }
  }
}

/** 入口の部品とその imports に React が入っていないこと（cicd-pipeline.md 段階 6） */
function checkEntryHasNoReact(outDir, viteManifest, errors) {
  const chunks = loadModuleLists(outDir);
  const entry = chunks.find((chunk) => chunk.isEntry && chunk.name === CONTENT_ENTRY_NAME);
  if (!entry) {
    errors.push(`部品のモジュールの一覧に入口（${CONTENT_ENTRY_NAME}）がありません`);
    return;
  }
  const byFile = new Map(chunks.map((chunk) => [chunk.file, chunk]));
  const visited = new Set();
  const modules = [];
  const visit = (chunk) => {
    if (!chunk || visited.has(chunk.file)) return;
    visited.add(chunk.file);
    modules.push(...asStringArray(chunk.modules));
    asStringArray(chunk.imports).forEach((file) => visit(byFile.get(file)));
  };
  visit(entry);

  const entryKey = findEntryKey(viteManifest, CONTENT_ENTRY_NAME);
  if (entryKey) modules.push(entryKey, ...asStringArray(viteManifest[entryKey].imports));

  const found = modules.filter((id) => FORBIDDEN_ENTRY_MODULES.some((dir) => id.includes(dir)));
  if (found.length > 0) {
    errors.push(`入口に React が入っています: ${[...new Set(found)].slice(0, 5).join(', ')}`);
  }
  const addAssist = modules.filter(
    (id) =>
      ADD_ASSIST_SOURCE_PREFIXES.some((prefix) => id.includes(prefix)) &&
      !ADD_ASSIST_ENTRY_ALLOWED.some((allowed) => id.endsWith(allowed)),
  );
  if (addAssist.length > 0) {
    errors.push(
      `入口に追加支援の部品が入っています: ${[...new Set(addAssist)].slice(0, 5).join(', ')}`,
    );
  }
}

/** package.json の実行時の依存が、決めた一覧から増えていないこと（NFR3.4） */
function checkDependencies(packageJson, errors) {
  for (const field of DEPENDENCY_FIELDS) {
    const names = Object.keys(packageJson[field] ?? {});
    const extra = names.filter((name) => !ALLOWED_DEPENDENCIES.includes(name));
    if (extra.length > 0) {
      errors.push(`package.json の ${field} に決めた一覧にない依存があります: ${extra.join(', ')}`);
    }
  }
}

/** モジュールの ID から、いちばん内側の node_modules のパッケージ名を取り出す */
function packageOf(id) {
  const marker = 'node_modules/';
  const index = id.lastIndexOf(marker);
  if (index < 0) return null;
  const parts = id.slice(index + marker.length).split('/');
  return parts[0]?.startsWith('@') ? `${parts[0]}/${parts[1] ?? ''}` : (parts[0] ?? null);
}

/** @param {string} name */
function isAllowedPackage(name) {
  return ALLOWED_BUNDLED_PACKAGES.some((allowed) =>
    allowed.endsWith('/*') ? name.startsWith(allowed.slice(0, -1)) : name === allowed,
  );
}

/** @param {string} id */
function isAllowedModule(id) {
  // \0 で始まるのは、バンドラーが作る仮のモジュール（ファイルではない）
  if (id.startsWith('\u0000')) return true;
  const name = packageOf(id);
  if (name !== null) return id.startsWith('node_modules/') && isAllowedPackage(name);
  return ALLOWED_ROOT_FILES.includes(id) || ALLOWED_SOURCE_DIRS.some((dir) => id.startsWith(dir));
}

/** ビルドに入ったモジュールが、決めた一覧の中だけであること（U2 cicd-pipeline.md 段階 5） */
function checkBundledModules(outDir, errors) {
  const modules = loadModuleLists(outDir).flatMap((chunk) => asStringArray(chunk.modules));
  const outside = [...new Set(modules.filter((id) => !isAllowedModule(id)))];
  if (outside.length > 0) {
    errors.push(
      `ビルドに決めた一覧の外のモジュールが入っています: ${outside.slice(0, 5).join(', ')}`,
    );
  }
}

/**
 * ビルドの結果を確かめ、見つかった問題の一覧を返す。
 * packageJson を渡したときは、package.json の依存も確かめる。
 * @param {{ outDir: string, permissionsDoc: string, packageJson?: string }} options
 * @returns {{ errors: string[] }}
 */
export function checkBuild({ outDir, permissionsDoc, packageJson }) {
  const errors = [];
  const manifestPath = join(outDir, 'manifest.json');
  if (!existsSync(manifestPath)) {
    return { errors: [`${manifestPath} がありません。先に npm run build を実行してください`] };
  }
  const manifest = readJson(manifestPath);
  const viteManifest = loadViteManifests(outDir);
  const docText = existsSync(permissionsDoc) ? readFileSync(permissionsDoc, 'utf8') : null;

  checkPermissions(manifest, errors);
  checkMatches(manifest, errors);
  checkPermissionsDoc(manifest, docText, errors);
  checkWebAccessibleResources(manifest, viteManifest, errors);
  checkExternalUrls(outDir, errors);
  checkEntryHasNoReact(outDir, viteManifest, errors);
  checkBundledModules(outDir, errors);
  if (packageJson !== undefined) {
    if (existsSync(packageJson)) checkDependencies(readJson(packageJson), errors);
    else errors.push(`${packageJson} がありません`);
  }
  return { errors };
}

/** @param {string[]} argv */
function parseArgs(argv) {
  const options = {
    outDir: '.output/chrome-mv3',
    permissionsDoc: 'docs/store/permissions.md',
    packageJson: 'package.json',
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--out-dir') options.outDir = argv[++index] ?? options.outDir;
    else if (argv[index] === '--permissions-doc')
      options.permissionsDoc = argv[++index] ?? options.permissionsDoc;
    else if (argv[index] === '--package-json')
      options.packageJson = argv[++index] ?? options.packageJson;
  }
  return {
    outDir: resolve(options.outDir),
    permissionsDoc: resolve(options.permissionsDoc),
    packageJson: resolve(options.packageJson),
  };
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const { errors } = checkBuild(parseArgs(process.argv.slice(2)));
  if (errors.length > 0) {
    console.error('manifest の確認: 失敗');
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log('manifest の確認: すべて通りました');
}
