import * as esbuild from 'esbuild';
const watch = process.argv.includes('--watch');
const common = { bundle: true, format: 'esm', minify: !watch, target: ['es2020', 'safari15'], legalComments: 'none', logLevel: 'info' };
const ctx = await esbuild.context({
	...common,
	entryPoints: ['src/main.js'],
	sourcemap: watch ? 'inline' : false,
	outfile: 'dist/island.js',
});
// the Earth atlas's facts (src/earth/data), a file of their own beside the engine, fetched only
// when first asked for (src/earth/atlas.js loadAtlas)
const atlas = await esbuild.context({ ...common, entryPoints: ['src/earth/data/index.js'], outfile: 'dist/earth-atlas.js' });
// the driving physics (Rapier), loaded only when someone drives (src/vehicles/physics.js)
{
	const fs = await import('node:fs');
	const src = 'node_modules/@dimforge/rapier3d-compat/dist/rapier.mjs';
	if (fs.existsSync(src) && (!fs.existsSync('dist/rapier.mjs') || fs.statSync(src).mtimeMs > fs.statSync('dist/rapier.mjs').mtimeMs)) fs.copyFileSync(src, 'dist/rapier.mjs');
}
if (watch) { await ctx.watch(); await atlas.watch(); } else { await ctx.rebuild(); await atlas.rebuild(); await ctx.dispose(); await atlas.dispose(); }
// the site loads the engine by a URL that changes with it (index.html), so a browser never keeps
// running an old copy after a release
if (!watch) {
	const fs = await import('node:fs'), { createHash } = await import('node:crypto');
	const v = createHash('sha1').update(fs.readFileSync('dist/island.js')).digest('hex').slice(0, 10);
	const page = '../index.html', html = fs.readFileSync(page, 'utf8');
	const next = html.replace(/import\('\.\/island\/dist\/island\.js(\?v=[0-9a-f]+)?'\)/, `import('./island/dist/island.js?v=${v}')`);
	if (next !== html) fs.writeFileSync(page, next);
}
