import { execSync } from 'child_process';
import path from 'path';

const rootDir = path.resolve(__dirname, '..');

function run(cmd: string, env?: Record<string, string>) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, {
    cwd: rootDir,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
}

async function build() {
  const platform = process.argv[2] || process.platform;
  console.log(`Building MSA HR Electron app for ${platform}...`);

  // 1. Generate Prisma client for SQLite
  console.log('\n=== Step 1: Generate Prisma SQLite client ===');
  run('npx prisma generate --schema=prisma/schema.sqlite.prisma');

  // 2. Build Next.js standalone
  console.log('\n=== Step 2: Build Next.js ===');
  run('npm run build', {
    DB_PROVIDER: 'sqlite',
    NEXT_PUBLIC_DB_PROVIDER: 'sqlite',
  });

  // 2.5. Replace symlinks in standalone build with actual copies
  // and clean up packages that confuse electron-builder
  console.log('\n=== Step 2.5: Fix standalone symlinks ===');
  const standaloneNodeModules = path.join(rootDir, '.next/standalone/.next/node_modules');
  const fs = require('fs');

  function replaceSymlinksRecursive(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = fs.lstatSync(fullPath);
      if (stat.isSymbolicLink()) {
        const target = fs.readlinkSync(fullPath);
        const resolvedTarget = path.resolve(dir, target);
        console.log(`  Replacing symlink: ${entry} -> ${target}`);
        fs.rmSync(fullPath);
        if (fs.existsSync(resolvedTarget)) {
          fs.cpSync(resolvedTarget, fullPath, { recursive: true });
        }
      } else if (stat.isDirectory() && entry.startsWith('@')) {
        // Handle scoped packages (e.g. @prisma/client-xxx)
        replaceSymlinksRecursive(fullPath);
      }
    }
  }

  replaceSymlinksRecursive(standaloneNodeModules);

  if (fs.existsSync(standaloneNodeModules)) {
    // Remove pg (PostgreSQL) - not needed for SQLite/Electron build
    for (const entry of fs.readdirSync(standaloneNodeModules)) {
      if (entry.startsWith('pg-')) {
        const fullPath = path.join(standaloneNodeModules, entry);
        console.log(`  Removing unnecessary package: ${entry}`);
        fs.rmSync(fullPath, { recursive: true });
      }
    }

    // Strip package.json from remaining native modules to prevent
    // electron-builder from treating them as sub-projects
    for (const entry of fs.readdirSync(standaloneNodeModules)) {
      const fullPath = path.join(standaloneNodeModules, entry);
      const pkgJson = path.join(fullPath, 'package.json');
      if (fs.existsSync(pkgJson) && fs.lstatSync(fullPath).isDirectory()) {
        const pkg = JSON.parse(fs.readFileSync(pkgJson, 'utf-8'));
        const minimal = { main: pkg.main || 'index.js' };
        console.log(`  Stripping package.json: ${entry} (main: ${minimal.main})`);
        fs.writeFileSync(pkgJson, JSON.stringify(minimal));
      }
    }
  }

  // 2.6. Generate SQLite init SQL for Electron runtime (no npx available in packaged app)
  console.log('\n=== Step 2.6: Generate SQLite init SQL ===');
  try {
    const initSql = execSync(
      'npx prisma migrate diff --from-empty --to-schema prisma/schema.sqlite.prisma --script',
      { cwd: rootDir, env: { ...process.env, DB_PROVIDER: 'sqlite', DATABASE_URL: 'file:./temp.db' } }
    ).toString();
    const sqlPath = path.join(rootDir, '.next/standalone/prisma-init.sql');
    fs.writeFileSync(sqlPath, initSql);
    console.log(`  Generated prisma-init.sql (${initSql.length} bytes)`);
  } catch (e) {
    console.error('  Warning: Failed to generate init SQL:', e);
  }

  // 2.7. Rename node_modules to _modules to prevent electron-builder from stripping them
  console.log('\n=== Step 2.7: Rename node_modules for packaging ===');
  const standaloneRoot = path.join(rootDir, '.next/standalone');
  const nmPath = path.join(standaloneRoot, 'node_modules');
  const modPath = path.join(standaloneRoot, '_modules');
  if (fs.existsSync(nmPath)) {
    if (fs.existsSync(modPath)) fs.rmSync(modPath, { recursive: true });
    fs.renameSync(nmPath, modPath);
    console.log('  Renamed node_modules -> _modules');
  }

  // 3. Compile Electron TypeScript
  console.log('\n=== Step 3: Compile Electron ===');
  run('npx tsc -p electron/tsconfig.json');

  // 4. Build with electron-builder
  console.log('\n=== Step 4: Package with electron-builder ===');
  const platformFlag =
    platform === 'win32' || platform === 'win'
      ? '--win'
      : platform === 'darwin' || platform === 'mac'
        ? '--mac'
        : '--linux';

  run(`npx electron-builder ${platformFlag} --config electron-builder.yml`);

  // 5. Fix native modules: rebuild better-sqlite3 for each target arch
  // extraResources are copied as-is (not rebuilt by electron-builder),
  // so we must rebuild and replace native modules for each target architecture
  console.log('\n=== Step 5: Fix native modules for each arch ===');
  const releaseDir = path.join(rootDir, 'release');

  function getElectronVersion(): string {
    const epkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'node_modules/electron/package.json'), 'utf-8'));
    return epkg.version;
  }

  function rebuildForArch(arch: string): string {
    const electronVersion = getElectronVersion();
    console.log(`  Rebuilding better-sqlite3 for arch=${arch} electron=${electronVersion}`);
    execSync(
      `npx electron-rebuild -f -m . -o better-sqlite3 --arch=${arch}`,
      { cwd: rootDir, stdio: 'inherit', env: { ...process.env } }
    );
    return path.join(rootDir, 'node_modules/better-sqlite3/build/Release/better_sqlite3.node');
  }

  function replaceNativeModulesInDir(resourcesBase: string, rebuiltModule: string, label: string) {
    // Replace in _modules/better-sqlite3
    const modulesTarget = path.join(resourcesBase, '_modules/better-sqlite3/build/Release/better_sqlite3.node');
    if (fs.existsSync(modulesTarget)) {
      console.log(`  Replacing _modules/better-sqlite3 native module in ${label}`);
      fs.cpSync(rebuiltModule, modulesTarget);
    }
    // Replace in .next/node_modules/better-sqlite3-*
    const nestedNM = path.join(resourcesBase, '.next/node_modules');
    if (fs.existsSync(nestedNM)) {
      const entries = fs.readdirSync(nestedNM).filter((e: string) => e.startsWith('better-sqlite3'));
      for (const entry of entries) {
        const targetNode = path.join(nestedNM, entry, 'build/Release/better_sqlite3.node');
        if (fs.existsSync(targetNode)) {
          console.log(`  Replacing ${entry} native module in ${label}`);
          fs.cpSync(rebuiltModule, targetNode);
        }
      }
    }
  }

  // macOS .app bundles - detect arch from directory name
  const macDirs = fs.readdirSync(releaseDir)
    .filter((d: string) => d.startsWith('mac'))
    .map((d: string) => path.join(releaseDir, d));
  for (const appDir of macDirs) {
    const dirName = path.basename(appDir);
    const arch = dirName.includes('arm64') ? 'arm64' : 'x64';
    const rebuiltModule = rebuildForArch(arch);
    const apps = fs.readdirSync(appDir).filter((f: string) => f.endsWith('.app'));
    for (const app of apps) {
      replaceNativeModulesInDir(
        path.join(appDir, app, 'Contents/Resources/.next/standalone'),
        rebuiltModule,
        `${dirName} (${arch})`
      );
    }
  }

  // Windows unpacked
  const winDirs = fs.readdirSync(releaseDir)
    .filter((d: string) => d.startsWith('win'))
    .map((d: string) => path.join(releaseDir, d));
  for (const winDir of winDirs) {
    // Don't rebuild Windows native modules on macOS - skip
    console.log(`  Skipping Windows native module fix (cross-platform rebuild not supported): ${path.basename(winDir)}`);
  }

  // Linux unpacked
  const linuxDirs = fs.readdirSync(releaseDir)
    .filter((d: string) => d.startsWith('linux'))
    .map((d: string) => path.join(releaseDir, d));
  for (const linuxDir of linuxDirs) {
    console.log(`  Skipping Linux native module fix (cross-platform rebuild not supported): ${path.basename(linuxDir)}`);
  }

  console.log('\nBuild complete! Check the release/ directory.');
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
