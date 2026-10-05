// dsh-corner-studio — browser half (client plugin bundle).
//
// Registered through window.__ModuleLoader__.load, the lazy-CJS module table the
// shipped ui-* packages use, so require() resolves against the shell.
//
// Three features, each writing a variable the host already paints with:
//   1. Corner radius — the six --dsw-radius-* tokens (defined on :root in
//      ui-theme, consumed 127x as border-radius). A base of 12px reproduces the
//      host's own 4/8/12/16/20/28 exactly, so the default changes nothing.
//   2. Corner smoothness — --dsw-corner-shape, the superellipse axis the host's
//      corner-shape.css consumes (default 1.5). A CSS.supports probe keeps the
//      control honest on engines without corner-shape.
//   3. Fonts — --dsw-font-family (referenced by every --dsw-font-* type token)
//      and --ds-font-family-code; from presets, a typed name, or an uploaded
//      file registered through the FontFace API.
//
// All of it goes through ctx.theme.overrideTokens(), so layers stack, values
// carry light/dark pairs, and unload disposes exactly this plugin's layer.
// Preferences live in localStorage; uploaded binaries live in IndexedDB.
window.__ModuleLoader__.load({
	id: "dsh-corner-studio",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let jsx = require("react/jsx-runtime");
		let _react = require("react");
		
		//#region constants
		const SETTINGS_NS = "settings.corner-studio";
		const OVERRIDE_SOURCE = "dsh-corner-studio";
		const KEY_ENABLED = "dsh-corner-studio:enabled";
		const KEY_RADIUS = "dsh-corner-studio:radius";
		const KEY_SMOOTH = "dsh-corner-studio:smooth";
		const KEY_WEIGHT = "dsh-corner-studio:weight";
		const KEY_SMOOTH_FONT = "dsh-corner-studio:smooth-font";
		const KEY_FONT_UI = "dsh-corner-studio:font-ui";
		const KEY_FONT_CODE = "dsh-corner-studio:font-code";

		/** The six radius steps the host ships, and the base each maps to at 12px. */
		const RADIUS_KEYS = ["xs", "sm", "md", "lg", "xl", "panel"];
		const RADIUS_DEFAULTS = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, panel: 28 };
		/** Each step as a multiple of the master base; 12px base → the host defaults exactly. */
		const RADIUS_RATIO = { xs: 1 / 3, sm: 2 / 3, md: 1, lg: 4 / 3, xl: 5 / 3, panel: 7 / 3 };

		const BASE_MIN = 0;
		const BASE_MAX = 24;
		const BASE_DEFAULT = 12;
		const SMOOTH_MIN = 0.5;
		const SMOOTH_MAX = 3;
		const SMOOTH_STEP = 0.1;
		const SMOOTH_DEFAULT = 1.5;
		/** The host's own default, so "reset" restores the shipped look. */
		const HOST_CORNER_SHAPE = "superellipse(1.5)";

		/** Verbatim copies of the host's fallback stacks (ui-theme base.css / design-platform.css). */
		const UI_FALLBACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif';
		const CODE_FALLBACK = '"SF Mono", "JetBrains Mono", "Fira Code", Consolas, "Liberation Mono", Menlo, Courier, "PingFang SC", "Microsoft YaHei"';

		const FONT_MODES = ["system", "preset", "custom", "upload"];
		const SLOTS = ["ui", "code"];
		/** Curated families, grouped for the picker. Live availability is resolved by the browser, not asserted here. */
		const UI_FONT_GROUPS = [
			{
				group: "系统 · System",
				items: [{ id: "system", label: "跟随系统 / System default", family: "" }]
			},
			{
				group: "中文黑体 · CJK sans",
				items: [
					{ id: "msyh", label: "微软雅黑 Microsoft YaHei", family: "Microsoft YaHei" },
					{ id: "msyhlight", label: "微软雅黑 Light", family: "Microsoft YaHei Light" },
					{ id: "dengxian", label: "等线 DengXian", family: "DengXian" },
					{ id: "pingfang", label: "苹方 PingFang SC", family: "PingFang SC" },
					{ id: "sourcehansans", label: "思源黑体 Source Han Sans SC", family: "Source Han Sans SC" },
					{ id: "notosanssc", label: "Noto Sans SC", family: "Noto Sans SC" },
					{ id: "harmony", label: "HarmonyOS Sans SC", family: "HarmonyOS Sans SC" },
					{ id: "misans", label: "MiSans", family: "MiSans" },
					{ id: "opposans", label: "OPPO Sans", family: "OPPO Sans" },
					{ id: "alibaba", label: "阿里巴巴普惠体 Alibaba PuHuiTi", family: "Alibaba PuHuiTi" },
					{ id: "smileysans", label: "得意黑 Smiley Sans", family: "Smiley Sans" },
					{ id: "douyin", label: "抖音美好体 Douyin Sans", family: "Douyin Sans" },
					{ id: "wqy", label: "文泉驿微米黑 WenQuanYi Micro Hei", family: "WenQuanYi Micro Hei" },
					{ id: "lxgw", label: "霞鹜文楷 LXGW WenKai", family: "LXGW WenKai" },
					{ id: "sarasa", label: "更纱黑体 Sarasa Gothic SC", family: "Sarasa Gothic SC" }
				]
			},
			{
				group: "中文宋楷 · CJK serif",
				items: [
					{ id: "sourcehanserif", label: "思源宋体 Source Han Serif SC", family: "Source Han Serif SC" },
					{ id: "notoserifsc", label: "Noto Serif SC", family: "Noto Serif SC" },
					{ id: "stxihei", label: "华文细黑 STXihei", family: "STXihei" },
					{ id: "stkaiti", label: "华文楷体 STKaiti", family: "STKaiti" },
					{ id: "kaiti", label: "楷体 KaiTi", family: "KaiTi" },
					{ id: "fangsong", label: "仿宋 FangSong", family: "FangSong" },
					{ id: "simsun", label: "宋体 SimSun", family: "SimSun" },
					{ id: "simhei", label: "黑体 SimHei", family: "SimHei" },
					{ id: "youyuan", label: "幼圆 YouYuan", family: "YouYuan" },
					{ id: "lisu", label: "隶书 LiSu", family: "LiSu" }
				]
			},
			{
				group: "英文无衬线 · Latin sans",
				items: [
					{ id: "inter", label: "Inter", family: "Inter" },
					{ id: "roboto", label: "Roboto", family: "Roboto" },
					{ id: "opensans", label: "Open Sans", family: "Open Sans" },
					{ id: "lato", label: "Lato", family: "Lato" },
					{ id: "montserrat", label: "Montserrat", family: "Montserrat" },
					{ id: "poppins", label: "Poppins", family: "Poppins" },
					{ id: "nunito", label: "Nunito", family: "Nunito" },
					{ id: "raleway", label: "Raleway", family: "Raleway" },
					{ id: "worksans", label: "Work Sans", family: "Work Sans" },
					{ id: "manrope", label: "Manrope", family: "Manrope" },
					{ id: "dmsans", label: "DM Sans", family: "DM Sans" },
					{ id: "rubik", label: "Rubik", family: "Rubik" },
					{ id: "outfit", label: "Outfit", family: "Outfit" },
					{ id: "sora", label: "Sora", family: "Sora" },
					{ id: "spacegrotesk", label: "Space Grotesk", family: "Space Grotesk" },
					{ id: "jakarta", label: "Plus Jakarta Sans", family: "Plus Jakarta Sans" },
					{ id: "segoe", label: "Segoe UI", family: "Segoe UI" },
					{ id: "helvetica", label: "Helvetica Neue", family: "Helvetica Neue" },
					{ id: "arial", label: "Arial", family: "Arial" },
					{ id: "verdana", label: "Verdana", family: "Verdana" },
					{ id: "tahoma", label: "Tahoma", family: "Tahoma" },
					{ id: "trebuchet", label: "Trebuchet MS", family: "Trebuchet MS" },
					{ id: "calibri", label: "Calibri", family: "Calibri" }
				]
			},
			{
				group: "英文衬线 · Latin serif",
				items: [
					{ id: "georgia", label: "Georgia", family: "Georgia" },
					{ id: "times", label: "Times New Roman", family: "Times New Roman" },
					{ id: "cambria", label: "Cambria", family: "Cambria" },
					{ id: "garamond", label: "Garamond", family: "Garamond" },
					{ id: "palatino", label: "Palatino Linotype", family: "Palatino Linotype" },
					{ id: "bookantiqua", label: "Book Antiqua", family: "Book Antiqua" }
				]
			}
		];

		const CODE_FONT_GROUPS = [
			{
				group: "系统 · System",
				items: [{ id: "system", label: "跟随系统 / System default", family: "" }]
			},
			{
				group: "等宽 · Monospace",
				items: [
					{ id: "cascadia", label: "Cascadia Code", family: "Cascadia Code" },
					{ id: "cascadiamono", label: "Cascadia Mono", family: "Cascadia Mono" },
					{ id: "jetbrains", label: "JetBrains Mono", family: "JetBrains Mono" },
					{ id: "fira", label: "Fira Code", family: "Fira Code" },
					{ id: "consolas", label: "Consolas", family: "Consolas" },
					{ id: "sfmono", label: "SF Mono", family: "SF Mono" },
					{ id: "menlo", label: "Menlo", family: "Menlo" },
					{ id: "monaco", label: "Monaco", family: "Monaco" },
					{ id: "sourcecodepro", label: "Source Code Pro", family: "Source Code Pro" },
					{ id: "ibmplexmono", label: "IBM Plex Mono", family: "IBM Plex Mono" },
					{ id: "robotomono", label: "Roboto Mono", family: "Roboto Mono" },
					{ id: "ubuntumono", label: "Ubuntu Mono", family: "Ubuntu Mono" },
					{ id: "spacemono", label: "Space Mono", family: "Space Mono" },
					{ id: "victormono", label: "Victor Mono", family: "Victor Mono" },
					{ id: "hack", label: "Hack", family: "Hack" },
					{ id: "inconsolata", label: "Inconsolata", family: "Inconsolata" },
					{ id: "anonymouspro", label: "Anonymous Pro", family: "Anonymous Pro" },
					{ id: "dejavu", label: "DejaVu Sans Mono", family: "DejaVu Sans Mono" },
					{ id: "notomono", label: "Noto Sans Mono", family: "Noto Sans Mono" },
					{ id: "maple", label: "Maple Mono", family: "Maple Mono" },
					{ id: "iosevka", label: "Iosevka", family: "Iosevka" },
					{ id: "couriernew", label: "Courier New", family: "Courier New" }
				]
			},
			{
				group: "中文等宽 · CJK mono",
				items: [
					{ id: "sarasamono", label: "更纱黑体等宽 Sarasa Mono SC", family: "Sarasa Mono SC" },
					{ id: "lxgwmono", label: "霞鹜文楷等宽 LXGW WenKai Mono", family: "LXGW WenKai Mono" },
					{ id: "sarasa", label: "Sarasa Gothic SC", family: "Sarasa Gothic SC" },
					{ id: "notomonocjk", label: "Noto Sans Mono CJK SC", family: "Noto Sans Mono CJK SC" }
				]
			}
		];

		/**
		 * Weight choices. The host bakes weight into each `font` shorthand
		 * (`--dsw-font-s-14: 14px/22px …` means 400) and no component reads the
		 * separate `-font-weight` tokens, so lifting body copy means rewriting the
		 * shorthands listed below. Default 400 therefore changes nothing.
		 */
		const FONT_WEIGHTS = [
			{ id: "400", label: "常规 400 / Regular", value: 400 },
			{ id: "500", label: "中等 500 / Medium", value: 500 },
			{ id: "600", label: "半粗 600 / Semibold", value: 600 },
			{ id: "700", label: "粗体 700 / Bold", value: 700 }
		];
		const DEFAULT_WEIGHT = 400;
		const WEIGHT_MIN = 300;
		const WEIGHT_MAX = 700;
		const WEIGHT_STEP = 100;
		/**
		 * Verbatim 400-weight body shorthands from the host stylesheets. Each gets our
		 * weight variable prefixed; strong (500) and heading (600/700) variants are
		 * deliberately untouched so emphasis keeps its contrast against body copy.
		 */
		const WEIGHT_BASE_TOKENS = {
			"--dsw-font-markdown-base": "var(--dsh-content-font-size,14px) / calc(24px + var(--dsh-content-font-delta)) var(--dsw-font-family)",
			"--dsw-font-markdown-table": "var(--dsh-content-font-size-secondary,13px)/calc(22px + var(--dsh-content-font-delta-secondary,0px)) var(--dsw-font-family)",
			"--dsw-font-markdown-small": "12px/20px var(--dsw-font-family)",
			"--dsw-font-base-16": "16px/24px var(--dsw-font-family)",
			"--dsw-font-s-14": "14px/22px var(--dsw-font-family)",
			"--dsw-font-xs-13": "13px/20px var(--dsw-font-family)",
			"--dsw-font-xxs-12": "12px/18px var(--dsw-font-family)",
			"--dsw-font-xxxs-11": "11px/14px var(--dsw-font-family)"
		};
		//#endregion
		//#region pure helpers
		/** Clamp a number into [min, max]; non-finite input falls back to the min. */
		function clamp(value, min, max) {
			const n = Number(value);
			if (!Number.isFinite(n)) return min;
			return Math.min(max, Math.max(min, n));
		}

		/** Round to one decimal — enough for both px radii and superellipse exponents. */
		function round1(value) {
			return Math.round(Number(value) * 10) / 10;
		}

		/** Format a number as a CSS px length without a trailing ".0". */
		function px(value) {
			const n = round1(value);
			return String(n) + "px";
		}

		/** Read a stored number, falling back when absent or malformed. */
		function readNumber(raw, fallback, min, max) {
			if (raw === null || raw === undefined || raw === "") return fallback;
			const n = Number(raw);
			if (!Number.isFinite(n)) return fallback;
			return clamp(n, min, max);
		}

		/**
		 * Map the master base slider onto the host's six radius tokens.
		 * The ratios are the host's own defaults divided by 12, so base = 12
		 * reproduces the shipped scale rather than approximating it.
		 */
		function radiusTokens(base) {
			const b = clamp(base, BASE_MIN, BASE_MAX);
			const out = {};
			for (const key of RADIUS_KEYS) out["--dsw-radius-" + key] = px(b * RADIUS_RATIO[key]);
			return out;
		}

		/** Strip characters that could break out of a CSS declaration. */
		function sanitizeFamily(name) {
			return String(name === null || name === undefined ? "" : name)
				.replace(/[;{}<>]/g, "")
				.replace(/[\r\n]+/g, " ")
				.trim();
		}

		/**
		 * Quote a single family name when CSS requires it (spaces, CJK, digits
		 * first, punctuation). A bare identifier needs no quotes.
		 */
		function quoteFamily(name) {
			const n = sanitizeFamily(name);
			if (n === "") return "";
			if (/^[A-Za-z_][A-Za-z0-9_-]*$/.test(n)) return n;
			return '"' + n.replace(/["\\]/g, "") + '"';
		}

		/**
		 * Build a font stack from a user-supplied value plus the host fallback.
		 * A value that already contains a comma is treated as a complete stack.
		 */
		function buildFontStack(value, fallback) {
			const raw = sanitizeFamily(value);
			if (raw === "") return fallback;
			if (raw.indexOf(",") !== -1) return raw + ", " + fallback;
			return quoteFamily(raw) + ", " + fallback;
		}

		/** Coerce any input into a valid font preference record. */
		function normalizeFontConfig(input) {
			const fallback = { mode: "system", value: "", uploadName: "" };
			if (input === null || typeof input !== "object") return fallback;
			const mode = FONT_MODES.indexOf(input.mode) !== -1 ? input.mode : "system";
			const value = typeof input.value === "string" ? input.value : "";
			const uploadName = typeof input.uploadName === "string" ? input.uploadName : "";
			return { mode: mode, value: value, uploadName: uploadName };
		}

		/**
		 * Turn a font preference into the stack to write, or null when the host's
		 * own family should be left alone.
		 */
		function resolveFontStack(config, fallback) {
			const cfg = normalizeFontConfig(config);
			if (cfg.mode === "system") return null;
			if (cfg.mode === "preset") return cfg.value === "" ? null : buildFontStack(cfg.value, fallback);
			if (cfg.mode === "custom") return cfg.value.trim() === "" ? null : buildFontStack(cfg.value, fallback);
			if (cfg.mode === "upload") return cfg.value === "" ? null : buildFontStack(cfg.value, fallback);
			return null;
		}

		/**
		 * The complete token layer for a preference set. Pure: no DOM, no ctx.
		 * Every value is repeated for light and dark because the override API
		 * demands a pair and these axes are palette-independent.
		 */
		function computeOverrides(prefs) {
			const out = {};
			if (!prefs || prefs.enabled === false) return out;
			const put = (name, value) => {
				if (value === null || value === undefined || value === "") return;
				out[name] = { light: value, dark: value };
			};
			const radii = radiusTokens(prefs.radius);
			for (const name of Object.keys(radii)) put(name, radii[name]);
			const smooth = clamp(prefs.smooth, SMOOTH_MIN, SMOOTH_MAX);
			put("--dsw-corner-shape", "superellipse(" + round1(smooth) + ")");
			const uiStack = resolveFontStack(prefs.fontUi, UI_FALLBACK);
			if (uiStack !== null) put("--dsw-font-family", uiStack);
			const codeStack = resolveFontStack(prefs.fontCode, CODE_FALLBACK);
			if (codeStack !== null) put("--ds-font-family-code", codeStack);
			// Body weight: only the 400-weight shorthands are rewritten, so strong and
			// heading variants keep their own contrast. Default 400 overrides nothing.
			const weight = Number(prefs.weight);
			if (Number.isFinite(weight) && weight !== DEFAULT_WEIGHT) {
				put("--cs-weight", String(weight));
				for (const name of Object.keys(WEIGHT_BASE_TOKENS)) {
					put(name, "var(--cs-weight, " + DEFAULT_WEIGHT + ") " + WEIGHT_BASE_TOKENS[name]);
				}
			}
			return out;
		}

		/** True when the engine actually understands corner-shape (Chromium 139+). */
		function detectShapeSupport() {
			try {
				if (typeof CSS === "undefined" || typeof CSS.supports !== "function") return false;
				return CSS.supports("corner-shape", HOST_CORNER_SHAPE) === true;
			} catch (error) {
				return false;
			}
		}
		//#endregion

		//#region storage
		function readStorage(key) {
			try { return window.localStorage.getItem(key); } catch (error) { return null; }
		}

		function writeStorage(key, value) {
			try {
				if (value === null || value === undefined) window.localStorage.removeItem(key);
				else window.localStorage.setItem(key, value);
			} catch (error) { /* quota or disabled storage — preferences stay in memory this session */ }
		}

		function readFontConfig(key) {
			const raw = readStorage(key);
			if (raw === null) return normalizeFontConfig(null);
			try { return normalizeFontConfig(JSON.parse(raw)); } catch (error) { return normalizeFontConfig(null); }
		}

		function writeFontConfig(key, config) {
			try { writeStorage(key, JSON.stringify(normalizeFontConfig(config))); } catch (error) { /* ignore */ }
		}
		//#endregion

		//#region IndexedDB (uploaded font binaries)
		const DB_NAME = "dsh-corner-studio";
		const DB_STORE = "fonts";
		const DB_VERSION = 1;
		const UPLOAD_ACCEPT = ".ttf,.otf,.woff,.woff2,font/*";

		function openDb() {
			return new Promise((resolve, reject) => {
				let request;
				try { request = window.indexedDB.open(DB_NAME, DB_VERSION); } catch (error) { reject(error); return; }
				request.onupgradeneeded = () => {
					const db = request.result;
					if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
				};
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			});
		}

		function withStore(mode, run) {
			return openDb().then((db) => new Promise((resolve, reject) => {
				let request;
				try {
					const tx = db.transaction(DB_STORE, mode);
					tx.oncomplete = () => { db.close(); resolve(request ? request.result : undefined); };
					tx.onerror = () => { db.close(); reject(tx.error); };
					tx.onabort = () => { db.close(); reject(tx.error); };
					request = run(tx.objectStore(DB_STORE));
				} catch (error) { db.close(); reject(error); }
			}));
		}

		const readUpload = () => withStore("readonly", (store) => store.get("font:upload"));
		const writeUpload = (record) => withStore("readwrite", (store) => store.put(record, "font:upload"));
		const clearUpload = () => withStore("readwrite", (store) => store.delete("font:upload"));
		//#endregion

		//#region theme override layer
		let overrideDispose = null;
		/** Guards against re-entrancy: overrideTokens publishes theme/change synchronously. */
		let applying = false;

		//#region shell frame radius + text layer
		const FRAME_CSS_ID = "dsh-corner-studio-frame-css";
		/**
		 * One plugin-owned stylesheet carrying three concerns.
		 *
		 * 1. Outermost radius. The shell already rounds the outermost content column
		 *    on Windows from its own stylesheet:
		 *      [data-windows-titlebar] .frame { --dsh-windows-content-radius: 16px }
		 *      [data-windows-titlebar] .centerCol {
		 *        border-radius: var(--dsh-windows-content-radius) 0 0 0;
		 *        corner-shape: round;
		 *      }
		 *    Pointing that host variable at our scale makes the outermost edge follow
		 *    the slider; --dsw-radius-lg IS the 16px step, so the default reproduces
		 *    the host look. The html prefix raises specificity above the shell's
		 *    equally-specific rule regardless of insertion order.
		 *
		 * 2. Body weight. The shell hardcodes font-weight in 72 places and only ~20
		 *    use the `font:` shorthands this plugin rewrites, so rewriting tokens
		 *    alone only reached the conversation pane. `body{font-weight}` is
		 *    inherited by everything that declares no weight itself, which is what
		 *    carries the control into the sidebar, settings and chrome.
		 *
		 * 3. Optional smoothing. On Windows this is mostly a no-op: Chromium renders
		 *    through the system ClearType path and ignores -webkit-font-smoothing.
		 *    `text-rendering` still applies, and on macOS the smoothing properties are
		 *    the real thing.
		 */
		function frameCss(prefs) {
			const rules = [
				"/* dsh-corner-studio: outermost shell edge follows the radius scale */",
				"html[data-windows-titlebar] [class*=\"_frame\"]{",
				"  --dsh-windows-content-radius: var(--dsw-radius-lg);",
				"}",
				"/* body weight: inherited by anything that declares no weight itself */",
				"body{font-weight:var(--cs-weight," + DEFAULT_WEIGHT + ");}"
			];
			if (prefs && prefs.smoothFont === true) {
				rules.push("/* optional smoothing; -webkit-font-smoothing is ignored on Windows */");
				rules.push("body{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility;}");
			}
			return rules.join("\n");
		}

		function applyFrameCss(prefs) {
			try {
				if (typeof document === "undefined") return;
				let tag = document.getElementById(FRAME_CSS_ID);
				if (tag === null) {
					tag = document.createElement("style");
					tag.id = FRAME_CSS_ID;
					tag.setAttribute("data-plugin-css", OVERRIDE_SOURCE);
					document.head.appendChild(tag);
				}
				tag.textContent = frameCss(prefs);
			} catch (error) { /* never block the boot */ }
		}

		function teardownFrameCss() {
			try { document.getElementById(FRAME_CSS_ID)?.remove(); } catch (error) { /* already gone */ }
		}
		//#endregion

		function teardownOverrides() {
			if (typeof overrideDispose === "function") {
				try { overrideDispose(); } catch (error) { /* layer already gone */ }
			}
			overrideDispose = null;
		}

		function applyOverrides(ctx, prefs) {
			if (applying) return;
			applying = true;
			try {
				teardownOverrides();
				const overrides = computeOverrides(prefs);
				if (Object.keys(overrides).length === 0) {
					teardownFrameCss();
					return;
				}
				overrideDispose = ctx.theme.overrideTokens(OVERRIDE_SOURCE, overrides);
				applyFrameCss(prefs);
			} finally {
				applying = false;
			}
		}
		//#endregion

		//#region locale
		const zh = {
			"nav": "圆角与字体",
			"row.title": "圆角与字体",
			"row.subtitle": "一条滑杆调圆角，另一条调平滑度；界面与代码字体可分别更换",
			"radius.label": "圆角大小",
			"radius.hint": "一条滑杆统管全部圆角。12px 就是 DSH 原本的圆角，往左更方正，往右更圆润；0 是全直角。",
			"shape.label": "圆角平滑",
			"shape.hint": "超椭圆连续曲率（iOS 图标那种圆角）。1.0 是普通圆弧，1.5 是 DSH 默认，越大越方正。",
			"shape.unsupported": "当前内核不支持圆角平滑，这条滑杆已停用（其余功能不受影响）。",
			"font.ui": "界面字体",
			"font.code": "代码字体",
			"font.preset": "从预设中选择",
			"font.custom": "自定义输入字体名…",
			"font.customPlaceholder": "输入电脑里已安装的字体名，例如：微软雅黑",
			"font.customHint": "直接填字体名即可；留空表示不改动。想换电脑里没有的字体，请用下面的上传。",
			"font.upload": "上传字体文件…",
			"font.uploading": "正在载入…",
			"font.uploaded": "已上传：",
			"font.uploadUse": "使用这个字体",
			"font.uploadRemove": "移除",
			"font.uploadHint": "支持 .ttf / .otf / .woff / .woff2，保存在本机浏览器里，不会上传到任何服务器。",
			"font.uploadFailed": "这个字体文件读不出来，请换一个 .ttf / .otf / .woff / .woff2 文件试试。",
			"font.preview": "预览：",
			"font.previewText": "字体预览 Font Sample 0123 ABC abc",
			"font.reset": "恢复全部默认",
			"font.resetDone": "已恢复 DSH 原本的圆角与字体。",
			"weight.label": "字体粗细",
			"weight.hint": "整体提升正文的字重。标题和已加粗的部分保持原样，层次不会被压平；400 就是 DSH 原样。",
			"smoothFont.label": "字体平滑",
			"smoothFont.hint": "开启抗锯齿并启用优化排版。注意：Windows 上字体渲染由系统 ClearType 控制，浏览器会忽略抗锯齿开关，所以这里主要生效的是排版优化。"
		};
		const en = {
			"nav": "Corners & Fonts",
			"row.title": "Corners & Fonts",
			"row.subtitle": "One radius slider, one smoothness slider, and separate UI/code font families",
			"radius.label": "Corner radius",
			"radius.hint": "One slider drives every corner. 12px is DSH's own scale; left is squarer, right is rounder, 0 is fully square.",
			"shape.label": "Corner smoothness",
			"shape.hint": "Superellipse continuity (the iOS-icon corner). 1.0 is a plain arc, 1.5 is the DSH default, higher is squarer.",
			"shape.unsupported": "This engine does not support corner-shape, so this slider is disabled (everything else still works).",
			"font.ui": "UI font",
			"font.code": "Code font",
			"font.preset": "Pick a preset",
			"font.custom": "Type a family name…",
			"font.customPlaceholder": "Any family installed on this machine, e.g. Microsoft YaHei",
			"font.customHint": "Type the family name directly; empty means leave it alone. For a font you do not have, use the upload below.",
			"font.upload": "Upload a font file…",
			"font.uploading": "Loading…",
			"font.uploaded": "Uploaded: ",
			"font.uploadUse": "Use this font",
			"font.uploadRemove": "Remove",
			"font.uploadHint": "Accepts .ttf / .otf / .woff / .woff2. It stays in this browser and is never sent anywhere.",
			"font.uploadFailed": "That font file could not be read. Try another .ttf / .otf / .woff / .woff2 file.",
			"font.preview": "Preview: ",
			"font.previewText": "Font sample 0123 ABC abc 圆角字体",
			"font.reset": "Reset everything",
			"font.resetDone": "DSH's original corners and fonts are back.",
			"weight.label": "Font weight",
			"weight.hint": "Lifts body-copy weight overall. Headings and already-bold text keep their own weight, so the hierarchy survives; 400 is the host's own default.",
			"smoothFont.label": "Font smoothing",
			"smoothFont.hint": "Turns on antialiasing and optimized text rendering. Note: on Windows font rasterisation is owned by the system ClearType path and Chromium ignores the antialiasing switch, so mainly the rendering hints take effect."
		};
		//#endregion



		//#region styles
		const styles = {
			group: {
				display: "flex",
				flexDirection: "column",
				gap: "16px",
				width: "100%",
				maxWidth: "720px",
				padding: "4px 0"
			},
			headerRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" },
			title: { color: "var(--dsw-alias-label-primary)", fontSize: "14px", fontWeight: 400, lineHeight: "22px" },
			subtitle: { color: "var(--dsw-alias-label-tertiary)", fontSize: "12px", lineHeight: "18px" },
			hint: { color: "var(--dsw-alias-label-tertiary)", fontSize: "12px", lineHeight: "18px" },
			warn: { color: "var(--dsw-alias-state-warn-primary, #b7791f)", fontSize: "12px", lineHeight: "18px" },
			error: { color: "#e5484d", fontSize: "12px", lineHeight: "18px" },
			sectionLabel: { color: "var(--dsw-alias-label-secondary)", fontSize: "12px", lineHeight: "18px", marginTop: "6px" },
			sliderRow: { display: "flex", alignItems: "center", gap: "10px" },
			sliderLabel: { color: "var(--dsw-alias-label-secondary)", fontSize: "12px", width: "72px", flexShrink: 0 },
			slider: { flex: 1, minWidth: "120px" },
			sliderValue: { color: "var(--dsw-alias-label-tertiary)", fontSize: "12px", width: "48px", textAlign: "right" },
			button: {
				padding: "5px 12px",
				borderRadius: "8px",
				border: "1px solid var(--dsw-alias-border-l2)",
				background: "var(--dsw-alias-bg-layer-1)",
				color: "var(--dsw-alias-label-primary)",
				fontSize: "12px",
				cursor: "pointer",
				font: "inherit"
			},
			actionButton: {
				padding: "4px 10px",
				borderRadius: "8px",
				border: "1px solid var(--dsw-alias-border-l2)",
				background: "transparent",
				color: "var(--dsw-alias-label-secondary)",
				fontSize: "12px",
				lineHeight: "18px",
				cursor: "pointer",
				font: "inherit"
			},
			actionButtonDanger: {
				padding: "4px 10px",
				borderRadius: "8px",
				border: "1px solid rgba(229, 72, 77, 0.45)",
				background: "transparent",
				color: "#e5484d",
				fontSize: "12px",
				lineHeight: "18px",
				cursor: "pointer",
				font: "inherit"
			},
			select: {
				flex: 1,
				minWidth: "180px",
				padding: "5px 10px",
				borderRadius: "8px",
				border: "1px solid var(--dsw-alias-border-l2)",
				background: "var(--dsw-alias-bg-layer-1)",
				color: "var(--dsw-alias-label-primary)",
				fontSize: "12px",
				font: "inherit",
				boxSizing: "border-box"
			},
			textInput: {
				flex: 1,
				minWidth: "180px",
				padding: "5px 10px",
				borderRadius: "8px",
				border: "1px solid var(--dsw-alias-border-l2)",
				background: "var(--dsw-alias-bg-layer-1)",
				color: "var(--dsw-alias-label-primary)",
				fontSize: "12px",
				font: "inherit",
				boxSizing: "border-box"
			},
			row: { display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" },
			preview: {
				padding: "8px 10px",
				borderRadius: "8px",
				border: "1px dashed var(--dsw-alias-border-l2)",
				background: "var(--dsw-alias-bg-layer-1)",
				color: "var(--dsw-alias-label-primary)",
				fontSize: "14px",
				lineHeight: "22px",
				whiteSpace: "nowrap",
				overflow: "hidden",
				textOverflow: "ellipsis"
			},
			card: {
				display: "flex",
				flexDirection: "column",
				gap: "8px",
				padding: "10px",
				borderRadius: "10px",
				border: "1px solid var(--dsw-alias-border-l1)",
				background: "var(--dsw-alias-bg-layer-1)"
			}
		};

		function Toggle({ checked, onChange }) {
			return (0, jsx.jsx)("button", {
				type: "button",
				role: "switch",
				"aria-checked": checked,
				onClick: () => onChange(!checked),
				style: {
					width: "40px",
					height: "22px",
					borderRadius: "11px",
					background: checked ? "var(--dsw-alias-brand-primary)" : "var(--dsw-alias-bg-layer-3)",
					border: checked ? "1px solid transparent" : "1px solid var(--dsw-alias-border-l2)",
					position: "relative",
					cursor: "pointer",
					padding: 0,
					flexShrink: 0,
					transition: "background 0.2s",
					font: "inherit",
					boxSizing: "border-box"
				},
				children: (0, jsx.jsx)("span", {
					style: {
						position: "absolute",
						top: "2px",
						left: checked ? "20px" : "2px",
						width: "18px",
						height: "18px",
						borderRadius: "50%",
						background: "#ffffff",
						boxShadow: "0 1px 3px rgba(0, 0, 0, 0.3)",
						transition: "left 0.2s"
					}
				})
			});
		}

		function Slider({ label, value, min, max, step, format, onChange, disabled }) {
			return (0, jsx.jsxs)("div", {
				style: styles.sliderRow,
				children: [
					(0, jsx.jsx)("span", { style: styles.sliderLabel, children: label }),
					(0, jsx.jsx)("input", {
						type: "range",
						min: min,
						max: max,
						step: step,
						value: value,
						disabled: disabled === true,
						style: styles.slider,
						onChange: (event) => onChange(Number(event.target.value))
					}),
					(0, jsx.jsx)("span", { style: styles.sliderValue, children: format(value) })
				]
			});
		}
		//#endregion

		//#region font section component
		/** Encode a preference as the <select> value. */
		function selectValue(config, hasUpload) {
			const cfg = normalizeFontConfig(config);
			if (cfg.mode === "upload" && hasUpload) return "upload";
			if (cfg.mode === "custom") return "custom";
			if (cfg.mode === "preset" && cfg.value !== "") return "preset:" + cfg.value;
			if (cfg.mode === "preset" && cfg.value === "") return "system";
			return "system";
		}

		function FontSection({ slot, title, config, hasUpload, uploadName, presets, fallback, t, onChange, onUpload, onRemoveUpload }) {
			const draftState = _react.useState(config.mode === "custom" ? config.value : "");
			const draft = draftState[0];
			const setDraft = draftState[1];
			const busyState = _react.useState(false);
			const busy = busyState[0];
			const setBusy = busyState[1];
			const errorState = _react.useState("");
			const error = errorState[0];
			const setError = errorState[1];
			const fileRef = _react.useRef(null);

			_react.useEffect(() => {
				if (config.mode === "custom") setDraft(config.value);
			}, [config.mode, config.value]);

			const handleSelect = (raw) => {
				setError("");
				if (raw === "system") return onChange({ mode: "system", value: "", uploadName: "" });
				if (raw === "custom") return onChange({ mode: "custom", value: draft, uploadName: "" });
				if (raw === "upload") return onChange({ mode: "upload", value: config.mode === "upload" ? config.value : "", uploadName: uploadName });
				if (raw.indexOf("preset:") === 0) return onChange({ mode: "preset", value: raw.slice(7), uploadName: "" });
			};

			const handlePick = (file) => {
				if (!file) return;
				setBusy(true);
				setError("");
				Promise.resolve(onUpload(slot, file)).then(
					() => { setBusy(false); },
					() => { setBusy(false); setError(t("font.uploadFailed")); }
				);
			};

			const stack = resolveFontStack(config, fallback);
			const previewStyle = Object.assign({}, styles.preview, stack === null ? {} : { fontFamily: stack });

			return (0, jsx.jsxs)("div", {
				style: styles.card,
				children: [
					(0, jsx.jsx)("div", { style: styles.sectionLabel, children: title }),
					(0, jsx.jsxs)("div", {
						style: styles.row,
						children: [
							(0, jsx.jsx)("select", {
								style: styles.select,
								value: selectValue(config, hasUpload),
								onChange: (event) => handleSelect(event.target.value),
								children: presets.map((group) => (0, jsx.jsx)("optgroup", {
									label: group.group,
									children: group.items.map((preset) => (0, jsx.jsx)("option", {
										value: preset.id === "system" ? "system" : "preset:" + preset.family,
										children: preset.label
									}, preset.id))
								}, group.group)).concat([
									(0, jsx.jsx)("option", { value: "custom", children: t("font.custom") }, "__custom"),
									hasUpload ? (0, jsx.jsx)("option", { value: "upload", children: t("font.uploaded") + uploadName }, "__upload") : null
								].filter(Boolean))
							})
						]
					}),
					config.mode === "custom" ? (0, jsx.jsx)("input", {
						style: styles.textInput,
						placeholder: t("font.customPlaceholder"),
						value: draft,
						onChange: (event) => {
							const next = event.target.value;
							setDraft(next);
							onChange({ mode: "custom", value: next, uploadName: "" });
						}
					}) : null,
					(0, jsx.jsxs)("div", {
						style: styles.row,
						children: [
							(0, jsx.jsx)("button", {
								type: "button",
								style: styles.actionButton,
								disabled: busy,
								onClick: () => fileRef.current && fileRef.current.click(),
								children: busy ? t("font.uploading") : t("font.upload")
							}),
							hasUpload ? (0, jsx.jsx)("span", {
								style: styles.hint,
								children: t("font.uploaded") + uploadName
							}) : null,
							hasUpload ? (0, jsx.jsx)("button", {
								type: "button",
								style: styles.actionButtonDanger,
								onClick: () => { setError(""); onRemoveUpload(slot); },
								children: t("font.uploadRemove")
							}) : null
						]
					}),
					(0, jsx.jsx)("input", {
						ref: fileRef,
						type: "file",
						accept: UPLOAD_ACCEPT,
						style: { display: "none" },
						onChange: (event) => {
							handlePick(event.target.files && event.target.files[0]);
							event.target.value = "";
						}
					}),
					error !== "" ? (0, jsx.jsx)("div", { style: styles.error, children: error }) : null,
					(0, jsx.jsxs)("div", {
						style: styles.row,
						children: [
							(0, jsx.jsx)("span", { style: styles.hint, children: t("font.preview") }),
							(0, jsx.jsx)("div", { style: Object.assign({ flex: 1 }, previewStyle), children: t("font.previewText") })
						]
					}),
					(0, jsx.jsx)("div", { style: styles.hint, children: t("font.uploadHint") })
				]
			});
		}

		/** The single settings row: master radius, smoothness, UI font, code font. */
		function CornerStudioRow({ t, getState, subscribe, setEnabled, setRadius, setSmooth, setWeight, setSmoothFont, setFontUi, setFontCode, uploadFont, removeUpload, resetAll }) {
			const statePair = _react.useState(getState);
			const state = statePair[0];
			const setState = statePair[1];
			_react.useEffect(() => subscribe(setState), [subscribe]);
			const on = state.on;
			const radius = state.radius;
			const smooth = state.smooth;
			const weight = state.weight;
			const smoothFont = state.smoothFont;
			const fontUi = state.fontUi;
			const fontCode = state.fontCode;
			const uploadName = state.uploadName;
			const supportsShape = state.supportsShape;
			const hasUpload = typeof uploadName === "string" && uploadName !== "";
			return (0, jsx.jsxs)("div", {
				style: styles.group,
				children: [
					(0, jsx.jsxs)("div", {
						style: styles.headerRow,
						children: [
							(0, jsx.jsx)("div", { style: styles.title, children: t("row.title") }),
							(0, jsx.jsx)(Toggle, { checked: on, onChange: (value) => setEnabled(value) })
						]
					}),
					on ? (0, jsx.jsx)("div", { style: styles.subtitle, children: t("row.subtitle") }) : null,
					on ? (0, jsx.jsx)(Slider, {
						label: t("radius.label"),
						value: radius,
						min: BASE_MIN,
						max: BASE_MAX,
						step: 1,
						format: (value) => px(value),
						onChange: setRadius
					}) : null,
					on ? (0, jsx.jsx)("div", { style: styles.hint, children: t("radius.hint") }) : null,
					on && !supportsShape ? (0, jsx.jsx)("div", { style: styles.warn, children: t("shape.unsupported") }) : null,
					on ? (0, jsx.jsx)(Slider, {
						label: t("shape.label"),
						value: smooth,
						min: SMOOTH_MIN,
						max: SMOOTH_MAX,
						step: SMOOTH_STEP,
						format: (value) => Number(value).toFixed(1),
						disabled: !supportsShape,
						onChange: setSmooth
					}) : null,
					on ? (0, jsx.jsx)("div", { style: styles.hint, children: t("shape.hint") }) : null,
					on ? (0, jsx.jsx)(Slider, {
						label: t("weight.label"),
						value: weight === undefined ? DEFAULT_WEIGHT : weight,
						min: WEIGHT_MIN,
						max: WEIGHT_MAX,
						step: WEIGHT_STEP,
						format: (value) => String(value),
						onChange: setWeight
					}) : null,
					on ? (0, jsx.jsx)("div", { style: styles.hint, children: t("weight.hint") }) : null,
					on ? (0, jsx.jsxs)("div", {
						style: styles.sliderRow,
						children: [
							(0, jsx.jsx)("span", { style: styles.sliderLabel, children: t("smoothFont.label") }),
							(0, jsx.jsx)(Toggle, { checked: smoothFont === true, onChange: (value) => setSmoothFont(value) })
						]
					}) : null,
					on ? (0, jsx.jsx)("div", { style: styles.hint, children: t("smoothFont.hint") }) : null,
					on ? (0, jsx.jsx)(FontSection, {
						slot: "ui",
						title: t("font.ui"),
						config: fontUi,
						hasUpload: hasUpload,
						uploadName: uploadName,
						presets: UI_FONT_GROUPS,
						fallback: UI_FALLBACK,
						t: t,
						onChange: setFontUi,
						onUpload: uploadFont,
						onRemoveUpload: removeUpload
					}) : null,
					on ? (0, jsx.jsx)(FontSection, {
						slot: "code",
						title: t("font.code"),
						config: fontCode,
						hasUpload: hasUpload,
						uploadName: uploadName,
						presets: CODE_FONT_GROUPS,
						fallback: CODE_FALLBACK,
						t: t,
						onChange: setFontCode,
						onUpload: uploadFont,
						onRemoveUpload: removeUpload
					}) : null,
					on ? (0, jsx.jsx)("div", {
						style: styles.row,
						children: (0, jsx.jsx)("button", {
							type: "button",
							style: styles.actionButton,
							onClick: () => resetAll(),
							children: t("font.reset")
						})
					}) : null
				]
			});
		}
		//#endregion

		//#region plugin body
		const inject = ["slots", "locale", "theme"];

		/** Register an uploaded font binary so it is usable as a family name. */
		function registerFace(family, buffer) {
			const face = new FontFace(family, buffer);
			return face.load().then((loaded) => {
				document.fonts.add(loaded);
				return loaded;
			});
		}

		function apply(ctx) {
			let disposed = false;
			/** slot -> { family, name, face } once an uploaded font is live. */
			const faces = new Map();

			const prefs = {
				enabled: readStorage(KEY_ENABLED) !== "off",
				radius: readNumber(readStorage(KEY_RADIUS), BASE_DEFAULT, BASE_MIN, BASE_MAX),
				smooth: readNumber(readStorage(KEY_SMOOTH), SMOOTH_DEFAULT, SMOOTH_MIN, SMOOTH_MAX),
				fontUi: readFontConfig(KEY_FONT_UI),
				fontCode: readFontConfig(KEY_FONT_CODE),
				uploadName: "",
				weight: readNumber(readStorage(KEY_WEIGHT), DEFAULT_WEIGHT, 100, 900),
				smoothFont: readStorage(KEY_SMOOTH_FONT) === "on",
				supportsShape: detectShapeSupport()
			};

			const listeners = new Set();
			/** Snapshot shape the settings row consumes; `prefs.enabled` is exposed as `on`. */
			const toState = () => ({
				on: prefs.enabled,
				radius: prefs.radius,
				smooth: prefs.smooth,
				weight: prefs.weight,
				smoothFont: prefs.smoothFont,
				fontUi: prefs.fontUi,
				fontCode: prefs.fontCode,
				uploadName: prefs.uploadName,
				supportsShape: prefs.supportsShape
			});
			let snapshot = toState();
			/** The row reads state through this pair; no framework store hook is involved. */
			const getState = () => snapshot;
			const subscribe = (fn) => {
				listeners.add(fn);
				return () => { listeners.delete(fn); };
			};
			const emit = () => {
				if (disposed) return;
				snapshot = toState();
				for (const fn of listeners) {
					try { fn(snapshot); } catch (error) { /* a listener must not break the row */ }
				}
			};

			const repaint = () => { applyOverrides(ctx, prefs); emit(); };

			/** Re-register a stored upload and expose it to the store. */
			const hydrateUpload = () => {
				const config = prefs.fontUi.mode === "upload" ? prefs.fontUi : prefs.fontCode;
				return readUpload().then((record) => {
					if (!record || !record.buffer) return null;
					return registerFace(record.family, record.buffer).then((face) => {
						faces.set("upload", { family: record.family, name: record.name, face: face });
						prefs.uploadName = record.name || "font";
						// A stored "upload" preference survives a reload only if its family is back.
						if (config.mode === "upload" && config.value !== record.family) {
							const patched = normalizeFontConfig({ mode: "upload", value: record.family, uploadName: record.name });
							if (prefs.fontUi.mode === "upload") prefs.fontUi = patched;
							else prefs.fontCode = patched;
						}
						repaint();
						return record;
					});
				}).catch(() => null);
			};

			try {
				applyOverrides(ctx, prefs);
			} catch (error) { /* never block the boot; the row still renders disabled-looking */ }
			emit();

			ctx.effect(() => () => {
				disposed = true;
				teardownOverrides();
				teardownFrameCss();
				for (const entry of faces.values()) {
					try { document.fonts.delete(entry.face); } catch (error) { /* already gone */ }
				}
				faces.clear();
			}, "corner-studio: cleanup");

			ctx.effect(() => ctx.locale.register(SETTINGS_NS, { zh: zh, en: en }), "corner-studio: dictionaries");
			const t = ctx.locale.bind(SETTINGS_NS);

			hydrateUpload();

			const injected = () => ({
					getState: getState,
					subscribe: subscribe,
					setEnabled: (value) => {
						prefs.enabled = value === true;
						writeStorage(KEY_ENABLED, prefs.enabled ? "on" : "off");
						repaint();
					},
					setRadius: (value) => {
						prefs.radius = clamp(value, BASE_MIN, BASE_MAX);
						writeStorage(KEY_RADIUS, String(prefs.radius));
						repaint();
					},
					setSmooth: (value) => {
						prefs.smooth = clamp(Number(value), SMOOTH_MIN, SMOOTH_MAX);
						writeStorage(KEY_SMOOTH, String(round1(prefs.smooth)));
						repaint();
					},
					setWeight: (value) => {
						prefs.weight = clamp(Number(value), 100, 900);
						writeStorage(KEY_WEIGHT, String(prefs.weight));
						repaint();
					},
					setSmoothFont: (value) => {
						prefs.smoothFont = value === true;
						writeStorage(KEY_SMOOTH_FONT, prefs.smoothFont ? "on" : "off");
						repaint();
					},
					setFontUi: (config) => {
						prefs.fontUi = normalizeFontConfig(config);
						writeFontConfig(KEY_FONT_UI, prefs.fontUi);
						repaint();
					},
					setFontCode: (config) => {
						prefs.fontCode = normalizeFontConfig(config);
						writeFontConfig(KEY_FONT_CODE, prefs.fontCode);
						repaint();
					},
					uploadFont: (slot, file) => {
						if (!file || typeof file.arrayBuffer !== "function") return Promise.reject(new Error("no file"));
						return file.arrayBuffer().then((buffer) => {
							const family = "CornerStudio-" + (slot === "code" ? "Code" : "UI") + "-" + Date.now().toString(36);
							return registerFace(family, buffer).then((face) => {
								const record = {
									family: family,
									name: file.name || "font",
									buffer: buffer,
									size: buffer.byteLength || 0,
									stamp: Date.now()
								};
								return writeUpload(record).then(() => {
									const previous = faces.get("upload");
									if (previous && previous.face !== face) {
										try { document.fonts.delete(previous.face); } catch (error) { /* ignore */ }
									}
									faces.set("upload", { family: family, name: record.name, face: face });
									prefs.uploadName = record.name;
									const config = normalizeFontConfig({ mode: "upload", value: family, uploadName: record.name });
									if (slot === "code") {
										prefs.fontCode = config;
										writeFontConfig(KEY_FONT_CODE, config);
									} else {
										prefs.fontUi = config;
										writeFontConfig(KEY_FONT_UI, config);
									}
									repaint();
								});
							});
						});
					},
					removeUpload: () => {
						const previous = faces.get("upload");
						if (previous) {
							try { document.fonts.delete(previous.face); } catch (error) { /* ignore */ }
						}
						faces.delete("upload");
						prefs.uploadName = "";
						for (const key of [KEY_FONT_UI, KEY_FONT_CODE]) {
							const cfg = readFontConfig(key);
							if (cfg.mode === "upload") writeFontConfig(key, normalizeFontConfig(null));
						}
						if (prefs.fontUi.mode === "upload") prefs.fontUi = normalizeFontConfig(null);
						if (prefs.fontCode.mode === "upload") prefs.fontCode = normalizeFontConfig(null);
						clearUpload().catch(() => null);
						repaint();
					},
					resetAll: () => {
						prefs.enabled = true;
						prefs.radius = BASE_DEFAULT;
						prefs.smooth = SMOOTH_DEFAULT;
						prefs.weight = DEFAULT_WEIGHT;
						prefs.smoothFont = false;
						prefs.fontUi = normalizeFontConfig(null);
						prefs.fontCode = normalizeFontConfig(null);
						writeStorage(KEY_ENABLED, "on");
						writeStorage(KEY_RADIUS, String(BASE_DEFAULT));
						writeStorage(KEY_SMOOTH, String(SMOOTH_DEFAULT));
						writeStorage(KEY_WEIGHT, String(DEFAULT_WEIGHT));
						writeStorage(KEY_SMOOTH_FONT, "off");
						writeFontConfig(KEY_FONT_UI, prefs.fontUi);
						writeFontConfig(KEY_FONT_CODE, prefs.fontCode);
						repaint();
					}
				});

			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "corner-studio",
				order: 110,
				label: () => t("nav"),
				locale: SETTINGS_NS,
				inject: injected
			}, CornerStudioRow));
		}
		//#endregion

		exports.SETTINGS_NS = SETTINGS_NS;
		exports.OVERRIDE_SOURCE = OVERRIDE_SOURCE;
		exports.frameCss = frameCss;
		exports.RADIUS_KEYS = RADIUS_KEYS;
		exports.RADIUS_DEFAULTS = RADIUS_DEFAULTS;
		exports.RADIUS_RATIO = RADIUS_RATIO;
		exports.BASE_DEFAULT = BASE_DEFAULT;
		exports.SMOOTH_DEFAULT = SMOOTH_DEFAULT;
		exports.UI_FALLBACK = UI_FALLBACK;
		exports.CODE_FALLBACK = CODE_FALLBACK;
		exports.UI_FONT_GROUPS = UI_FONT_GROUPS;
		exports.CODE_FONT_GROUPS = CODE_FONT_GROUPS;
		exports.FONT_WEIGHTS = FONT_WEIGHTS;
		exports.WEIGHT_MIN = WEIGHT_MIN;
		exports.WEIGHT_MAX = WEIGHT_MAX;
		exports.WEIGHT_STEP = WEIGHT_STEP;
		exports.DEFAULT_WEIGHT = DEFAULT_WEIGHT;
		exports.WEIGHT_BASE_TOKENS = WEIGHT_BASE_TOKENS;
		exports.clamp = clamp;
		exports.px = px;
		exports.radiusTokens = radiusTokens;
		exports.quoteFamily = quoteFamily;
		exports.sanitizeFamily = sanitizeFamily;
		exports.buildFontStack = buildFontStack;
		exports.normalizeFontConfig = normalizeFontConfig;
		exports.resolveFontStack = resolveFontStack;
		exports.computeOverrides = computeOverrides;
		exports.detectShapeSupport = detectShapeSupport;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
