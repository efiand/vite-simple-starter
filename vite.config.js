import html from 'vite-plugin-htmlx';
import multipleAssets from 'vite-multiple-assets';
import { createLogger, defineConfig } from 'vite';
import { getData, media } from './src/data';
import { readdirSync } from 'node:fs';

const newFiles = new Set();
const getFullPath = (relativePath) => `${process.cwd()}/${relativePath}`.replaceAll('\\', '/');
const getFiles = (path, formats) => {
	try {
		const files = [];
		const items = readdirSync(path);
		const fullPath = getFullPath(path);
		items.forEach((filename) => {
			const [, file, format] = filename.match(/^(.*)\.(\w+)$/) || [];
			if (file && formats.includes(format)) {
				newFiles.add(`${fullPath}/${filename}`);
				files.push({ file, format, filename });
			}
		});
		return files;
	} catch {
		return [];
	}
};

const isDev = process.env.NODE_ENV === 'development';
const blocks = getFiles('src/styles/blocks', ['scss']);
const fonts = getFiles('public/fonts', ['woff2']);
const icons = getFiles('src/icons', ['svg', 'png', 'gif']);

const pages = getFiles('src/templates/pages', ['ejs']);
if (!pages.length) {
	readdirSync('src').forEach((filename) => {
		if (filename.endsWith('.html')) {
			pages.push({
				file: filename.replace(/\.html$/, ''),
				format: 'html',
				filename,
			});
		}
	});
}
pages.sort((page) => page.file === 'index' ? -1 : 1);

const scss = {
	additionalData: [
		'@import "env";',
		Object.entries(media || {})
			.map(([key, value]) => `@mixin ${key} { @media ${value} { @content; } }`)
			.join(''),
		fonts
			.map(({ file, format, filename }) => {
				const [name, weight] = file.split('-');
				const family = `${name.slice(0, 1).toUpperCase()}${name.slice(1)}`;
				return `
					$font-${name}: '${family}', sans-serif;
					@include font-face('${family}', '${filename}', ${weight}, '${format}');
				`;
			})
			.join(''),
		icons.length ? ':root {' : '',
		icons
			.map(({ file, filename }) => `--icon-${file}: url('../icons/${filename}');`)
			.join(''),
		icons.length ? '}' : '',
		blocks
			.map(({ file }) => `@import 'blocks/${file}';`)
			.join(''),
	].join(''),
};

const plugins = [
	html({
		minify: true,
		page: pages.map(({ file, format, filename }) => {
			const { common = {}, pages = {} } = getData(file) || {};
			return {
				entry: getFullPath('src/scripts/scripts.js'),
				filename: `${file}.html`,
				template: `src/${format === 'html' ? filename : 'index.html'}`,
				inject: {
					data: {
						...common,
						...pages[file] || {},
						media,
						page: file,
					},
					ejsOptions: {
						views: [getFullPath('src/templates')],
					},
				},
			};
		}),
	}),
	{
		handleHotUpdate({ file, server }) {
			if (
				(
					/styles\/blocks\/.*\.scss$/.test(file)
					|| /icons\/.*\.(svg|png|gif)$/.test(file)
					|| /fonts\/.*\.(woff|woff2)$/.test(file)
					|| /templates\/pages\/.*\.ejs$/.test(file)
					|| /src\/.*\.html$/.test(file)
				)
				&& !newFiles.has(file)
			) {
				server.config.logger.info('New autoloading file added.');
				server.restart();
			} else if (file.endsWith('.ejs')) {
				server.ws.send({
					type: 'full-reload',
					path: '*',
				});
			}
		},
		transformIndexHtml: {
			order: 'post',
			handler(html) {
				const newHtml = html.replace('</head>', `${
					fonts
						.map(({ filename }) => {
							return `<link rel="preload" href="fonts/${filename}" as="font" crossorigin="anonymous">`;
						})
						.join('')
				}</head>`);
				return isDev ? newHtml : newHtml.replace(/"(\.\.?\/)+/g, '"');
			},
		},
	},
];
if (isDev) {
	plugins.push(multipleAssets(['src/dev']));
}

const customLogger = createLogger();
const originalWarnOnce = customLogger.warnOnce;
const originalError = customLogger.error;
const createLoggerMethod = (callback) => (msg, options) => {
	if (msg.includes('vite-plugin-htmlx')) {
		return;
	}
	callback(msg, options);
};
customLogger.warnOnce = createLoggerMethod(originalWarnOnce);
customLogger.error = createLoggerMethod(originalError);

// https://vitejs.dev/config/
export default defineConfig({
	base: '',
	plugins,
	build: {
		rollupOptions: {
			output: {
				assetFileNames: 'styles/styles.min.css',
				chunkFileNames: '[name]/[name].min.js',
			},
		},
	},
	css: { preprocessorOptions: { scss } },
	customLogger,
});
