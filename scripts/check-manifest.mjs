// Checks the built extension's manifest and published files (cicd-pipeline.md stages 5-6).
// Usage: node scripts/check-manifest.mjs [--out-dir .output/chrome-mv3] [--permissions-doc docs/store/permissions.md] [--package-json package.json]
// When adding a permission, update the allow list below and docs/store/permissions.md together.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Allowed permissions (security-design.md §2) */
export const ALLOWED_PERMISSIONS = ['storage'];

/** matches for content scripts and web-accessible resources (same values as src/shared/salesforce-matches.ts) */
export const SALESFORCE_MATCHES = [
  'https://*.salesforce.com/*',
  'https://*.force.com/*',
  'https://*.salesforce-setup.com/*',
];

/** Names of the page-size bar chunk and the entry in the Vite chunk lists */
export const PAGE_SIZE_BAR_ENTRY_NAME = 'page-size-bar';
export const CONTENT_ENTRY_NAME = 'salesforce.content';
/** Name of the add-assist chunk in the Vite chunk lists (U4 cicd-pipeline.md stage 5) */
export const CHANGESET_ADD_ASSIST_ENTRY_NAME = 'changeset-add-assist';

/** Chunks the entry loads lazily. Every file they load must be listed in web_accessible_resources */
const LAZY_ENTRIES = [
  { name: PAGE_SIZE_BAR_ENTRY_NAME, label: 'page-size bar' },
  { name: CHANGESET_ADD_ASSIST_ENTRY_NAME, label: 'add assistant' },
];

/**
 * U4 files that must not end up in the entry (U4 cicd-pipeline.md stage 6).
 * The only one allowed in the entry is src/changeset-add-assist/load.ts, which loads the widget lazily.
 */
const ADD_ASSIST_SOURCE_PREFIXES = [
  'src/changeset-add-assist/',
  'entrypoints/changeset-add-assist',
];
const ADD_ASSIST_ENTRY_ALLOWED = ['src/changeset-add-assist/load.ts'];

/** Runtime dependencies allowed in package.json (U2 security-design.md §9, NFR3.4) */
export const ALLOWED_DEPENDENCIES = ['react', 'react-dom', '@salesforce-ux/design-system'];

/** package.json fields to check. devDependencies are not bundled, so they are skipped */
const DEPENDENCY_FIELDS = ['dependencies', 'optionalDependencies', 'peerDependencies'];

/**
 * node_modules packages allowed in the build (U2 cicd-pipeline.md stage 5).
 * The chosen dependencies and their dependencies (react, react-dom, scheduler, @salesforce-ux), plus
 * the runtime parts the build tool WXT (team.md "Code Style") puts into the entry (wxt, @wxt-dev/browser).
 */
export const ALLOWED_BUNDLED_PACKAGES = [
  'react',
  'react-dom',
  'scheduler',
  '@salesforce-ux/*',
  'wxt',
  '@wxt-dev/browser',
];

/** Repository folders and files allowed in the build */
const ALLOWED_SOURCE_DIRS = ['src/', 'entrypoints/', 'assets/', 'public/'];
const ALLOWED_ROOT_FILES = ['package.json'];

/** Modules that must not be in the entry (performance-design.md §1) */
const FORBIDDEN_ENTRY_MODULES = ['node_modules/react/', 'node_modules/react-dom/'];

/** Ways of loading from an external URL (NFR3.1) */
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

/** Strips license comments */
function stripLicenseComments(source) {
  return source
    .replace(/\/\*![\s\S]*?\*\//g, '')
    .replace(/\/\*(?:(?!\*\/)[\s\S])*?@(?:license|preserve)(?:(?!\*\/)[\s\S])*\*\//g, '');
}

/** @param {any} manifest @param {string[]} errors */
function checkPermissions(manifest, errors) {
  const permissions = asStringArray(manifest.permissions);
  const extra = permissions.filter((permission) => !ALLOWED_PERMISSIONS.includes(permission));
  if (extra.length > 0) errors.push(`Permissions not allowed: ${extra.join(', ')}`);
  const missing = ALLOWED_PERMISSIONS.filter((permission) => !permissions.includes(permission));
  if (missing.length > 0) errors.push(`Required permissions missing: ${missing.join(', ')}`);
  if ('host_permissions' in manifest) {
    errors.push('Do not declare host_permissions (U1 makes no network requests)');
  }
  if ('optional_host_permissions' in manifest || 'optional_permissions' in manifest) {
    errors.push('Do not declare optional_permissions / optional_host_permissions');
  }
  if ('content_security_policy' in manifest) {
    errors.push('Do not declare content_security_policy (keep the Manifest V3 default; NFR3.2)');
  }
  if ('externally_connectable' in manifest) {
    errors.push('Do not declare externally_connectable (NFR3.5)');
  }
}

/** @param {string} where @param {unknown} matches @param {string[]} errors */
function checkMatchList(where, matches, errors) {
  const list = asStringArray(matches);
  const outside = list.filter((match) => !SALESFORCE_MATCHES.includes(match));
  if (outside.length > 0)
    errors.push(`${where} matches include non-Salesforce hosts: ${outside.join(', ')}`);
  if (list.length === 0) errors.push(`${where} matches are empty`);
}

/** @param {any} manifest @param {string[]} errors */
function checkMatches(manifest, errors) {
  const scripts = Array.isArray(manifest.content_scripts) ? manifest.content_scripts : [];
  if (scripts.length === 0) errors.push('No content_scripts');
  scripts.forEach((script, index) =>
    checkMatchList(`content_scripts[${index}]`, script.matches, errors),
  );
  const resources = Array.isArray(manifest.web_accessible_resources)
    ? manifest.web_accessible_resources
    : [];
  resources.forEach((entry, index) => {
    checkMatchList(`web_accessible_resources[${index}]`, entry.matches, errors);
    if (entry.use_dynamic_url !== true) {
      errors.push(`web_accessible_resources[${index}] lacks use_dynamic_url: true`);
    }
  });
}

/** @param {any} manifest @param {string | null} docText @param {string[]} errors */
function checkPermissionsDoc(manifest, docText, errors) {
  if (docText === null) {
    errors.push('The permissions document (docs/store/permissions.md) is missing');
    return;
  }
  for (const permission of asStringArray(manifest.permissions)) {
    if (!docText.includes(`\`${permission}\``)) {
      errors.push(`docs/store/permissions.md has no entry for permission \`${permission}\``);
    }
  }
}

/** Reads every Vite chunk list in .vite/ and merges them */
function loadViteManifests(outDir) {
  const viteDir = join(outDir, '.vite');
  const files = listFiles(viteDir).filter((path) => /[\\/]manifest(?:-[^\\/]+)?\.json$/.test(path));
  return files.reduce((merged, path) => ({ ...merged, ...readJson(path) }), {});
}

/** Per-chunk module lists in .vite/ (written by moduleListPlugin in wxt.config.ts) */
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

/** Collects a lazily loaded chunk and the files it loads (imports, css, assets) */
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
      errors.push(`The Vite chunk lists have no ${label} chunk (${name})`);
      continue;
    }
    for (const file of collectLoadedFiles(viteManifest, entryKey)) {
      if (!patterns.some((pattern) => matchesResource(pattern, file))) {
        errors.push(`${file} loaded by the ${label} is not listed in web_accessible_resources`);
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
        errors.push(`${relative(outDir, path)} loads from an external URL (${label})`);
      }
    }
  }
}

/** The entry chunk and its imports must not contain React (cicd-pipeline.md stage 6) */
function checkEntryHasNoReact(outDir, viteManifest, errors) {
  const chunks = loadModuleLists(outDir);
  const entry = chunks.find((chunk) => chunk.isEntry && chunk.name === CONTENT_ENTRY_NAME);
  if (!entry) {
    errors.push(`The chunk module lists have no entry (${CONTENT_ENTRY_NAME})`);
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
    errors.push(`React is in the entry: ${[...new Set(found)].slice(0, 5).join(', ')}`);
  }
  const addAssist = modules.filter(
    (id) =>
      ADD_ASSIST_SOURCE_PREFIXES.some((prefix) => id.includes(prefix)) &&
      !ADD_ASSIST_ENTRY_ALLOWED.some((allowed) => id.endsWith(allowed)),
  );
  if (addAssist.length > 0) {
    errors.push(
      `The add-assist widget is in the entry: ${[...new Set(addAssist)].slice(0, 5).join(', ')}`,
    );
  }
}

/** package.json runtime dependencies must not grow beyond the chosen list (NFR3.4) */
function checkDependencies(packageJson, errors) {
  for (const field of DEPENDENCY_FIELDS) {
    const names = Object.keys(packageJson[field] ?? {});
    const extra = names.filter((name) => !ALLOWED_DEPENDENCIES.includes(name));
    if (extra.length > 0) {
      errors.push(
        `package.json ${field} has dependencies outside the chosen list: ${extra.join(', ')}`,
      );
    }
  }
}

/** Extracts the innermost node_modules package name from a module ID */
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
  // IDs starting with \0 are virtual modules created by the bundler (not files)
  if (id.startsWith('\u0000')) return true;
  const name = packageOf(id);
  if (name !== null) return id.startsWith('node_modules/') && isAllowedPackage(name);
  return ALLOWED_ROOT_FILES.includes(id) || ALLOWED_SOURCE_DIRS.some((dir) => id.startsWith(dir));
}

/** Modules in the build must all be on the chosen list (U2 cicd-pipeline.md stage 5) */
function checkBundledModules(outDir, errors) {
  const modules = loadModuleLists(outDir).flatMap((chunk) => asStringArray(chunk.modules));
  const outside = [...new Set(modules.filter((id) => !isAllowedModule(id)))];
  if (outside.length > 0) {
    errors.push(
      `The build contains modules outside the chosen list: ${outside.slice(0, 5).join(', ')}`,
    );
  }
}

/**
 * Checks the build output and returns the problems found.
 * When packageJson is given, also checks the package.json dependencies.
 * @param {{ outDir: string, permissionsDoc: string, packageJson?: string }} options
 * @returns {{ errors: string[] }}
 */
export function checkBuild({ outDir, permissionsDoc, packageJson }) {
  const errors = [];
  const manifestPath = join(outDir, 'manifest.json');
  if (!existsSync(manifestPath)) {
    return { errors: [`${manifestPath} is missing. Run npm run build first`] };
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
    else errors.push(`${packageJson} is missing`);
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
    console.error('Manifest check: failed');
    for (const error of errors) console.error(`  - ${error}`);
    process.exit(1);
  }
  console.log('Manifest check: all passed');
}
