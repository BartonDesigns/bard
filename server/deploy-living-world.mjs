// Deploy the two existing Bard Workers from this checkout. Never creates a
// replacement account, edits credentials, or deploys from the caller's directory.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const deploy = process.argv.includes('--deploy');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
function run(command, args, cwd, capture = false) {
	const result = spawnSync(command, args, { cwd, stdio: capture ? 'pipe' : 'inherit', encoding: 'utf8' });
	if (result.error || result.status !== 0) throw Error(`${command} ${args.join(' ')} failed. ${result.error?.message || result.stderr || ''}`);
	return result.stdout || '';
}
try {
	const remote = run('git', ['remote', 'get-url', 'origin'], root, true).trim();
	if (!/(?:github\.com[/:]|git\.chatgpt-team\.site\/.*)BartonDesigns\/bard(?:\.git)?$/i.test(remote)) throw Error('This must be the BartonDesigns/bard checkout. No deployment attempted.');
	const workers = [['multiplayer', 'l99-rooms'], ['discovery', 'l99-discovery']];
	for (const [folder, expected] of workers) {
		const cwd = resolve(root, 'server', folder), config = readFileSync(resolve(cwd, 'wrangler.toml'), 'utf8');
		if (!config.includes(`name = "${expected}"`)) throw Error(`Unexpected Worker name in ${folder}.`);
		run(npm, ['ci', '--no-audit', '--no-fund'], cwd);
		run(npm, ['test'], cwd);
		run(npm, ['run', 'check'], cwd);
	}
	if (!deploy) { console.log('Checks passed. To publish both existing Bard Workers, run: node server/deploy-living-world.mjs --deploy'); }
	else {
		const account = run(npm, ['exec', '--', 'wrangler', 'whoami'], resolve(root, 'server/multiplayer'), true);
		console.log(account);
		if (/not authenticated/i.test(account)) throw Error('Wrangler is not authenticated. Use your authorized Bard deployment terminal.');
		console.log('Deploying Bard checkout', run('git', ['rev-parse', 'HEAD'], root, true).trim());
		for (const [folder] of workers) run(npm, ['run', 'deploy'], resolve(root, 'server', folder));
		run(process.execPath, [resolve(root, 'server/verify-workers.mjs')], root);
		console.log('Both Bard Workers advertise the release capabilities. Cloudflare runs them after this terminal closes.');
	}
} catch (error) { console.error(error.message); process.exitCode = 1; }
