import * as esbuild from 'esbuild';
const watch = process.argv.includes('--watch');
const ctx = await esbuild.context({
	entryPoints: ['src/main.js'],
	bundle: true,
	format: 'esm',
	minify: !watch,
	sourcemap: watch ? 'inline' : false,
	target: ['es2020', 'safari15'],
	outfile: 'dist/island.js',
	legalComments: 'none',
	logLevel: 'info',
});
if (watch) await ctx.watch();
else { await ctx.rebuild(); await ctx.dispose(); }
