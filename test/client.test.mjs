import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// The shell injects the module system in the browser; this is the minimal
// stand-in that captures the factory definition.
let definition = null;
const memory = new Map();
globalThis.CSS = { supports: (prop, value) => prop === 'corner-shape' && String(value).indexOf('superellipse') === 0 };
globalThis.window = {
	__ModuleLoader__: { load: (value) => { definition = value; } },
	localStorage: {
		getItem: (key) => (memory.has(key) ? memory.get(key) : null),
		setItem: (key, value) => { memory.set(key, String(value)); },
		removeItem: (key) => { memory.delete(key); }
	}
};

await import('../lib/client.js');

const reactStub = {
	useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
	useEffect: () => {},
	useRef: (value) => ({ current: value }),
	createElement: () => null
};
const jsxRuntime = {
	Fragment: 'Fragment',
	jsx: (type, props, key) => ({ type, props: props || {}, key }),
	jsxs: (type, props, key) => ({ type, props: props || {}, key })
};
const storeStub = { defineStore: (def) => ({ __store: true, actions: def.actions, init: def.init }) };

/** A require() that resolves exactly the three module ids the bundle asks for. */
function fakeRequire(id) {
	if (id === 'react/jsx-runtime') return jsxRuntime;
	if (id === 'react') return reactStub;
	if (id === '@deepseek-ai/dsh-client-store') return storeStub;
	throw new Error('unexpected module: ' + id);
}

function load() {
	assert.ok(definition, 'window.__ModuleLoader__.load should have been called');
	return definition.factory(fakeRequire);
}

/** A ctx stub that records everything the plugin touches. */
function createFakeCtx() {
	const calls = { overrides: [], registered: [], disposers: [] };
	return {
		calls,
		theme: {
			overrideTokens: (source, tokens) => {
				calls.overrides.push({ source, tokens });
				return () => { calls.overridesDisposed = (calls.overridesDisposed || 0) + 1; };
			}
		},
		locale: { register: () => () => {}, bind: () => (key) => key },
		effect: (fn, label) => {
			const dispose = fn();
			calls.disposers.push({ label, dispose });
			return () => { if (typeof dispose === 'function') dispose(); };
		},
		slots: {
			inject: (name, factory) => { const result = factory(); return typeof result === 'function' ? result : () => {}; },
			register: (entry, component) => { calls.registered.push({ entry, component }); return () => {}; }
		}
	};
}

/** Flatten a React element tree into its text nodes. */
function collectText(node, out = []) {
	if (node === null || node === undefined || typeof node === 'boolean') return out;
	if (typeof node === 'string' || typeof node === 'number') { out.push(String(node)); return out; }
	if (Array.isArray(node)) { for (const child of node) collectText(child, out); return out; }
	if (typeof node === 'object' && node.props) {
		if (typeof node.type === 'function') { collectText(node.type(node.props), out); return out; }
		collectText(node.props.children, out);
	}
	return out;
}

test('模块以正确的 id 注册，并导出 inject/apply', () => {
	assert.ok(definition, '应调用 window.__ModuleLoader__.load');
	assert.equal(definition.id, 'dsh-corner-studio');
	assert.equal(typeof definition.factory, 'function');
	const plugin = load();
	assert.deepEqual(plugin.inject, ['slots', 'locale', 'theme']);
	assert.equal(typeof plugin.apply, 'function');
});

test('基准 12px 精确复现宿主自带的六档圆角', () => {
	const { radiusTokens, RADIUS_DEFAULTS } = load();
	const tokens = radiusTokens(12);
	assert.equal(tokens['--dsw-radius-xs'], '4px');
	assert.equal(tokens['--dsw-radius-sm'], '8px');
	assert.equal(tokens['--dsw-radius-md'], '12px');
	assert.equal(tokens['--dsw-radius-lg'], '16px');
	assert.equal(tokens['--dsw-radius-xl'], '20px');
	assert.equal(tokens['--dsw-radius-panel'], '28px');
	for (const key of Object.keys(RADIUS_DEFAULTS)) {
		assert.equal(tokens['--dsw-radius-' + key], RADIUS_DEFAULTS[key] + 'px');
	}
});

test('基准 0 时全部圆角归零（全直角）', () => {
	const { radiusTokens } = load();
	const tokens = radiusTokens(0);
	for (const name of Object.keys(tokens)) assert.equal(tokens[name], '0px');
});

test('越界基准被钳制到 0..24', () => {
	const { radiusTokens } = load();
	const max = radiusTokens(999);
	const min = radiusTokens(-50);
	assert.equal(max['--dsw-radius-md'], '24px');
	assert.equal(min['--dsw-radius-md'], '0px');
});

test('总开关关闭时不产生任何覆盖', () => {
	const { computeOverrides } = load();
	assert.deepEqual(computeOverrides({ enabled: false }), {});
});

test('覆盖层包含六个圆角加一个平滑，且明暗同值成对', () => {
	const { computeOverrides } = load();
	const overrides = computeOverrides({
		enabled: true, radius: 12, smooth: 1.5,
		fontUi: { mode: 'system' }, fontCode: { mode: 'system' }
	});
	assert.equal(overrides['--dsw-radius-md'].light, '12px');
	assert.equal(overrides['--dsw-radius-md'].dark, '12px');
	assert.equal(overrides['--dsw-corner-shape'].light, 'superellipse(1.5)');
	assert.deepEqual(
		Object.keys(overrides).filter((name) => name.indexOf('--dsw-radius-') === 0).sort(),
		['--dsw-radius-lg', '--dsw-radius-md', '--dsw-radius-panel', '--dsw-radius-sm', '--dsw-radius-xl', '--dsw-radius-xs']
	);
	assert.equal(Object.keys(overrides).length, 7);
});

test('平滑值被钳制并保留一位小数', () => {
	const { computeOverrides } = load();
	const high = computeOverrides({ enabled: true, radius: 12, smooth: 99, fontUi: { mode: 'system' }, fontCode: { mode: 'system' } });
	assert.equal(high['--dsw-corner-shape'].light, 'superellipse(3)');
	const low = computeOverrides({ enabled: true, radius: 12, smooth: 0.24, fontUi: { mode: 'system' }, fontCode: { mode: 'system' } });
	assert.equal(low['--dsw-corner-shape'].light, 'superellipse(0.5)');
});

test('字体为系统默认时不覆盖宿主变量', () => {
	const { computeOverrides } = load();
	const overrides = computeOverrides({
		enabled: true, radius: 12, smooth: 1.5,
		fontUi: { mode: 'system', value: 'whatever' }, fontCode: { mode: 'system', value: '' }
	});
	assert.equal(overrides['--dsw-font-family'], undefined);
	assert.equal(overrides['--ds-font-family-code'], undefined);
});

test('自定义中文/带空格字体名被正确引用并保留宿主回退栈', () => {
	const { computeOverrides, UI_FALLBACK, CODE_FALLBACK } = load();
	const overrides = computeOverrides({
		enabled: true, radius: 12, smooth: 1.5,
		fontUi: { mode: 'custom', value: '微软雅黑' }, fontCode: { mode: 'preset', value: 'JetBrains Mono' }
	});
	assert.equal(overrides['--dsw-font-family'].light, '"微软雅黑", ' + UI_FALLBACK);
	assert.equal(overrides['--ds-font-family-code'].light, '"JetBrains Mono", ' + CODE_FALLBACK);
});

test('已是完整字体栈的输入按原样接上回退', () => {
	const { buildFontStack, UI_FALLBACK } = load();
	assert.equal(buildFontStack('Inter, Roboto', UI_FALLBACK), 'Inter, Roboto, ' + UI_FALLBACK);
});

test('sanitizeFamily 去掉能破坏 CSS 的字符', () => {
	const { sanitizeFamily, buildFontStack, UI_FALLBACK } = load();
	assert.equal(sanitizeFamily('坏;色 { }<x>'), '坏色  x');
	assert.ok(buildFontStack('Arial;}body{display:none', UI_FALLBACK).indexOf('}') === -1);
});

test('normalizeFontConfig 把垃圾输入回落到 system', () => {
	const { normalizeFontConfig } = load();
	assert.deepEqual(normalizeFontConfig(null), { mode: 'system', value: '', uploadName: '' });
	// 非字符串 value 一律丢弃，避免把任意类型塞进 CSS
	assert.deepEqual(normalizeFontConfig({ mode: 'nonsense', value: 42 }), { mode: 'system', value: '', uploadName: '' });
	assert.deepEqual(normalizeFontConfig({ mode: 'custom', value: 'X', uploadName: 'y' }), { mode: 'custom', value: 'X', uploadName: 'y' });
});

test('resolveFontStack 空值与 system 都返回 null', () => {
	const { resolveFontStack, UI_FALLBACK } = load();
	assert.equal(resolveFontStack({ mode: 'system' }, UI_FALLBACK), null);
	assert.equal(resolveFontStack({ mode: 'custom', value: '   ' }, UI_FALLBACK), null);
	assert.equal(resolveFontStack({ mode: 'upload', value: '' }, UI_FALLBACK), null);
	assert.equal(resolveFontStack({ mode: 'preset', value: '' }, UI_FALLBACK), null);
});

test('apply 注册为独立设置分区，并声明 locale、排序与导航标题', () => {
	const plugin = load();
	const ctx = createFakeCtx();
	plugin.apply(ctx);
	assert.equal(ctx.calls.registered.length, 1);
	const { entry, component } = ctx.calls.registered[0];
	assert.equal(entry.name, 'settings.section');
	assert.equal(entry.order, 110, '应排在「桌面设置」(order 100) 之后');
	assert.equal(typeof entry.label, 'function', '分区导航需要 label');
	assert.equal(entry.id, 'corner-studio');
	assert.equal(entry.locale, 'settings.corner-studio');
	// 该行通过 inject 返回的 getState/subscribe 自管理订阅，不依赖框架 store 钩子
	assert.equal(typeof entry.inject, 'function');
	const injectedProps = entry.inject();
	assert.equal(typeof injectedProps.getState, 'function');
	assert.equal(typeof injectedProps.subscribe, 'function');
	assert.equal(typeof component, 'function');
});

test('apply 通过官方 overrideTokens 提交覆盖层', () => {
	const plugin = load();
	const ctx = createFakeCtx();
	plugin.apply(ctx);
	assert.ok(ctx.calls.overrides.length >= 1, '应至少提交一次覆盖层');
	const last = ctx.calls.overrides[ctx.calls.overrides.length - 1];
	assert.equal(last.source, 'dsh-corner-studio');
	assert.ok(last.tokens['--dsw-radius-md']);
	assert.ok(last.tokens['--dsw-corner-shape']);
});

test('注入动作能改圆角并持久化，且立即重建覆盖层', () => {
	const plugin = load();
	const ctx = createFakeCtx();
	plugin.apply(ctx);
	const { entry } = ctx.calls.registered[0];
	const actions = entry.inject();
	const before = ctx.calls.overrides.length;
	actions.setRadius(20);
	assert.ok(ctx.calls.overrides.length > before, '改圆角应立即重新提交覆盖层');
	const last = ctx.calls.overrides[ctx.calls.overrides.length - 1];
	assert.equal(last.tokens['--dsw-radius-md'].light, '20px');
	assert.equal(memory.get('dsh-corner-studio:radius'), '20');
});

test('关闭总开关后提交空层，恢复宿主原生外观', () => {
	const plugin = load();
	const ctx = createFakeCtx();
	plugin.apply(ctx);
	const { entry } = ctx.calls.registered[0];
	const actions = entry.inject();
	actions.setRadius(20);
	const pushedBefore = ctx.calls.overrides.length;
	const disposedBefore = ctx.calls.overridesDisposed || 0;
	actions.setEnabled(false);
	// 关闭开关的含义是撤销本插件的覆盖层，让宿主原生 token 重新生效，
	// 而不是提交一个"空层"。
	assert.equal(ctx.calls.overrides.length, pushedBefore, '关闭后不应再提交新的覆盖层');
	assert.equal((ctx.calls.overridesDisposed || 0), disposedBefore + 1, '旧覆盖层应被撤销');
	assert.equal(memory.get('dsh-corner-studio:enabled'), 'off');
});

test('恢复默认会把圆角与平滑写回宿主原值', () => {
	const plugin = load();
	const ctx = createFakeCtx();
	plugin.apply(ctx);
	const { entry } = ctx.calls.registered[0];
	const actions = entry.inject();
	actions.setRadius(3);
	actions.setSmooth(2.4);
	actions.resetAll();
	const last = ctx.calls.overrides[ctx.calls.overrides.length - 1];
	assert.equal(last.tokens['--dsw-radius-md'].light, '12px');
	assert.equal(last.tokens['--dsw-corner-shape'].light, 'superellipse(1.5)');
});

test('组件渲染出标题、两条滑杆与两个字体区', () => {
	const plugin = load();
	const ctx = createFakeCtx();
	plugin.apply(ctx);
	const { component, entry } = ctx.calls.registered[0];
	entry.inject();
	const state = { on: true, radius: 12, smooth: 1.5, fontUi: { mode: 'system', value: '', uploadName: '' }, fontCode: { mode: 'system', value: '', uploadName: '' }, uploadName: '', supportsShape: true };
	const props = {
		t: (key) => key,
		getState: () => state,
		subscribe: () => () => {},
		setEnabled: () => {}, setRadius: () => {}, setSmooth: () => {},
		setFontUi: () => {}, setFontCode: () => {}, uploadFont: () => Promise.resolve(),
		removeUpload: () => {}, resetAll: () => {}
	};
	const text = collectText(component(props)).join('|');
	assert.ok(text.indexOf('row.title') !== -1, '应渲染标题');
	assert.ok(text.indexOf('radius.label') !== -1, '应渲染圆角滑杆');
	assert.ok(text.indexOf('shape.label') !== -1, '应渲染平滑滑杆');
	assert.ok(text.indexOf('font.ui') !== -1, '应渲染界面字体区');
	assert.ok(text.indexOf('font.code') !== -1, '应渲染代码字体区');
});

test('内核不支持 corner-shape 时滑杆禁用且给出提示', () => {
	const plugin = load();
	const ctx = createFakeCtx();
	plugin.apply(ctx);
	const { component, entry } = ctx.calls.registered[0];
	entry.inject();
	const state = { on: true, radius: 12, smooth: 1.5, fontUi: { mode: 'system', value: '', uploadName: '' }, fontCode: { mode: 'system', value: '', uploadName: '' }, uploadName: '', supportsShape: false };
	const props = {
		t: (key) => key, getState: () => state, subscribe: () => () => {},
		setEnabled: () => {}, setRadius: () => {}, setSmooth: () => {},
		setFontUi: () => {}, setFontCode: () => {}, uploadFont: () => Promise.resolve(),
		removeUpload: () => {}, resetAll: () => {}
	};
	const text = collectText(component(props)).join('|');
	assert.ok(text.indexOf('shape.unsupported') !== -1, '应显示不支持提示');
});

test('detectShapeSupport 在支持时返回真', () => {
	const plugin = load();
	assert.equal(plugin.detectShapeSupport(), true);
});

test('detectShapeSupport 在能力探测抛错时安全返回假', () => {
	const plugin = load();
	const saved = globalThis.CSS;
	globalThis.CSS = { supports: () => { throw new Error('boom'); } };
	try {
		assert.equal(plugin.detectShapeSupport(), false);
	} finally {
		globalThis.CSS = saved;
	}
});

test('注入动作会通知订阅者，界面因此能跟着更新', () => {
	const plugin = load();
	const ctx = createFakeCtx();
	memory.clear(); // 前面的用例会留下 localStorage 残留
	plugin.apply(ctx);
	const { entry } = ctx.calls.registered[0];
	const injected = entry.inject();
	const seen = [];
	const unsubscribe = injected.subscribe((s) => seen.push(s));

	assert.equal(injected.getState().radius, 12, '初始状态应可读');
	assert.equal(injected.getState().on, true, '默认可读为开启');

	injected.setRadius(18);
	assert.equal(seen.length, 1, '改圆角应通知订阅者一次');
	assert.equal(seen[0].radius, 18, '通知里应带新值');
	assert.equal(injected.getState().radius, 18, 'getState 应反映新值');

	injected.setEnabled(false);
	assert.equal(seen.length, 2, '关开关也应通知');
	assert.equal(seen[1].on, false);

	unsubscribe();
	injected.setRadius(6);
	assert.equal(seen.length, 2, '退订后不再收到通知');
});

test('用 inject 的返回值直接装配组件（模拟框架），渲染与订阅都正常', () => {
	const plugin = load();
	const ctx = createFakeCtx();
	memory.clear();
	plugin.apply(ctx);
	const { entry, component } = ctx.calls.registered[0];
	const injected = entry.inject();

	const before = collectText(component(Object.assign({ t: (key) => key }, injected))).join('|');
	assert.ok(before.indexOf('row.title') !== -1, '应渲染标题');
	assert.ok(before.indexOf('radius.label') !== -1, '应渲染圆角滑杆');

	const seen = [];
	injected.subscribe((s) => seen.push(s));
	injected.setRadius(21);
	assert.equal(seen.length, 1, '拖动后应通知订阅者');
	assert.equal(seen[0].radius, 21);

	const after = collectText(component(Object.assign({ t: (key) => key }, injected))).join('|');
	assert.ok(after.indexOf('shape.label') !== -1, '重渲染后仍应渲染平滑滑杆');
});

test('最外层圆角桥接到宿主自己的变量，并复现其 16px 默认', () => {
	const { frameCss, RADIUS_DEFAULTS } = load();
	const css = frameCss();
	assert.ok(css.indexOf('--dsh-windows-content-radius') !== -1, '应复用宿主已有的最外层圆角变量');
	assert.ok(css.indexOf('var(--dsw-radius-lg)') !== -1, '应跟随圆角档位，而不是写死一个值');
	assert.ok(css.indexOf('data-windows-titlebar') !== -1, '应限定在 Windows 自绘标题栏模式下');
	assert.ok(css.indexOf('html[') !== -1, '应提高优先级以压过宿主同优先级的规则');
	assert.equal(RADIUS_DEFAULTS.lg, 16, 'lg 档默认正好是宿主自带的 16px');
});

test('字体预设按分组组织，且选项足够多', () => {
	const { UI_FONT_GROUPS, CODE_FONT_GROUPS } = load();
	const count = (groups) => groups.reduce((n, g) => n + g.items.length, 0);
	assert.ok(UI_FONT_GROUPS.length >= 4, '界面字体应有多个分组，当前 ' + UI_FONT_GROUPS.length);
	assert.ok(count(UI_FONT_GROUPS) >= 50, '界面字体选项应足够多，当前 ' + count(UI_FONT_GROUPS));
	assert.ok(count(CODE_FONT_GROUPS) >= 20, '代码字体选项应足够多，当前 ' + count(CODE_FONT_GROUPS));
	assert.equal(UI_FONT_GROUPS[0].items[0].family, '', '首项应为「跟随系统」');
	for (const group of UI_FONT_GROUPS) {
		assert.ok(typeof group.group === 'string' && group.group !== '', '每组都要有组名');
		for (const item of group.items) assert.ok(typeof item.label === 'string' && item.label !== '', '每项都要有标签');
	}
});

test('字重默认不覆盖任何 token；提升后只改正文简写，标题与强调保持原样', () => {
	const { computeOverrides, WEIGHT_BASE_TOKENS, DEFAULT_WEIGHT } = load();
	const base = { enabled: true, radius: 12, smooth: 1.5, fontUi: { mode: 'system' }, fontCode: { mode: 'system' } };

	const atDefault = computeOverrides(Object.assign({ weight: DEFAULT_WEIGHT }, base));
	assert.equal(atDefault['--cs-weight'], undefined, '默认字重不应产生覆盖');
	for (const name of Object.keys(WEIGHT_BASE_TOKENS)) {
		assert.equal(atDefault[name], undefined, name + ' 默认不应被覆盖');
	}

	const bold = computeOverrides(Object.assign({ weight: 600 }, base));
	assert.equal(bold['--cs-weight'].light, '600');
	for (const name of Object.keys(WEIGHT_BASE_TOKENS)) {
		const value = bold[name].light;
		assert.ok(value.indexOf('var(--cs-weight, 400)') === 0, name + ' 应以字重变量开头');
		assert.ok(value.indexOf(WEIGHT_BASE_TOKENS[name]) !== -1, name + ' 应保留宿主原始简写');
	}
	assert.equal(bold['--dsw-font-markdown-h1'], undefined, '标题不应被动到');
	assert.equal(bold['--dsw-font-s-strong-14'], undefined, '强调变体不应被动到');
	assert.equal(bold['--dsw-font-markdown-base-strong'], undefined, 'markdown 强调不应被动到');
});

test('字重经注入动作写入持久化并可读取', () => {
	const plugin = load();
	const ctx = createFakeCtx();
	memory.clear();
	plugin.apply(ctx);
	const { entry } = ctx.calls.registered[0];
	const injected = entry.inject();
	assert.equal(injected.getState().weight, 400, '默认字重应为 400');
	injected.setWeight(600);
	assert.equal(injected.getState().weight, 600);
	assert.equal(memory.get('dsh-corner-studio:weight'), '600');
	const last = ctx.calls.overrides[ctx.calls.overrides.length - 1];
	assert.equal(last.tokens['--cs-weight'].light, '600');
});

test('字体平滑开关进入样式表，关闭时完全不出现', () => {
	const { frameCss } = load();
	const off = frameCss({ smoothFont: false });
	assert.ok(off.indexOf('font-smoothing') === -1, '关闭时不应出现平滑属性');
	assert.ok(off.indexOf('font-weight:var(--cs-weight') !== -1, 'body 字重规则应始终存在');
	assert.ok(off.indexOf('--dsh-windows-content-radius') !== -1, '最外层圆角桥接应始终存在');

	const on = frameCss({ smoothFont: true });
	assert.ok(on.indexOf('-webkit-font-smoothing:antialiased') !== -1, '开启时应带上抗锯齿');
	assert.ok(on.indexOf('-moz-osx-font-smoothing:grayscale') !== -1, '开启时应带上 Firefox 版本');
	assert.ok(on.indexOf('text-rendering:optimizeLegibility') !== -1, '开启时应带上排版优化');
});

test('字体平滑经注入动作持久化并可读取', () => {
	const plugin = load();
	const ctx = createFakeCtx();
	memory.clear();
	plugin.apply(ctx);
	const { entry } = ctx.calls.registered[0];
	const injected = entry.inject();
	assert.equal(injected.getState().smoothFont, false, '默认应关闭');
	injected.setSmoothFont(true);
	assert.equal(injected.getState().smoothFont, true);
	assert.equal(memory.get('dsh-corner-studio:smooth-font'), 'on');
	injected.setSmoothFont(false);
	assert.equal(memory.get('dsh-corner-studio:smooth-font'), 'off');
});

test('字重滑杆的取值区间为 300–700 且步进 100', () => {
	const { WEIGHT_MIN, WEIGHT_MAX, WEIGHT_STEP, DEFAULT_WEIGHT } = load();
	assert.equal(WEIGHT_MIN, 300);
	assert.equal(WEIGHT_MAX, 700);
	assert.equal(WEIGHT_STEP, 100);
	assert.equal(DEFAULT_WEIGHT, 400, '默认值必须落在区间内');
	assert.ok(DEFAULT_WEIGHT >= WEIGHT_MIN && DEFAULT_WEIGHT <= WEIGHT_MAX);
});
