import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Default site origin, used when VITE_SITE_URL is not set.
 *
 * `https://medcheck.app` was previously hardcoded into index.html's canonical /
 * og:url / twitter:image tags, public/robots.txt's Sitemap line and every <loc> in
 * public/sitemap.xml. That domain is a placeholder nobody here controls, and a
 * canonical tag naming a foreign origin tells search engines to credit that origin
 * instead of yours -- the built artefact was actively harmful to deploy, and no
 * amount of comments in the files prevented it, because nothing failed.
 *
 * The value is now a single build input. It still defaults to the localhost dev
 * origin rather than to the old placeholder: an unset variable should produce
 * something obviously local, not something that looks production-ready.
 */
const DEV_SITE_URL = 'http://localhost:5173';

/** Files copied verbatim from public/ that carry the site origin. */
const TEMPLATED_PUBLIC_FILES = ['robots.txt', 'sitemap.xml'];

const SITE_URL_TOKEN = /%VITE_SITE_URL%/g;

/**
 * Substitutes %VITE_SITE_URL% inside public/ assets.
 *
 * Vite already replaces `%VITE_FOO%` in index.html, but files under public/ are
 * copied byte-for-byte with no transform at all -- so robots.txt and sitemap.xml
 * would keep the literal token. This plugin covers both directions:
 *
 *  - dev: middleware rewrites the response, so `curl localhost:5173/robots.txt`
 *    shows what production will serve.
 *  - build: rewrites the copied files in outDir after Vite has placed them.
 *
 * @param {string} siteUrl Origin without a trailing slash.
 */
function templatePublicFiles(siteUrl) {
  let outDir = 'dist';
  let publicDir = 'public';

  return {
    name: 'medcheck-template-public-files',

    configResolved(config) {
      outDir = config.build.outDir;
      publicDir = config.publicDir;
    },

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = (req.url || '').split('?')[0].replace(/^\//, '');
        if (!TEMPLATED_PUBLIC_FILES.includes(name)) return next();

        const filePath = path.join(publicDir, name);
        if (!fs.existsSync(filePath)) return next();

        const body = fs.readFileSync(filePath, 'utf8').replace(SITE_URL_TOKEN, siteUrl);
        res.setHeader(
          'Content-Type',
          name.endsWith('.xml') ? 'application/xml; charset=utf-8' : 'text/plain; charset=utf-8',
        );
        res.end(body);
      });
    },

    // `closeBundle`, not `generateBundle`: public/ assets are copied by Vite
    // outside the Rollup bundle, so they do not exist as emitted chunks and are
    // only on disk once the build has finished writing.
    closeBundle() {
      for (const name of TEMPLATED_PUBLIC_FILES) {
        const filePath = path.join(outDir, name);
        if (!fs.existsSync(filePath)) continue;
        const original = fs.readFileSync(filePath, 'utf8');
        const replaced = original.replace(SITE_URL_TOKEN, siteUrl);
        if (replaced !== original) fs.writeFileSync(filePath, replaced);
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  // Third argument '' loads every variable, not just the VITE_-prefixed ones, so a
  // deployment can set SITE_URL without the prefix if its platform prefers that.
  const env = loadEnv(mode, process.cwd(), '');
  const rawSiteUrl = env.VITE_SITE_URL || env.SITE_URL || DEV_SITE_URL;
  // Trailing slash stripped once, here, so templates can write `%VITE_SITE_URL%/`
  // and never produce a double slash.
  const siteUrl = rawSiteUrl.replace(/\/+$/, '');

  if (mode === 'production' && !env.VITE_SITE_URL && !env.SITE_URL) {
    // Loud, because a production bundle whose canonical URL points at localhost is
    // as wrong as one pointing at somebody else's domain -- just wrong in a way
    // that is easier to spot.
    console.warn(
      '\n[medcheck] VITE_SITE_URL is not set. canonical/og:url, robots.txt and\n' +
        `[medcheck] sitemap.xml will be built with "${siteUrl}". Set VITE_SITE_URL to\n` +
        '[medcheck] the real public origin before deploying.\n',
    );
  }

  return {
    plugins: [react(), templatePublicFiles(siteUrl)],
    define: {
      // Exposed to app code as import.meta.env.VITE_SITE_URL even when it came
      // from the unprefixed SITE_URL or from the default above, so the value the
      // HTML was built with and the value JS sees can never disagree.
      'import.meta.env.VITE_SITE_URL': JSON.stringify(siteUrl),
    },
    server: {
      port: 5173,
      host: true
    }
  };
});
