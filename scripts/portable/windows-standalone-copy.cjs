'use strict';
// UNEXECUTED source prototype. No registration, runtime or artifact admission.
const fs = require('node:fs');
const path = require('node:path');
const installed = Symbol.for('nalanda.windowsStandaloneDirectoryCopy');

function refuse(code) { throw Object.assign(new Error(code), { code }); }
function inside(root, value) {
  const relative = path.relative(root, value);
  return relative !== '' && !relative.startsWith('..' + path.sep) &&
    relative !== '..' && !path.isAbsolute(relative);
}
function canonicalDirectories(root, directory, allowMissing = false) {
  if (directory !== root && !inside(root, directory)) refuse('COPY_PARENT_ESCAPE');
  const parts = path.relative(root, directory).split(path.sep).filter(Boolean);
  if (parts.length > 64) refuse('COPY_PATH_DEPTH_REFUSED');
  let current = root;
  for (const part of [null, ...parts]) {
    if (part !== null) current = path.join(current, part);
    let stat;
    try { stat = fs.lstatSync(current); }
    catch (error) {
      if (allowMissing && error.code === 'ENOENT') return;
      throw error;
    }
    if (!stat.isDirectory() || stat.isSymbolicLink() ||
        fs.realpathSync.native(current) !== current) refuse('COPY_NONCANONICAL_PARENT');
  }
}
function absent(destination) {
  try { fs.lstatSync(destination); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  // Not EEXIST: Next catches EEXIST; a pre-existing alias must refuse here.
  refuse('COPY_FRESH_ALIAS_REQUIRED');
}
function packageAlias(relative) {
  const segments = relative.split(path.sep);
  if (segments.some(value => !value || value === '.' || value === '..')) return false;
  return /^node_modules\/(?:\.pnpm\/(?:[^/]+\/)?node_modules\/)?(?:@[A-Za-z0-9][A-Za-z0-9._-]*\/)?[A-Za-z0-9][A-Za-z0-9._-]*$/.test(segments.join('/'));
}

function installWindowsStandaloneDirectoryCopy({ root, phase }) {
  if (process.platform !== 'win32' || phase !== 'phase-production-build' ||
      process.env.NALANDA_STANDALONE_BUILD !== 'true') return { active: false };
  if (!path.isAbsolute(root) || path.resolve(root) !== root ||
      fs.realpathSync.native(root) !== root) refuse('COPY_CANONICAL_SOURCE_ROOT_REQUIRED');
  canonicalDirectories(root, root);
  const output = path.join(root, '.next', 'standalone');
  const promises = fs.promises;
  if (promises.symlink[installed]) {
    if (promises.symlink[installed].root !== root) refuse('COPY_HOOK_ROOT_CONFLICT');
    return { active: true, alreadyInstalled: true };
  }
  const original = promises.symlink.bind(promises);
  async function symlink(target, destination, type) {
    // Preserve native behavior outside this one copy seam, including explicit types.
    if (type != null || typeof target !== 'string' || typeof destination !== 'string')
      return original(target, destination, type);
    const dest = path.resolve(destination);
    if (!inside(output, dest)) return original(target, destination, type);
    const relative = path.relative(output, dest);
    if (!packageAlias(relative)) return original(target, destination, type);
    const source = path.join(root, relative);
    canonicalDirectories(root, path.dirname(source));
    const sourceInfo = fs.statSync(source);
    if (!sourceInfo.isDirectory()) return original(target, destination, type);
    const sourceLink = fs.lstatSync(source);
    if (!sourceLink.isSymbolicLink()) refuse('COPY_SOURCE_DIRECTORY_ALIAS_REQUIRED');
    const raw = fs.readlinkSync(source, 'utf8');
    if (raw !== target || path.isAbsolute(raw) || path.win32.isAbsolute(raw))
      refuse('COPY_EXACT_RELATIVE_LINK_REQUIRED');
    const sourceTarget = path.resolve(path.dirname(source), raw);
    if (!inside(path.join(root, 'node_modules', '.pnpm'), sourceTarget))
      refuse('COPY_SOURCE_PNPM_TARGET_ESCAPE');
    canonicalDirectories(root, sourceTarget);
    if (fs.realpathSync.native(source) !== sourceTarget) refuse('COPY_SOURCE_ALIAS_TARGET_MISMATCH');
    const mapped = path.join(output, path.relative(root, sourceTarget));
    const destTarget = path.resolve(path.dirname(dest), raw);
    if (destTarget !== mapped || !inside(output, destTarget)) refuse('COPY_TARGET_MAPPING_MISMATCH');
    canonicalDirectories(root, path.dirname(dest));
    canonicalDirectories(root, destTarget, true);
    absent(dest);
    // Recheck source identity immediately before the native call. No deletion,
    // junction, permission changes, elevation, retry or alternate API fallback.
    const before = fs.lstatSync(source);
    if (before.dev !== sourceLink.dev || before.ino !== sourceLink.ino ||
        fs.readlinkSync(source, 'utf8') !== raw) refuse('COPY_SOURCE_ALIAS_CHANGED');
    try { await original(raw, dest, 'dir'); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      // Next suppresses EEXIST. Preserve its actual native cause and metadata,
      // while making this in-scope conflict an outward build refusal.
      const conflict = new Error('COPY_NATIVE_DESTINATION_CONFLICT', { cause: error });
      Object.assign(conflict, { code: 'COPY_NATIVE_DESTINATION_CONFLICT',
        nativeCode: error.code, nativeSyscall: error.syscall,
        nativePath: error.path, nativeDest: error.dest });
      throw conflict;
    }
    const after = fs.lstatSync(source);
    if (after.dev !== before.dev || after.ino !== before.ino ||
        fs.readlinkSync(source, 'utf8') !== raw) refuse('COPY_SOURCE_ALIAS_CHANGED_AFTER_CREATE');
    canonicalDirectories(root, path.dirname(dest));
    if (!fs.lstatSync(dest).isSymbolicLink() || fs.readlinkSync(dest, 'utf8') !== raw)
      refuse('COPY_CREATED_ALIAS_TEXT_MISMATCH');
    // The mapped directory may not yet exist due to Next's concurrent copy order.
    // Original complete-artifact audits must validate actual target/readability.
  }
  Object.defineProperty(symlink, installed, { value: { root } });
  promises.symlink = symlink;
  return { active: true };
}
module.exports = { installWindowsStandaloneDirectoryCopy };

