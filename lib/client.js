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
		let _store = require("@deepseek-ai/dsh-client-store");

		//#region constants
		const SETTINGS_NS = "settings.corner-studio";
		const OVERRIDE_SOURCE = "dsh-corner-studio";
		const KEY_ENABLED = "dsh-corner-studio:enabled";
		const KEY_RADIUS = "dsh-corner-studio:radius";
		const KEY_SMOOTH = "dsh-corner-studio:smooth";
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

		/** Curated families. Live availability is resolved by the browser, not asserted here. */
		const UI_PRESETS = [
			{ id: "system", label: "系统默认 / System default", family: "" },
			{ id: "msyh", label: "微软雅黑 Microsoft YaHei", family: "Microsoft YaHei" },
			{ id: "pingfang", label: "苹方 PingFang SC", family: "PingFang SC" },
			{ id: "sourcehan", label: "思源黑体 Source Han Sans SC", family: "Source Han Sans SC" },
			{ id: "noto", label: "Noto Sans SC", family: "Noto Sans SC" },
			{ id: "lxgw", label: "霞鹜文楷 LXGW WenKai", family: "LXGW WenKai" },
			{ id: "sarasa", label: "更纱黑体 Sarasa Gothic SC", family: "Sarasa Gothic SC" },
			{ id: "harmony", label: "HarmonyOS Sans SC", family: "HarmonyOS Sans SC" },
			{ id: "alibaba", label: "阿里巴巴普惠体 Alibaba PuHuiTi", family: "Alibaba PuHuiTi" },
			{ id: "inter", label: "Inter", family: "Inter" },
			{ id: "roboto", label: "Roboto", family: "Roboto" },
			{ id: "segoe", label: "Segoe UI", family: "Segoe UI" },
			{ id: "georgia", label: "Georgia（衬线）", family: "Georgia" },
			{ id: "times", label: "Times New Roman（衬线）", family: "Times New Roman" }
		];

		const CODE_PRESETS = [
			{ id: "system", label: "系统默认 / System default", family: "" },
			{ id: "cascadia", label: "Cascadia Code", family: "Cascadia Code" },
			{ id: "jetbrains", label: "JetBrains Mono", family: "JetBrains Mono" },
			{ id: "fira", label: "Fira Code", family: "Fira Code" },
			{ id: "consolas", label: "Consolas", family: "Consolas" },
			{ id: "sfmono", label: "SF Mono", family: "SF Mono" },
			{ id: "sourcecodepro", label: "Source Code Pro", family: "Source Code Pro" },
			{ id: "ibmplex", label: "IBM Plex Mono", family: "IBM Plex Mono" },
			{ id: "maple", label: "Maple Mono", family: "Maple Mono" },
			{ id: "lxgwmono", label: "霞鹜文楷等宽 LXGW WenKai Mono", family: "LXGW WenKai Mono" },
			{ id: "sarasa", label: "Sarasa Mono SC", family: "Sarasa Mono SC" }
		];
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
				if (Object.keys(overrides).length === 0) return;
				overrideDispose = ctx.theme.overrideTokens(OVERRIDE_SOURCE, overrides);
			} finally {
				applying = false;
			}
		}
		//#endregion

		//#region locale
		const zh = {
			"row.title": "圆角与字体",
			"row.subtitle": "Corner & Font Studio · 总滑杆调圆角，另一条调平滑度，界面与代码字体可分别更换",
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
			"font.previewText": "圆角与字体 Studio 0123 ABC abc",
			"font.reset": "恢复全部默认",
			"font.resetDone": "已恢复 DSH 原本的圆角与字体。"
		};
		const en = {
			"row.title": "Corners & Fonts",
			"row.subtitle": "Corner & Font Studio · one master radius slider, one smoothness slider, and separate UI/code font families",
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
			"font.previewText": "Corners & Fonts Studio 0123 ABC abc 圆角字体",
			"font.reset": "Reset everything",
			"font.resetDone": "DSH's original corners and fonts are back."
		};
		//#endregion

		//#region store
		function createStore() {
			return (0, _store.defineStore)({
				init: () => ({
					on: true,
					radius: BASE_DEFAULT,
					smooth: SMOOTH_DEFAULT,
					fontUi: normalizeFontConfig(null),
					fontCode: normalizeFontConfig(null),
					uploadName: "",
					supportsShape: true,
					revision: -1
				}),
				actions: {
					sync: (d, next, revision) => {
						if (revision <= d.revision) return;
						d.on = next.on;
						d.radius = next.radius;
						d.smooth = next.smooth;
						d.fontUi = next.fontUi;
						d.fontCode = next.fontCode;
						d.uploadName = next.uploadName;
						d.supportsShape = next.supportsShape;
						d.revision = revision;
					}
				}
			});
		}
		//#endregion

		//#region styles
		const styles = {
			group: {
				borderBottom: "1px solid var(--dsw-alias-border-l2)",
				display: "flex",
				flexDirection: "column",
				gap: "10px",
				padding: "16px 0"
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
								children: presets.map((preset) => (0, jsx.jsx)("option", {
									value: preset.id === "system" ? "system" : "preset:" + preset.family,
									children: preset.label
								}, preset.id)).concat([
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
		function CornerStudioRow({ t, useStore, setEnabled, setRadius, setSmooth, setFontUi, setFontCode, uploadFont, removeUpload, resetAll }) {
			const on = useStore((s) => s.on);
			const radius = useStore((s) => s.radius);
			const smooth = useStore((s) => s.smooth);
			const fontUi = useStore((s) => s.fontUi);
			const fontCode = useStore((s) => s.fontCode);
			const uploadName = useStore((s) => s.uploadName);
			const supportsShape = useStore((s) => s.supportsShape);
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
					on ? (0, jsx.jsx)(FontSection, {
						slot: "ui",
						title: t("font.ui"),
						config: fontUi,
						hasUpload: hasUpload,
						uploadName: uploadName,
						presets: UI_PRESETS,
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
						presets: CODE_PRESETS,
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
			const store = createStore();
			let bound = null;
			let revision = 0;
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
				supportsShape: detectShapeSupport()
			};

			const sync = () => {
				if (disposed) return;
				revision += 1;
				if (bound !== null && typeof bound.sync === "function") bound.sync(prefs, revision);
			};

			const repaint = () => { applyOverrides(ctx, prefs); sync(); };

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
			sync();

			ctx.effect(() => () => {
				disposed = true;
				teardownOverrides();
				for (const entry of faces.values()) {
					try { document.fonts.delete(entry.face); } catch (error) { /* already gone */ }
				}
				faces.clear();
			}, "corner-studio: cleanup");

			ctx.effect(() => ctx.locale.register(SETTINGS_NS, { zh: zh, en: en }), "corner-studio: dictionaries");

			hydrateUpload();

			const injected = (actions) => {
				bound = actions;
				sync();
				return {
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
						prefs.fontUi = normalizeFontConfig(null);
						prefs.fontCode = normalizeFontConfig(null);
						writeStorage(KEY_ENABLED, "on");
						writeStorage(KEY_RADIUS, String(BASE_DEFAULT));
						writeStorage(KEY_SMOOTH, String(SMOOTH_DEFAULT));
						writeFontConfig(KEY_FONT_UI, prefs.fontUi);
						writeFontConfig(KEY_FONT_CODE, prefs.fontCode);
						repaint();
					}
				};
			};

			ctx.slots.inject("settings.general.item", () => ctx.slots.register({
				name: "settings.general.item",
				id: "corner-studio",
				order: 30,
				store: store,
				locale: SETTINGS_NS,
				inject: injected
			}, CornerStudioRow));
		}
		//#endregion

		exports.SETTINGS_NS = SETTINGS_NS;
		exports.OVERRIDE_SOURCE = OVERRIDE_SOURCE;
		exports.RADIUS_KEYS = RADIUS_KEYS;
		exports.RADIUS_DEFAULTS = RADIUS_DEFAULTS;
		exports.RADIUS_RATIO = RADIUS_RATIO;
		exports.BASE_DEFAULT = BASE_DEFAULT;
		exports.SMOOTH_DEFAULT = SMOOTH_DEFAULT;
		exports.UI_FALLBACK = UI_FALLBACK;
		exports.CODE_FALLBACK = CODE_FALLBACK;
		exports.UI_PRESETS = UI_PRESETS;
		exports.CODE_PRESETS = CODE_PRESETS;
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
