// Name: TurboWarp-Voice-Chat
// ID: kubohiroyavoicechat
// Description: Voice chat with an AI: OpenAI Realtime or browser speech, tools from blocks, and forced coffee breaks.
// By: Hiroya Kubo
// License: MPL-2.0

(function (Scratch) {
  'use strict';

  //#region src/config.ts
  var extensionConfig = {
  	id: "kubohiroyavoicechat",
  	slug: "turbowarp-voice-chat",
  	name: "TurboWarp-Voice-Chat",
  	description: "Voice chat with an AI: OpenAI Realtime or browser speech, tools from blocks, and forced coffee breaks.",
  	author: "Hiroya Kubo",
  	license: "MPL-2.0",
  	unsandboxed: true,
  	docsURI: "https://kubohiroya.github.io/turbowarp-voice-chat/",
  	blockIconURI: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI+PHBhdGggZD0iTTYgOGgyNGE0IDQgMCAwIDEgNCA0djEyYTQgNCAwIDAgMS00IDRIMTZsLTcgNnYtNkg2YTQgNCAwIDAgMS00LTRWMTJhNCA0IDAgMCAxIDQtNHoiIGZpbGw9IiMxMEEzN0YiLz48cGF0aCBkPSJNNDIgMThoLTR2MTBhNiA2IDAgMCAxLTYgNkgyMHYyYTQgNCAwIDAgMCA0IDRoMTBsNiA1di01aDJhNCA0IDAgMCAwIDQtNFYyMmE0IDQgMCAwIDAtNC00eiIgZmlsbD0iI0YyOUMzOCIvPjxwYXRoIGQ9Ik0xMSAxOGgxNE0xMSAyM2g5IiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIi8+PC9zdmc+"
  };
  //#endregion
  //#region node_modules/.pnpm/@kubohiroya+turbowarp-named-functions@0.1.0/node_modules/@kubohiroya/turbowarp-named-functions/dist/composition.js
  var FunctionDispatcher = class {
  	constructor(runtime, options) {
  		this.runtime = runtime;
  		this.options = options;
  		this.queue = [];
  		this.running = /* @__PURE__ */ new Map();
  		this.byThread = /* @__PURE__ */ new Map();
  		this.starting = null;
  		this.step = 0;
  		this.onAfterExecute = () => this.afterStep();
  		this.onStopAll = () => this.cancelAll("The project was stopped.");
  		this.timeoutMs = options.timeoutMs ?? 3e4;
  		this.setTimer = options.setTimer ?? ((callback, ms) => setTimeout(callback, ms));
  		this.clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle));
  		runtime.on("AFTER_EXECUTE", this.onAfterExecute);
  		runtime.on("PROJECT_STOP_ALL", this.onStopAll);
  	}
  	/**
  	* Starts a named function. `caller` is the thread of the block making the call, if any; it is used
  	* to detect reentrant calls.
  	*/
  	invoke(name, args, caller) {
  		if (!this.options.knownNames().has(name)) return Promise.reject(/* @__PURE__ */ new Error(`Unknown function: ${name}`));
  		const parentChain = caller ? this.byThread.get(caller)?.chain ?? [] : [];
  		if (parentChain.includes(name)) return Promise.reject(/* @__PURE__ */ new Error(`Reentrant call: ${[...parentChain, name].join(" -> ")}. Use a custom block for recursion.`));
  		return new Promise((resolve, reject) => {
  			const invocation = {
  				name,
  				args,
  				chain: [...parentChain, name],
  				resolve,
  				reject,
  				thread: null,
  				startedAtStep: -1,
  				timer: null,
  				settled: false
  			};
  			invocation.timer = this.setTimer(() => this.settle(invocation, /* @__PURE__ */ new Error(`Function ${name} timed out.`)), this.timeoutMs);
  			this.queue.push(invocation);
  			this.pump();
  		});
  	}
  	/** Hat predicate: true only for the script that should run the invocation being started. */
  	matchHat(name, thread) {
  		const invocation = this.starting;
  		if (!invocation || !thread || invocation.name !== name.trim()) return false;
  		invocation.thread = thread;
  		this.byThread.set(thread, invocation);
  		this.starting = null;
  		return true;
  	}
  	argumentsFor(thread) {
  		const invocation = thread ? this.byThread.get(thread) : void 0;
  		if (!invocation) throw new Error("This block can only be used inside a running function.");
  		return invocation.args;
  	}
  	returnFrom(thread, value) {
  		const invocation = thread ? this.byThread.get(thread) : void 0;
  		if (!invocation) throw new Error("return can only be used inside a running function.");
  		this.settle(invocation, null, value);
  	}
  	cancelAll(reason) {
  		for (const invocation of [...this.queue, ...this.running.values()]) this.settle(invocation, new Error(reason));
  		if (this.starting) this.settle(this.starting, new Error(reason));
  	}
  	get pendingCount() {
  		return this.queue.length + this.running.size;
  	}
  	release() {
  		this.cancelAll("Named functions were released.");
  		this.runtime.off?.("AFTER_EXECUTE", this.onAfterExecute);
  		this.runtime.off?.("PROJECT_STOP_ALL", this.onStopAll);
  	}
  	pump() {
  		if (this.starting) return;
  		const index = this.queue.findIndex((invocation) => !this.running.has(invocation.name));
  		if (index < 0) return;
  		const [invocation] = this.queue.splice(index, 1);
  		if (!invocation) return;
  		this.running.set(invocation.name, invocation);
  		this.starting = invocation;
  		invocation.startedAtStep = this.step;
  		this.runtime.startHats(this.options.hatOpcode);
  	}
  	afterStep() {
  		this.step += 1;
  		const starting = this.starting;
  		if (starting && this.step - starting.startedAtStep > 2) this.settle(starting, /* @__PURE__ */ new Error(`Function ${starting.name} did not start. Is its script already running?`));
  		for (const invocation of this.running.values()) if (invocation.thread && !this.runtime.threads.includes(invocation.thread)) this.settle(invocation, null, null);
  		this.pump();
  	}
  	settle(invocation, error, value) {
  		if (invocation.settled) return;
  		invocation.settled = true;
  		this.clearTimer(invocation.timer);
  		const queued = this.queue.indexOf(invocation);
  		if (queued >= 0) this.queue.splice(queued, 1);
  		if (this.running.get(invocation.name) === invocation) this.running.delete(invocation.name);
  		if (invocation.thread) this.byThread.delete(invocation.thread);
  		if (this.starting === invocation) this.starting = null;
  		if (error) invocation.reject(error);
  		else invocation.resolve(value);
  	}
  };
  /** Resolves a dotted path such as `items.0.name` inside parsed JSON arguments. */
  function readArgumentPath(args, path) {
  	const trimmed = path.trim();
  	if (trimmed.length === 0) return args;
  	let current = args;
  	for (const segment of trimmed.split(".")) {
  		if (current === null || typeof current !== "object") return void 0;
  		current = current[segment];
  	}
  	return current;
  }
  /** Converts a value for a Scratch reporter: objects and arrays become JSON text. */
  function toScratchValue(value) {
  	if (value === void 0 || value === null) return "";
  	if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  	return JSON.stringify(value);
  }
  /** Parses block text: JSON text becomes JSON, anything else stays a string. */
  function parseJsonOrText(text) {
  	const trimmed = text.trim();
  	if (trimmed.length === 0) return "";
  	try {
  		return JSON.parse(trimmed);
  	} catch {
  		return text;
  	}
  }
  var FUNCTION_NAME_PATTERN = /^[A-Za-z0-9_-]{1,64}$/u;
  var MAX_DESCRIPTION_LENGTH = 1024;
  /**
  * Reads every `define function` hat in the project. NAME, DESCRIPTION, and SCHEMA are part of the
  * tool contract sent to the model before any script runs, so they must be literal text.
  */
  function scanFunctionDefinitions(targets, hatOpcode) {
  	const functions = [];
  	const errors = [];
  	const seen = /* @__PURE__ */ new Map();
  	for (const target of targets) {
  		if (target.isOriginal === false) continue;
  		const targetName = target.getName?.() ?? (target.isStage ? "Stage" : "sprite");
  		const blocks = target.blocks._blocks;
  		for (const block of Object.values(blocks)) {
  			if (block.opcode !== hatOpcode || block.topLevel === false) continue;
  			const where = `${targetName} (block ${block.id})`;
  			try {
  				const definition = readDefinition(block, blocks, targetName);
  				const previous = seen.get(definition.name);
  				if (previous !== void 0) throw new Error(`function "${definition.name}" is already defined in ${previous}`);
  				seen.set(definition.name, where);
  				functions.push(definition);
  			} catch (error) {
  				errors.push(`${where}: ${error instanceof Error ? error.message : String(error)}`);
  			}
  		}
  	}
  	functions.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  	return {
  		functions,
  		errors
  	};
  }
  function toFunctionTools(functions) {
  	return functions.filter((definition) => definition.exportAs === "tool").map((definition) => ({
  		type: "function",
  		name: definition.name,
  		description: definition.description,
  		parameters: definition.parameters
  	}));
  }
  function readDefinition(block, blocks, targetName) {
  	const name = readLiteralInput(block, blocks, "NAME").trim();
  	if (!FUNCTION_NAME_PATTERN.test(name)) throw new Error("function name must be 1-64 letters, digits, \"_\" or \"-\"");
  	const description = readLiteralInput(block, blocks, "DESCRIPTION").trim();
  	if (description.length > 1024) throw new Error(`description must be at most ${MAX_DESCRIPTION_LENGTH} characters`);
  	const parameters = parseSchema(readLiteralInput(block, blocks, "SCHEMA"));
  	const exportAs = String(block.fields?.EXPORT?.value ?? "none") === "tool" ? "tool" : "none";
  	if (exportAs === "tool" && description.length === 0) throw new Error("a function exported as a tool needs a description");
  	return {
  		name,
  		description,
  		parameters,
  		exportAs,
  		targetName,
  		blockId: block.id
  	};
  }
  function readLiteralInput(block, blocks, inputName) {
  	const input = block.inputs?.[inputName];
  	if (!input) throw new Error(`${inputName} is missing`);
  	if (input.block && input.block !== input.shadow) throw new Error(`${inputName} must be literal text, not a reporter block`);
  	const shadowId = input.shadow ?? input.block;
  	const shadow = shadowId ? blocks[shadowId] : void 0;
  	const field = shadow?.fields ? Object.values(shadow.fields)[0] : void 0;
  	if (!field) throw new Error(`${inputName} is missing`);
  	return String(field.value ?? "");
  }
  function parseSchema(text) {
  	let value;
  	try {
  		value = JSON.parse(text);
  	} catch {
  		throw new Error("args schema must be valid JSON");
  	}
  	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("args schema must be a JSON object");
  	const schema = value;
  	if (schema.type !== "object") throw new Error("args schema must have \"type\": \"object\"");
  	return schema;
  }
  /**
  * A small JSON Schema validator for function arguments. It interprets the schema at run time and
  * never generates code, so it also works where `eval` is unavailable (for example Cloudflare Workers).
  *
  * Supported keywords: type, properties, required, additionalProperties (boolean), items, enum,
  * const, minimum, maximum, minLength, maxLength, minItems, maxItems. Other keywords, such as
  * description and title, are ignored.
  */
  function validateAgainstSchema(value, schema, path = "$") {
  	const rule = asRecord$2(schema);
  	if (!rule) return [];
  	const errors = [];
  	if (rule.type !== void 0) {
  		const types = Array.isArray(rule.type) ? rule.type : [rule.type];
  		if (!types.some((type) => matchesType(value, type))) return [`${path} must be ${types.join(" or ")}`];
  	}
  	if (Array.isArray(rule.enum) && !rule.enum.some((candidate) => deepEqual(candidate, value))) errors.push(`${path} must be one of ${rule.enum.map((item) => JSON.stringify(item)).join(", ")}`);
  	if ("const" in rule && !deepEqual(rule.const, value)) errors.push(`${path} must be ${JSON.stringify(rule.const)}`);
  	if (typeof value === "number") {
  		if (typeof rule.minimum === "number" && value < rule.minimum) errors.push(`${path} must be >= ${rule.minimum}`);
  		if (typeof rule.maximum === "number" && value > rule.maximum) errors.push(`${path} must be <= ${rule.maximum}`);
  	}
  	if (typeof value === "string") {
  		const length = [...value].length;
  		if (typeof rule.minLength === "number" && length < rule.minLength) errors.push(`${path} must have at least ${rule.minLength} characters`);
  		if (typeof rule.maxLength === "number" && length > rule.maxLength) errors.push(`${path} must have at most ${rule.maxLength} characters`);
  	}
  	if (Array.isArray(value)) {
  		if (typeof rule.minItems === "number" && value.length < rule.minItems) errors.push(`${path} must have at least ${rule.minItems} items`);
  		if (typeof rule.maxItems === "number" && value.length > rule.maxItems) errors.push(`${path} must have at most ${rule.maxItems} items`);
  		if (rule.items !== void 0) value.forEach((item, index) => errors.push(...validateAgainstSchema(item, rule.items, `${path}[${index}]`)));
  	}
  	const object = asRecord$2(value);
  	if (object) {
  		const properties = asRecord$2(rule.properties) ?? {};
  		if (Array.isArray(rule.required)) {
  			for (const name of rule.required) if (typeof name === "string" && !(name in object)) errors.push(`${path}.${name} is required`);
  		}
  		for (const [name, child] of Object.entries(object)) if (name in properties) errors.push(...validateAgainstSchema(child, properties[name], `${path}.${name}`));
  		else if (rule.additionalProperties === false) errors.push(`${path}.${name} is not allowed`);
  	}
  	return errors;
  }
  function matchesType(value, type) {
  	switch (type) {
  		case "object": return asRecord$2(value) !== null;
  		case "array": return Array.isArray(value);
  		case "string": return typeof value === "string";
  		case "number": return typeof value === "number" && Number.isFinite(value);
  		case "integer": return typeof value === "number" && Number.isInteger(value);
  		case "boolean": return typeof value === "boolean";
  		case "null": return value === null;
  		default: return false;
  	}
  }
  function deepEqual(left, right) {
  	return JSON.stringify(left) === JSON.stringify(right);
  }
  function asRecord$2(value) {
  	return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
  }
  /**
  * Composition API: named functions without TurboWarp block definitions.
  *
  * A consumer extension owns its `define function` hat (and its opcode) and forwards the hat
  * predicate and the argument/return blocks here. Importing this module does not register a
  * TurboWarp extension and does not touch the `Scratch` global.
  */
  function createNamedFunctions(options) {
  	return new NamedFunctionsImpl(options);
  }
  var NamedFunctionsImpl = class {
  	constructor(options) {
  		this.options = options;
  		this.promises = /* @__PURE__ */ new Map();
  		this.waiting = [];
  		this.inFlight = 0;
  		this.nextPromiseId = 1;
  		this.maxInFlight = Math.max(1, options.maxInFlight ?? 8);
  		this.maxRetained = Math.max(1, options.maxRetainedPromises ?? 256);
  		const dispatcherOptions = {
  			hatOpcode: options.functionHatOpcode,
  			knownNames: () => new Set(this.scan().functions.map((definition) => definition.name)),
  			...options.timeoutMs === void 0 ? {} : { timeoutMs: options.timeoutMs },
  			...options.setTimer ? { setTimer: options.setTimer } : {},
  			...options.clearTimer ? { clearTimer: options.clearTimer } : {}
  		};
  		this.dispatcher = new FunctionDispatcher(options.runtime, dispatcherOptions);
  		options.runtime.on("PROJECT_STOP_ALL", () => this.promises.clear());
  	}
  	scan() {
  		return scanFunctionDefinitions(this.options.runtime.targets, this.options.functionHatOpcode);
  	}
  	tools() {
  		const scan = this.scan();
  		if (scan.errors.length > 0) throw new Error(`Invalid function definitions: ${scan.errors.join("; ")}`);
  		return toFunctionTools(scan.functions);
  	}
  	isDefined(name) {
  		return this.scan().functions.some((definition) => definition.name === name.trim());
  	}
  	call(name, args, options = {}) {
  		const trimmed = name.trim();
  		const definition = this.scan().functions.find((candidate) => candidate.name === trimmed);
  		if (!definition) return Promise.reject(/* @__PURE__ */ new Error(`Unknown function: ${trimmed}`));
  		if (options.exportedOnly && definition.exportAs !== "tool") return Promise.reject(/* @__PURE__ */ new Error(`Function ${trimmed} is not exported as a tool.`));
  		const errors = validateAgainstSchema(args, definition.parameters);
  		if (errors.length > 0) return Promise.reject(/* @__PURE__ */ new Error(`Invalid arguments for ${trimmed}: ${errors.join("; ")}`));
  		return this.dispatcher.invoke(trimmed, args, options.caller);
  	}
  	start(name, args, options = {}) {
  		const id = `p_${this.nextPromiseId++}`;
  		const promise = this.acquireSlot().then(() => this.call(name, args, options).finally(() => this.releaseSlot()));
  		const entry = {
  			promise,
  			settled: false
  		};
  		promise.then(() => entry.settled = true, () => entry.settled = true);
  		this.promises.set(id, entry);
  		this.evictSettled();
  		return { $promise: id };
  	}
  	await(ref) {
  		const entry = this.lookup(ref);
  		return entry ? entry.promise : Promise.reject(/* @__PURE__ */ new Error("Unknown or expired promise reference."));
  	}
  	async awaitAll(refs) {
  		if (!Array.isArray(refs)) throw new Error("await all needs a JSON array of promise references.");
  		return (await Promise.allSettled(refs.map((ref) => this.await(ref)))).map((result) => result.status === "fulfilled" ? result.value : { $error: messageOf$2(result.reason) });
  	}
  	isSettled(ref) {
  		return this.lookup(ref)?.settled ?? false;
  	}
  	matchHat(name, thread) {
  		return this.dispatcher.matchHat(name, thread);
  	}
  	argumentsFor(thread) {
  		return this.dispatcher.argumentsFor(thread);
  	}
  	returnFrom(thread, value) {
  		this.dispatcher.returnFrom(thread, value);
  	}
  	cancelAll(reason) {
  		this.dispatcher.cancelAll(reason);
  	}
  	release() {
  		this.dispatcher.release();
  		this.promises.clear();
  	}
  	lookup(ref) {
  		const id = typeof ref === "object" && ref !== null && typeof ref.$promise === "string" ? ref.$promise : void 0;
  		return id ? this.promises.get(id) : void 0;
  	}
  	acquireSlot() {
  		if (this.inFlight < this.maxInFlight) {
  			this.inFlight += 1;
  			return Promise.resolve();
  		}
  		return new Promise((resolve) => this.waiting.push(() => {
  			this.inFlight += 1;
  			resolve();
  		}));
  	}
  	releaseSlot() {
  		this.inFlight -= 1;
  		this.waiting.shift()?.();
  	}
  	evictSettled() {
  		if (this.promises.size <= this.maxRetained) return;
  		for (const [id, entry] of this.promises) {
  			if (this.promises.size <= this.maxRetained) break;
  			if (entry.settled) this.promises.delete(id);
  		}
  	}
  };
  function messageOf$2(error) {
  	return error instanceof Error ? error.message : String(error);
  }
  var block_definitions_default = {
  	extensionName: "Voice Chat",
  	blocks: [
  		{
  			"opcode": "configureRelay",
  			"blockType": "COMMAND",
  			"text": "configure local relay [ENDPOINT]",
  			"description": "Sets the loopback origin of the local capability-proxy relay.",
  			"descriptionJa": "localhostで動くcapability-proxy中継のループバックoriginを設定します。",
  			"arguments": { "ENDPOINT": {
  				"type": "STRING",
  				"defaultValue": "http://127.0.0.1:8787"
  			} }
  		},
  		{
  			"opcode": "pairRelay",
  			"blockType": "COMMAND",
  			"text": "pair local relay with one-time code [CODE]",
  			"description": "Exchanges the eight-digit code printed by the relay for a token kept only in memory.",
  			"descriptionJa": "中継が表示した8桁のコードを、メモリだけに保持するtokenと交換します。",
  			"arguments": { "CODE": {
  				"type": "STRING",
  				"defaultValue": "00000000"
  			} }
  		},
  		{
  			"opcode": "isRelayPaired",
  			"blockType": "BOOLEAN",
  			"text": "local relay paired?",
  			"description": "Reports whether an unexpired relay token is held in memory.",
  			"descriptionJa": "有効期限内の中継のtokenを保持しているかを返します。",
  			"arguments": {}
  		},
  		{
  			"opcode": "setModel",
  			"blockType": "COMMAND",
  			"text": "set AI model to [MODEL]",
  			"description": "Chooses the model for the next conversation. mini is much cheaper.",
  			"descriptionJa": "次の会話で使うモデルを選びます。miniのほうがかなり安価です。",
  			"arguments": { "MODEL": {
  				"type": "STRING",
  				"defaultValue": "gpt-realtime-2.1-mini",
  				"menu": "models"
  			} }
  		},
  		{
  			"opcode": "setInstructions",
  			"blockType": "COMMAND",
  			"text": "set AI instructions to [TEXT]",
  			"description": "Sets the system instructions for the next conversation.",
  			"descriptionJa": "次の会話で使うシステムへの指示を設定します。",
  			"arguments": { "TEXT": {
  				"type": "STRING",
  				"defaultValue": "You are a friendly character in a game. Answer in one or two short sentences."
  			} }
  		},
  		{
  			"opcode": "setSpeechInput",
  			"blockType": "COMMAND",
  			"text": "hear my voice with [INPUT]",
  			"description": "realtime sends microphone audio to the model; browser recognizes speech in the browser and sends text (cheaper).",
  			"descriptionJa": "realtimeはマイクの音声をモデルに送ります。browserはブラウザで音声認識して文字列を送ります（安価）。",
  			"arguments": { "INPUT": {
  				"type": "STRING",
  				"defaultValue": "realtime",
  				"menu": "inputs"
  			} }
  		},
  		{
  			"opcode": "setSpeechOutput",
  			"blockType": "COMMAND",
  			"text": "speak replies with [OUTPUT]",
  			"description": "realtime plays the model's voice; browser reads the text with the browser's voice (cheaper); text does not speak.",
  			"descriptionJa": "realtimeはモデルの声で話します。browserは応答の文字列をブラウザの声で読み上げます（安価）。textは読み上げません。",
  			"arguments": { "OUTPUT": {
  				"type": "STRING",
  				"defaultValue": "realtime",
  				"menu": "outputs"
  			} }
  		},
  		{
  			"opcode": "setLanguage",
  			"blockType": "COMMAND",
  			"text": "set browser speech language to [LANG]",
  			"description": "Sets the language of browser speech recognition and speech output.",
  			"descriptionJa": "ブラウザの音声認識と読み上げの言語を設定します。",
  			"arguments": { "LANG": {
  				"type": "STRING",
  				"defaultValue": "ja-JP",
  				"menu": "languages"
  			} }
  		},
  		{
  			"opcode": "setRealtimeVoice",
  			"blockType": "COMMAND",
  			"text": "set AI voice to [VOICE]",
  			"description": "Sets the model's voice used with realtime speech output.",
  			"descriptionJa": "realtimeの音声出力で使うモデルの声を設定します。",
  			"arguments": { "VOICE": {
  				"type": "STRING",
  				"defaultValue": "marin",
  				"menu": "voices"
  			} }
  		},
  		{
  			"opcode": "setAllowInterruptions",
  			"blockType": "COMMAND",
  			"text": "allow interrupting the AI [ONOFF]",
  			"description": "With browser input and output, on lets you talk over a reply to stop it (use a headset). off pauses listening while the AI speaks.",
  			"descriptionJa": "ブラウザの音声入力と読み上げを使う場合、onにすると応答の読み上げ中に話しかけて止められます（ヘッドセット推奨）。offでは読み上げ中は聞き取りを止めます。",
  			"arguments": { "ONOFF": {
  				"type": "STRING",
  				"defaultValue": "off",
  				"menu": "onOff"
  			} }
  		},
  		{
  			"opcode": "setCoffeeBreak",
  			"blockType": "COMMAND",
  			"text": "force a coffee break every [TALK] minutes for [BREAK] minutes, then [AFTER]",
  			"description": "Ends the conversation after TALK minutes, waits BREAK minutes, then resumes with a fresh session or stops. TALK 0 turns forced breaks off.",
  			"descriptionJa": "TALK分ごとに会話を区切り、BREAK分休んだあと、新しいセッションで再開するか終了します。TALKを0にすると強制的な休憩をしません。",
  			"arguments": {
  				"TALK": {
  					"type": "NUMBER",
  					"defaultValue": "10"
  				},
  				"BREAK": {
  					"type": "NUMBER",
  					"defaultValue": "5"
  				},
  				"AFTER": {
  					"type": "STRING",
  					"defaultValue": "resume",
  					"menu": "afterBreak"
  				}
  			}
  		},
  		{
  			"opcode": "takeBreakNow",
  			"blockType": "COMMAND",
  			"text": "take a coffee break now",
  			"description": "Starts a coffee break immediately.",
  			"descriptionJa": "すぐに休憩を始めます。",
  			"arguments": {}
  		},
  		{
  			"opcode": "endBreakNow",
  			"blockType": "COMMAND",
  			"text": "end the coffee break now",
  			"description": "Ends the coffee break early.",
  			"descriptionJa": "休憩を早めに終えます。",
  			"arguments": {}
  		},
  		{
  			"opcode": "whenBreakStarts",
  			"blockType": "HAT",
  			"text": "when coffee break starts",
  			"description": "Starts when a coffee break begins.",
  			"descriptionJa": "休憩が始まったときに起動します。",
  			"arguments": {}
  		},
  		{
  			"opcode": "whenBreakEnds",
  			"blockType": "HAT",
  			"text": "when coffee break ends",
  			"description": "Starts when a coffee break ends.",
  			"descriptionJa": "休憩が終わったときに起動します。",
  			"arguments": {}
  		},
  		{
  			"opcode": "isOnBreak",
  			"blockType": "BOOLEAN",
  			"text": "on coffee break?",
  			"description": "Reports whether a coffee break is in progress.",
  			"descriptionJa": "休憩中かを返します。",
  			"arguments": {}
  		},
  		{
  			"opcode": "breakSecondsLeft",
  			"blockType": "REPORTER",
  			"text": "coffee break seconds left",
  			"description": "Reports the seconds left in the current coffee break.",
  			"descriptionJa": "今の休憩の残り秒数を返します。",
  			"arguments": {}
  		},
  		{
  			"opcode": "startConversation",
  			"blockType": "COMMAND",
  			"text": "start conversation",
  			"description": "Connects and starts listening with the current settings.",
  			"descriptionJa": "現在の設定で接続し、聞き取りを始めます。",
  			"arguments": {}
  		},
  		{
  			"opcode": "endConversation",
  			"blockType": "COMMAND",
  			"text": "end conversation",
  			"description": "Disconnects, stops listening and speaking, and cancels any coffee break.",
  			"descriptionJa": "切断し、聞き取りと読み上げを止め、休憩も取り消します。",
  			"arguments": {}
  		},
  		{
  			"opcode": "isActive",
  			"blockType": "BOOLEAN",
  			"text": "in conversation?",
  			"description": "Reports whether a conversation is running (including its coffee breaks).",
  			"descriptionJa": "会話中か（休憩中も含む）を返します。",
  			"arguments": {}
  		},
  		{
  			"opcode": "conversationStatus",
  			"blockType": "REPORTER",
  			"text": "conversation status",
  			"description": "Reports idle, connecting, listening, thinking, speaking, or break.",
  			"descriptionJa": "idle、connecting、listening、thinking、speaking、breakのいずれかを返します。",
  			"arguments": {}
  		},
  		{
  			"opcode": "sendText",
  			"blockType": "COMMAND",
  			"text": "say [TEXT] to the AI",
  			"description": "Sends typed text as if you had said it.",
  			"descriptionJa": "話しかけたのと同じように、文字列をAIに送ります。",
  			"arguments": { "TEXT": {
  				"type": "STRING",
  				"defaultValue": "Hello!"
  			} }
  		},
  		{
  			"opcode": "whenUserSays",
  			"blockType": "HAT",
  			"text": "when I say something",
  			"description": "Starts when browser speech recognition hears you (browser input only).",
  			"descriptionJa": "ブラウザの音声認識があなたの発話を聞き取ったときに起動します（browserの音声入力のときだけ）。",
  			"arguments": {}
  		},
  		{
  			"opcode": "userSaid",
  			"blockType": "REPORTER",
  			"text": "what I said",
  			"description": "Reports your most recent recognized utterance.",
  			"descriptionJa": "直近に認識されたあなたの発話を返します。",
  			"arguments": {}
  		},
  		{
  			"opcode": "whenAiReplies",
  			"blockType": "HAT",
  			"text": "when the AI replies",
  			"description": "Starts when a reply with text or a transcript arrives.",
  			"descriptionJa": "応答（文字列または音声の書き起こし）が届いたときに起動します。",
  			"arguments": {}
  		},
  		{
  			"opcode": "aiReply",
  			"blockType": "REPORTER",
  			"text": "AI reply",
  			"description": "Reports the most recent reply text or transcript.",
  			"descriptionJa": "直近の応答の文字列、または音声の書き起こしを返します。",
  			"arguments": {}
  		},
  		{
  			"opcode": "defineFunction",
  			"blockType": "HAT",
  			"text": "define function [NAME] description [DESCRIPTION] args schema [SCHEMA] export as [EXPORT]",
  			"description": "Defines a function. With export as tool, the AI can call it. NAME, DESCRIPTION, and SCHEMA must be literal text.",
  			"descriptionJa": "関数を定義します。export asをtoolにすると、AIから呼べるようになります。NAME、DESCRIPTION、SCHEMAには文字列を直接書く必要があります。",
  			"arguments": {
  				"NAME": {
  					"type": "STRING",
  					"defaultValue": "get_score"
  				},
  				"DESCRIPTION": {
  					"type": "STRING",
  					"defaultValue": "Returns the player's current score."
  				},
  				"SCHEMA": {
  					"type": "STRING",
  					"defaultValue": "{\"type\":\"object\",\"properties\":{}}"
  				},
  				"EXPORT": {
  					"type": "STRING",
  					"defaultValue": "tool",
  					"menu": "exportModes"
  				}
  			}
  		},
  		{
  			"opcode": "functionArgument",
  			"blockType": "REPORTER",
  			"text": "function argument [PATH]",
  			"description": "Inside a function, reports the argument at a dotted path.",
  			"descriptionJa": "関数の中で、ドット区切りのパスにある引数を返します。",
  			"arguments": { "PATH": {
  				"type": "STRING",
  				"defaultValue": "city"
  			} }
  		},
  		{
  			"opcode": "functionArgumentsJson",
  			"blockType": "REPORTER",
  			"text": "function arguments JSON",
  			"description": "Inside a function, reports all arguments as JSON text.",
  			"descriptionJa": "関数の中で、すべての引数をJSONテキストとして返します。",
  			"arguments": {}
  		},
  		{
  			"opcode": "returnValue",
  			"blockType": "COMMAND",
  			"text": "return [VALUE]",
  			"description": "Inside a function, returns a value and ends the script.",
  			"descriptionJa": "関数の中で値を返し、スクリプトを終了します。",
  			"arguments": { "VALUE": {
  				"type": "STRING",
  				"defaultValue": "{\"score\":10}"
  			} }
  		},
  		{
  			"opcode": "usageValue",
  			"blockType": "REPORTER",
  			"text": "AI usage [FIELD]",
  			"description": "Reports usage totals since the last reset. costUSD is an estimate; the OpenAI dashboard is authoritative.",
  			"descriptionJa": "最後にリセットしてからの使用量を返します。costUSDは概算で、正確な請求額はOpenAIの管理画面で確認してください。",
  			"arguments": { "FIELD": {
  				"type": "STRING",
  				"defaultValue": "costUSD",
  				"menu": "usageFields"
  			} }
  		},
  		{
  			"opcode": "resetUsage",
  			"blockType": "COMMAND",
  			"text": "reset AI usage",
  			"description": "Clears the usage totals.",
  			"descriptionJa": "使用量の合計を0に戻します。",
  			"arguments": {}
  		},
  		{
  			"opcode": "lastError",
  			"blockType": "REPORTER",
  			"text": "last voice chat error",
  			"description": "Reports the most recent error, or an empty string.",
  			"descriptionJa": "直近のエラーを返します。エラーがなければ空文字列を返します。",
  			"arguments": {}
  		}
  	],
  	menus: {
  		"models": {
  			"acceptReporters": true,
  			"items": ["gpt-realtime-2.1-mini", "gpt-realtime-2.1"]
  		},
  		"inputs": {
  			"acceptReporters": false,
  			"items": ["realtime", "browser"]
  		},
  		"outputs": {
  			"acceptReporters": false,
  			"items": [
  				"realtime",
  				"browser",
  				"text"
  			]
  		},
  		"languages": {
  			"acceptReporters": true,
  			"items": [
  				"ja-JP",
  				"en-US",
  				"en-GB",
  				"zh-CN",
  				"ko-KR",
  				"fr-FR",
  				"de-DE",
  				"es-ES"
  			]
  		},
  		"voices": {
  			"acceptReporters": true,
  			"items": [
  				"alloy",
  				"ash",
  				"ballad",
  				"cedar",
  				"coral",
  				"echo",
  				"marin",
  				"sage",
  				"shimmer",
  				"verse"
  			]
  		},
  		"onOff": {
  			"acceptReporters": false,
  			"items": ["off", "on"]
  		},
  		"afterBreak": {
  			"acceptReporters": false,
  			"items": ["resume", "stop"]
  		},
  		"exportModes": {
  			"acceptReporters": false,
  			"items": ["tool", "none"]
  		},
  		"usageFields": {
  			"acceptReporters": false,
  			"items": [
  				"costUSD",
  				"responses",
  				"inputTokens",
  				"outputTokens",
  				"cachedInputTokens",
  				"textInputTokens",
  				"audioInputTokens",
  				"textOutputTokens",
  				"audioOutputTokens"
  			]
  		}
  	}
  };
  //#endregion
  //#region node_modules/.pnpm/@kubohiroya+turbowarp-openai-realtime-api@0.1.0/node_modules/@kubohiroya/turbowarp-openai-realtime-api/dist/composition.js
  /**
  * Conversation logic over a transport: sending user text, collecting assistant output, and
  * answering function calls with `function_call_output` followed by one `response.create`.
  */
  var RealtimeSession = class {
  	constructor(hooks) {
  		this.hooks = hooks;
  		this.stateValue = "disconnected";
  		this.transport = null;
  		this.generation = 0;
  	}
  	get state() {
  		return this.stateValue;
  	}
  	async open(transport, clientSecret, microphone) {
  		this.close();
  		const generation = ++this.generation;
  		this.transport = transport;
  		this.setState("connecting");
  		try {
  			await transport.connect({
  				clientSecret,
  				microphone,
  				onEvent: (event) => {
  					if (generation === this.generation) this.handleEvent(event);
  				},
  				onClose: (reason) => {
  					if (generation !== this.generation) return;
  					this.transport = null;
  					this.hooks.onError(reason);
  					this.setState("failed");
  				}
  			});
  		} catch (error) {
  			if (generation === this.generation) {
  				this.transport = null;
  				this.setState("failed");
  			}
  			throw error;
  		}
  		if (generation === this.generation) this.setState("connected");
  	}
  	close() {
  		this.generation += 1;
  		const transport = this.transport;
  		this.transport = null;
  		transport?.close();
  		if (this.stateValue !== "disconnected") this.setState("disconnected");
  	}
  	sendText(text) {
  		this.send({
  			type: "conversation.item.create",
  			item: {
  				type: "message",
  				role: "user",
  				content: [{
  					type: "input_text",
  					text
  				}]
  			}
  		});
  		this.send({ type: "response.create" });
  	}
  	send(event) {
  		if (!this.transport || this.stateValue !== "connected") throw new Error("Not connected to Realtime.");
  		this.transport.send(event);
  	}
  	async handleEvent(event) {
  		if (event.type === "error") {
  			this.hooks.onError(describeApiError(event));
  			return;
  		}
  		if (event.type !== "response.done") return;
  		const response = event.response;
  		if (typeof response === "object" && response !== null && "usage" in response) this.hooks.onUsage?.(response.usage);
  		const output = readResponseOutput(event);
  		if (output.text.length > 0) this.hooks.onResponseText(output.text);
  		if (output.calls.length === 0) return;
  		const generation = this.generation;
  		const results = await Promise.all(output.calls.map((call) => this.runCall(call)));
  		if (generation !== this.generation || !this.transport) return;
  		for (const result of results) this.transport.send({
  			type: "conversation.item.create",
  			item: {
  				type: "function_call_output",
  				call_id: result.callId,
  				output: result.output
  			}
  		});
  		this.transport.send({ type: "response.create" });
  	}
  	async runCall(call) {
  		let args;
  		try {
  			args = call.argumentsJson.trim().length === 0 ? {} : JSON.parse(call.argumentsJson);
  		} catch {
  			return {
  				callId: call.callId,
  				output: JSON.stringify({ error: "Arguments were not valid JSON." })
  			};
  		}
  		try {
  			const value = await this.hooks.callFunction(call.name, args);
  			return {
  				callId: call.callId,
  				output: JSON.stringify(value ?? null)
  			};
  		} catch (error) {
  			const message = error instanceof Error ? error.message : String(error);
  			this.hooks.onError(message);
  			return {
  				callId: call.callId,
  				output: JSON.stringify({ error: message })
  			};
  		}
  	}
  	setState(state) {
  		this.stateValue = state;
  		this.hooks.onStateChange?.(state);
  	}
  };
  function readResponseOutput(event) {
  	const response = asRecord$1(event.response);
  	const items = Array.isArray(response?.output) ? response.output : [];
  	const texts = [];
  	const calls = [];
  	for (const rawItem of items) {
  		const item = asRecord$1(rawItem);
  		if (!item) continue;
  		if (item.type === "function_call" && typeof item.name === "string" && typeof item.call_id === "string") calls.push({
  			callId: item.call_id,
  			name: item.name,
  			argumentsJson: typeof item.arguments === "string" ? item.arguments : ""
  		});
  		else if (item.type === "message" && Array.isArray(item.content)) for (const rawPart of item.content) {
  			const part = asRecord$1(rawPart);
  			if (typeof part?.text === "string") texts.push(part.text);
  			else if (typeof part?.transcript === "string") texts.push(part.transcript);
  		}
  	}
  	return {
  		text: texts.join(""),
  		calls
  	};
  }
  function describeApiError(event) {
  	const error = asRecord$1(event.error);
  	return `${typeof error?.message === "string" ? error.message : "Unknown Realtime API error."}${typeof error?.code === "string" ? ` (${error.code})` : ""}`;
  }
  function asRecord$1(value) {
  	return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
  }
  var LOOPBACK_HOSTNAMES = /* @__PURE__ */ new Set([
  	"127.0.0.1",
  	"localhost",
  	"[::1]"
  ]);
  var TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,}$/u;
  var CLIENT_SECRET_PATTERN = /^ek_[A-Za-z0-9_-]+$/u;
  /** Accepts only a plain loopback HTTP origin so the relay token can never leave this machine. */
  function normalizeRelayEndpoint(endpoint) {
  	let url;
  	try {
  		url = new URL(endpoint.trim());
  	} catch {
  		throw new TypeError("Relay endpoint must be a valid URL.");
  	}
  	if (url.protocol !== "http:" || !LOOPBACK_HOSTNAMES.has(url.hostname)) throw new TypeError("Relay endpoint must use HTTP on a loopback hostname.");
  	if (url.username.length > 0 || url.password.length > 0 || url.search.length > 0 || url.hash.length > 0 || url.pathname !== "/" && url.pathname !== "") throw new TypeError("Relay endpoint must contain only its loopback origin.");
  	return url.origin;
  }
  async function pairWithRelay(endpoint, code, fetcher = fetch, now = Date.now) {
  	const origin = normalizeRelayEndpoint(endpoint);
  	const trimmed = code.trim();
  	if (!/^\d{8}$/u.test(trimmed)) throw new TypeError("Relay pairing code must contain exactly eight digits.");
  	const record = requireRecord(await requestJson(fetcher, `${origin}/v1/pair`, {
  		method: "POST",
  		headers: { "content-type": "application/json" },
  		body: JSON.stringify({ code: trimmed }),
  		redirect: "error"
  	}), "Relay returned an invalid pairing response.");
  	const token = String(record.token ?? "");
  	if (!TOKEN_PATTERN.test(token)) throw new Error("Relay returned an invalid pairing token.");
  	if (typeof record.expiresAt !== "number" || !Number.isFinite(record.expiresAt) || record.expiresAt <= now()) throw new Error("Relay returned an invalid session expiration.");
  	return {
  		endpoint: origin,
  		token,
  		expiresAt: record.expiresAt
  	};
  }
  async function requestClientSecret(session, request, fetcher = fetch, now = Date.now) {
  	if (session.expiresAt <= now()) throw new Error("Relay session has expired. Pair with the local relay again.");
  	const data = requireRecord(requireRecord(await requestJson(fetcher, `${session.endpoint}/v1/openai/realtime/client-secrets`, {
  		method: "POST",
  		headers: {
  			"content-type": "application/json",
  			authorization: `Bearer ${session.token}`
  		},
  		body: JSON.stringify({ session: request }),
  		redirect: "error"
  	}), "Relay returned an invalid client secret response.").data, "Relay returned an invalid client secret response.");
  	const value = String(data.value ?? "");
  	if (!CLIENT_SECRET_PATTERN.test(value)) throw new Error("Relay returned an invalid client secret.");
  	if (typeof data.expiresAt !== "number" || !Number.isFinite(data.expiresAt) || data.expiresAt <= now()) throw new Error("Relay returned an expired client secret.");
  	return {
  		value,
  		expiresAt: data.expiresAt,
  		model: String(data.model ?? "")
  	};
  }
  async function requestJson(fetcher, url, init) {
  	const response = await fetcher(url, init);
  	const text = await response.text();
  	let result = null;
  	if (text.length > 0) try {
  		result = JSON.parse(text);
  	} catch {
  		throw new Error(`Relay returned a non-JSON response (${response.status}).`);
  	}
  	if (!response.ok) throw new Error(`Relay request failed (${response.status}): ${errorDetail(result)}`);
  	return result;
  }
  function requireRecord(value, message) {
  	if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(message);
  	return value;
  }
  function errorDetail(value) {
  	if (typeof value === "object" && value !== null) {
  		const error = value.error;
  		if (typeof error === "object" && error !== null) {
  			const message = error.message;
  			if (typeof message === "string") return message;
  		}
  	}
  	return "unknown error";
  }
  var MAX_INSTRUCTIONS_LENGTH = 16384;
  var VOICE_PATTERN = /^[a-z0-9_-]{1,32}$/u;
  var MODEL_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/u;
  function defaultSessionSettings() {
  	return {
  		model: "",
  		instructions: "",
  		voice: "marin",
  		outputMode: "audio"
  	};
  }
  /** Accepts an empty string (relay default) or a model identifier; the relay decides what is allowed. */
  function normalizeModel(value) {
  	const model = value.trim();
  	if (model.length > 0 && !MODEL_PATTERN.test(model)) throw new TypeError("Model must be a model identifier.");
  	return model;
  }
  function normalizeVoice(value) {
  	const voice = value.trim().toLowerCase();
  	if (!VOICE_PATTERN.test(voice)) throw new TypeError("Voice must be a lowercase identifier.");
  	return voice;
  }
  function normalizeInstructions(value) {
  	if (value.length > 16384) throw new TypeError(`Instructions must be at most ${MAX_INSTRUCTIONS_LENGTH} characters.`);
  	return value;
  }
  function normalizeOutputMode(value) {
  	if (value === "audio" || value === "text") return value;
  	throw new TypeError("Output must be audio or text.");
  }
  function buildSessionRequest(settings, tools) {
  	if (tools.length > 32) throw new TypeError(`At most 32 functions can be exported as tools.`);
  	const request = {
  		voice: settings.voice,
  		outputModalities: [settings.outputMode]
  	};
  	if (settings.model.length > 0) request.model = settings.model;
  	if (settings.instructions.length > 0) request.instructions = settings.instructions;
  	if (tools.length > 0) request.tools = tools.map((tool) => ({ ...tool }));
  	return request;
  }
  var MODEL_PRICES = {
  	"gpt-realtime-2.1": {
  		textInput: 4,
  		cachedTextInput: .4,
  		textOutput: 24,
  		audioInput: 32,
  		cachedAudioInput: .4,
  		audioOutput: 64
  	},
  	"gpt-realtime-2.1-mini": {
  		textInput: .6,
  		cachedTextInput: .06,
  		textOutput: 2.4,
  		audioInput: 10,
  		cachedAudioInput: .3,
  		audioOutput: 20
  	}
  };
  function emptyUsage() {
  	return {
  		responses: 0,
  		inputTokens: 0,
  		outputTokens: 0,
  		cachedInputTokens: 0,
  		textInputTokens: 0,
  		audioInputTokens: 0,
  		cachedTextInputTokens: 0,
  		cachedAudioInputTokens: 0,
  		textOutputTokens: 0,
  		audioOutputTokens: 0,
  		estimatedCostUsd: 0,
  		unpricedResponses: 0
  	};
  }
  /** Adds one `response.usage` object to the totals. Unknown or malformed usage counts as zero tokens. */
  function addUsage(totals, usage, model) {
  	const root = asRecord(usage);
  	if (!root) return totals;
  	const input = asRecord(root.input_token_details);
  	const output = asRecord(root.output_token_details);
  	const cachedDetails = asRecord(input?.cached_tokens_details);
  	const textInput = count(input?.text_tokens);
  	const audioInput = count(input?.audio_tokens);
  	const cached = count(input?.cached_tokens);
  	const cachedText = cachedDetails ? count(cachedDetails.text_tokens) : Math.min(cached, textInput);
  	const cachedAudio = cachedDetails ? count(cachedDetails.audio_tokens) : Math.max(0, cached - cachedText);
  	const textOutput = count(output?.text_tokens);
  	const audioOutput = count(output?.audio_tokens);
  	const next = {
  		responses: totals.responses + 1,
  		inputTokens: totals.inputTokens + count(root.input_tokens),
  		outputTokens: totals.outputTokens + count(root.output_tokens),
  		cachedInputTokens: totals.cachedInputTokens + cached,
  		textInputTokens: totals.textInputTokens + textInput,
  		audioInputTokens: totals.audioInputTokens + audioInput,
  		cachedTextInputTokens: totals.cachedTextInputTokens + cachedText,
  		cachedAudioInputTokens: totals.cachedAudioInputTokens + cachedAudio,
  		textOutputTokens: totals.textOutputTokens + textOutput,
  		audioOutputTokens: totals.audioOutputTokens + audioOutput,
  		estimatedCostUsd: totals.estimatedCostUsd,
  		unpricedResponses: totals.unpricedResponses
  	};
  	const price = MODEL_PRICES[model];
  	if (!price) {
  		next.unpricedResponses += 1;
  		return next;
  	}
  	next.estimatedCostUsd += (Math.max(0, textInput - cachedText) * price.textInput + cachedText * price.cachedTextInput + Math.max(0, audioInput - cachedAudio) * price.audioInput + cachedAudio * price.cachedAudioInput + textOutput * price.textOutput + audioOutput * price.audioOutput) / 1e6;
  	return next;
  }
  function count(value) {
  	return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }
  function asRecord(value) {
  	return typeof value === "object" && value !== null && !Array.isArray(value) ? value : null;
  }
  var REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";
  var EVENTS_CHANNEL = "oai-events";
  function browserWebRtcDependencies() {
  	return {
  		createPeerConnection: () => new RTCPeerConnection(),
  		getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
  		createAudioElement: () => {
  			const element = document.createElement("audio");
  			element.autoplay = true;
  			return element;
  		},
  		fetch: (input, init) => fetch(input, init)
  	};
  }
  /** Browser-to-OpenAI WebRTC session authenticated with an ephemeral client secret. */
  var WebRtcTransport = class {
  	constructor(deps = browserWebRtcDependencies()) {
  		this.deps = deps;
  		this.peer = null;
  		this.channel = null;
  		this.microphone = null;
  		this.audio = null;
  		this.closed = false;
  	}
  	async connect(options) {
  		this.closed = false;
  		try {
  			const peer = this.deps.createPeerConnection();
  			this.peer = peer;
  			const audio = this.deps.createAudioElement();
  			this.audio = audio;
  			peer.ontrack = (event) => {
  				audio.srcObject = event.streams[0] ?? null;
  			};
  			if (options.microphone) {
  				const stream = await this.deps.getUserMedia({ audio: true });
  				this.microphone = stream;
  				for (const track of stream.getAudioTracks()) peer.addTrack(track, stream);
  			} else peer.addTransceiver("audio", { direction: "recvonly" });
  			const channel = peer.createDataChannel(EVENTS_CHANNEL);
  			this.channel = channel;
  			channel.onmessage = (message) => {
  				const event = parseEvent(message.data);
  				if (event) options.onEvent(event);
  			};
  			channel.onclose = () => this.handleClose(options, "The Realtime data channel closed.");
  			peer.onconnectionstatechange = () => {
  				if (peer.connectionState === "failed" || peer.connectionState === "closed") this.handleClose(options, `The Realtime connection ${peer.connectionState}.`);
  			};
  			const opened = waitForOpen(channel, this.deps.channelOpenTimeoutMs ?? 15e3);
  			opened.catch(() => void 0);
  			const offer = await peer.createOffer();
  			await peer.setLocalDescription(offer);
  			const response = await this.deps.fetch(REALTIME_CALLS_URL, {
  				method: "POST",
  				body: offer.sdp ?? "",
  				headers: {
  					authorization: `Bearer ${options.clientSecret}`,
  					"content-type": "application/sdp"
  				},
  				redirect: "error"
  			});
  			const answer = await response.text();
  			if (!response.ok) throw new Error(`Realtime call setup failed (${response.status}).`);
  			await peer.setRemoteDescription({
  				type: "answer",
  				sdp: answer
  			});
  			await opened;
  		} catch (error) {
  			this.close();
  			throw error;
  		}
  	}
  	send(event) {
  		if (!this.channel || this.channel.readyState !== "open") throw new Error("Not connected to Realtime.");
  		this.channel.send(JSON.stringify(event));
  	}
  	close() {
  		this.closed = true;
  		const channel = this.channel;
  		const peer = this.peer;
  		this.channel = null;
  		this.peer = null;
  		if (channel) {
  			channel.onmessage = null;
  			channel.onclose = null;
  			channel.close();
  		}
  		if (peer) {
  			peer.onconnectionstatechange = null;
  			peer.ontrack = null;
  			peer.close();
  		}
  		for (const track of this.microphone?.getTracks() ?? []) track.stop();
  		this.microphone = null;
  		if (this.audio) {
  			this.audio.srcObject = null;
  			this.audio = null;
  		}
  	}
  	handleClose(options, reason) {
  		if (this.closed) return;
  		this.close();
  		options.onClose(reason);
  	}
  };
  function parseEvent(data) {
  	if (typeof data !== "string") return null;
  	try {
  		const value = JSON.parse(data);
  		if (typeof value === "object" && value !== null && typeof value.type === "string") return value;
  	} catch {}
  	return null;
  }
  function waitForOpen(channel, timeoutMs) {
  	if (channel.readyState === "open") return Promise.resolve();
  	return new Promise((resolve, reject) => {
  		const timer = setTimeout(() => reject(/* @__PURE__ */ new Error("Timed out opening the Realtime data channel.")), timeoutMs);
  		channel.addEventListener("open", () => {
  			clearTimeout(timer);
  			resolve();
  		}, { once: true });
  	});
  }
  /**
  * Composition API: the OpenAI Realtime capability without TurboWarp block definitions.
  *
  * A downstream extension (for example `@kubohiroya/turbowarp-voice-chat`) owns its own blocks and
  * hats, and passes its own `define function` hat opcode. Importing this module does not register
  * any TurboWarp extension and does not touch the `Scratch` global.
  */
  var DEFAULT_RELAY_ENDPOINT = "http://127.0.0.1:8787";
  function createRealtimeComposition(options) {
  	return new Composition(options);
  }
  var Composition = class {
  	constructor(options) {
  		this.options = options;
  		this.relayEndpoint = DEFAULT_RELAY_ENDPOINT;
  		this.relaySession = null;
  		this.settingsValue = defaultSessionSettings();
  		this.timeLimitSeconds = 0;
  		this.connectedAt = null;
  		this.timeLimitTimer = null;
  		this.activeModelValue = "";
  		this.lastResponse = "";
  		this.usageTotals = emptyUsage();
  		this.listeners = /* @__PURE__ */ new Set();
  		this.fetcher = options.fetch ?? ((input, init) => fetch(input, init));
  		this.createTransport = options.createTransport ?? (() => new WebRtcTransport());
  		this.now = options.now ?? Date.now;
  		this.setTimer = options.setTimer ?? ((callback, ms) => setTimeout(callback, ms));
  		this.clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle));
  		this.ownsFunctions = options.functions === void 0;
  		this.namedFunctions = options.functions ?? createNamedFunctions({
  			runtime: options.runtime,
  			functionHatOpcode: options.functionHatOpcode
  		});
  		this.session = new RealtimeSession({
  			callFunction: (name, args) => this.namedFunctions.call(name, args, { exportedOnly: true }),
  			onResponseText: (text) => {
  				this.lastResponse = text;
  				this.emit({
  					type: "response",
  					text
  				});
  			},
  			onError: (message) => this.emit({
  				type: "error",
  				message
  			}),
  			onStateChange: (state) => this.handleState(state),
  			onUsage: (usage) => {
  				this.usageTotals = addUsage(this.usageTotals, usage, this.activeModelValue);
  				this.emit({
  					type: "usage",
  					usage: this.usage()
  				});
  			}
  		});
  	}
  	configureRelay(endpoint) {
  		this.relayEndpoint = normalizeRelayEndpoint(endpoint);
  		this.relaySession = null;
  	}
  	async pairRelay(code) {
  		this.relaySession = await pairWithRelay(this.relayEndpoint, code, this.fetcher, this.now);
  	}
  	isRelayPaired() {
  		return this.relaySession !== null && this.relaySession.expiresAt > this.now();
  	}
  	setModel(model) {
  		this.settingsValue = {
  			...this.settingsValue,
  			model: normalizeModel(model)
  		};
  	}
  	setInstructions(text) {
  		this.settingsValue = {
  			...this.settingsValue,
  			instructions: normalizeInstructions(text)
  		};
  	}
  	setVoice(voice) {
  		this.settingsValue = {
  			...this.settingsValue,
  			voice: normalizeVoice(voice)
  		};
  	}
  	setOutputMode(mode) {
  		this.settingsValue = {
  			...this.settingsValue,
  			outputMode: normalizeOutputMode(mode)
  		};
  	}
  	setSessionTimeLimit(seconds) {
  		if (!Number.isFinite(seconds) || seconds < 0) throw new TypeError("Session time limit must be zero or a positive number of seconds.");
  		this.timeLimitSeconds = seconds;
  	}
  	get settings() {
  		return { ...this.settingsValue };
  	}
  	get sessionTimeLimitSeconds() {
  		return this.timeLimitSeconds;
  	}
  	scanFunctions() {
  		return this.namedFunctions.scan();
  	}
  	get functions() {
  		return this.namedFunctions;
  	}
  	async connect(options) {
  		if (!this.relaySession || !this.isRelayPaired()) throw new Error("Pair with the local relay first.");
  		const request = buildSessionRequest(this.settingsValue, this.namedFunctions.tools());
  		const secret = await requestClientSecret(this.relaySession, request, this.fetcher, this.now);
  		this.activeModelValue = secret.model || this.settingsValue.model;
  		await this.session.open(this.createTransport(), secret.value, options.microphone);
  	}
  	disconnect() {
  		this.session.close();
  	}
  	get state() {
  		return this.session.state;
  	}
  	get activeModel() {
  		return this.activeModelValue;
  	}
  	sessionElapsedSeconds() {
  		return this.connectedAt === null ? 0 : Math.max(0, (this.now() - this.connectedAt) / 1e3);
  	}
  	sendText(text) {
  		this.session.sendText(text);
  	}
  	get lastResponseText() {
  		return this.lastResponse;
  	}
  	matchFunctionHat(name, thread) {
  		return this.namedFunctions.matchHat(name, thread);
  	}
  	functionArguments(thread) {
  		return this.namedFunctions.argumentsFor(thread);
  	}
  	returnFromFunction(thread, value) {
  		this.namedFunctions.returnFrom(thread, value);
  	}
  	usage() {
  		return { ...this.usageTotals };
  	}
  	resetUsage() {
  		this.usageTotals = emptyUsage();
  		this.emit({
  			type: "usage",
  			usage: this.usage()
  		});
  	}
  	subscribe(listener) {
  		this.listeners.add(listener);
  		return () => this.listeners.delete(listener);
  	}
  	release() {
  		this.disconnect();
  		this.listeners.clear();
  		if (this.ownsFunctions) this.namedFunctions.release();
  	}
  	handleState(state) {
  		if (state === "connected") {
  			this.connectedAt = this.now();
  			if (this.timeLimitSeconds > 0) this.timeLimitTimer = this.setTimer(() => this.reachTimeLimit(), this.timeLimitSeconds * 1e3);
  		} else if (state !== "connecting") {
  			this.connectedAt = null;
  			this.cancelTimeLimit();
  			this.namedFunctions.cancelAll("The Realtime session ended.");
  		}
  		this.emit({
  			type: "state",
  			state
  		});
  	}
  	reachTimeLimit() {
  		this.timeLimitTimer = null;
  		if (this.session.state !== "connected") return;
  		this.session.close();
  		this.emit({ type: "sessionTimeLimitReached" });
  	}
  	cancelTimeLimit() {
  		if (this.timeLimitTimer !== null) this.clearTimer(this.timeLimitTimer);
  		this.timeLimitTimer = null;
  	}
  	emit(event) {
  		for (const listener of [...this.listeners]) listener(event);
  	}
  };
  //#endregion
  //#region node_modules/.pnpm/@kubohiroya+turbowarp-web-speech@0.1.0/node_modules/@kubohiroya/turbowarp-web-speech/dist/composition.js
  /** Errors after which restarting in continuous mode would only loop. */
  var FATAL_ERRORS = /* @__PURE__ */ new Set([
  	"not-allowed",
  	"service-not-allowed",
  	"audio-capture",
  	"network",
  	"language-not-supported"
  ]);
  /**
  * Wraps SpeechRecognition. In continuous mode the browser still ends the session after silence, so
  * the controller restarts it until `stop()` is called or a fatal error occurs.
  */
  var RecognitionController = class {
  	constructor(environment, emit) {
  		this.environment = environment;
  		this.emit = emit;
  		this.recognition = null;
  		this.wanted = false;
  		this.active = false;
  		this.options = {
  			lang: "ja-JP",
  			mode: "once",
  			interimResults: true
  		};
  	}
  	isSupported() {
  		return this.environment.createRecognition() !== null;
  	}
  	get listening() {
  		return this.active;
  	}
  	start(options) {
  		this.stop();
  		const recognition = this.environment.createRecognition();
  		if (!recognition) throw new Error("Speech recognition is not supported in this browser.");
  		this.options = options;
  		this.recognition = recognition;
  		this.wanted = true;
  		recognition.lang = options.lang;
  		recognition.continuous = options.mode === "continuous";
  		recognition.interimResults = options.interimResults;
  		recognition.maxAlternatives = 1;
  		recognition.onstart = () => this.setActive(recognition, true);
  		recognition.onspeechstart = () => {
  			if (this.recognition === recognition) this.emit({ type: "speechStart" });
  		};
  		recognition.onresult = (event) => {
  			if (this.recognition === recognition) this.handleResult(event);
  		};
  		recognition.onerror = (event) => {
  			if (this.recognition !== recognition) return;
  			if (FATAL_ERRORS.has(event.error)) this.wanted = false;
  			this.emit({
  				type: "error",
  				error: event.error,
  				message: describeError(event.error, event.message)
  			});
  		};
  		recognition.onend = () => {
  			if (this.recognition !== recognition) return;
  			if (this.wanted && this.options.mode === "continuous") try {
  				recognition.start();
  				return;
  			} catch {}
  			this.wanted = false;
  			this.setActive(recognition, false);
  			this.recognition = null;
  		};
  		recognition.start();
  	}
  	/** Stops listening and delivers any pending final result. */
  	stop() {
  		const recognition = this.recognition;
  		this.wanted = false;
  		if (recognition) recognition.stop();
  	}
  	/** Stops listening immediately and discards pending results. */
  	abort() {
  		const recognition = this.recognition;
  		this.wanted = false;
  		this.recognition = null;
  		if (recognition) {
  			recognition.abort();
  			this.setActive(recognition, false, true);
  		}
  	}
  	handleResult(event) {
  		let interim = "";
  		for (let index = event.resultIndex; index < event.results.length; index += 1) {
  			const result = event.results[index];
  			const best = result?.[0];
  			if (!result || !best) continue;
  			if (result.isFinal) this.emit({
  				type: "final",
  				text: best.transcript.trim(),
  				confidence: best.confidence
  			});
  			else interim += best.transcript;
  		}
  		if (interim.length > 0) this.emit({
  			type: "interim",
  			text: interim.trim()
  		});
  	}
  	setActive(recognition, active, force = false) {
  		if (!force && this.recognition !== recognition) return;
  		if (this.active === active) return;
  		this.active = active;
  		this.emit({
  			type: "listening",
  			listening: active
  		});
  	}
  };
  function describeError(error, message) {
  	return {
  		"not-allowed": "Microphone access was denied.",
  		"service-not-allowed": "Speech recognition is not allowed in this browser (it may not work in TurboWarp Desktop).",
  		"audio-capture": "No microphone was found.",
  		network: "The speech recognition service could not be reached.",
  		"no-speech": "No speech was detected.",
  		aborted: "Listening was aborted.",
  		"language-not-supported": "This recognition language is not supported."
  	}[error] ?? (message && message.length > 0 ? message : `Speech recognition error: ${error}`);
  }
  /** The real browser environment. Chrome and Safari expose recognition as webkitSpeechRecognition. */
  function browserEnvironment() {
  	const scope = globalThis;
  	const Recognition = scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
  	const Utterance = scope.SpeechSynthesisUtterance;
  	return {
  		createRecognition: () => Recognition ? new Recognition() : null,
  		synthesis: scope.speechSynthesis && Utterance ? scope.speechSynthesis : null,
  		createUtterance: (text) => {
  			if (!Utterance) throw new Error("Speech synthesis is not supported in this browser.");
  			return new Utterance(text);
  		}
  	};
  }
  function defaultSpeechSettings() {
  	return {
  		lang: "ja-JP",
  		voice: "",
  		rate: 1,
  		pitch: 1,
  		volume: 1
  	};
  }
  /** Wraps speechSynthesis. `speak` resolves when the utterance ends or is cancelled. */
  var SynthesisController = class {
  	constructor(environment, voiceWaitMs = 1e3) {
  		this.environment = environment;
  		this.voiceWaitMs = voiceWaitMs;
  		this.settings = defaultSpeechSettings();
  		this.pending = 0;
  	}
  	isSupported() {
  		return this.environment.synthesis !== null;
  	}
  	get speaking() {
  		return this.pending > 0 || (this.environment.synthesis?.speaking ?? false);
  	}
  	get currentSettings() {
  		return { ...this.settings };
  	}
  	configure(settings) {
  		const next = {
  			...this.settings,
  			...settings
  		};
  		next.rate = clamp(next.rate, .1, 10, "Speech rate");
  		next.pitch = clamp(next.pitch, 0, 2, "Speech pitch");
  		next.volume = clamp(next.volume, 0, 1, "Speech volume");
  		this.settings = next;
  	}
  	/** Voices of this browser; those matching the speech language come first. */
  	voices() {
  		const primary = this.settings.lang.split("-")[0]?.toLowerCase() ?? "";
  		const matches = (voice) => voice.lang.toLowerCase().startsWith(primary) ? 0 : 1;
  		return [...this.environment.synthesis?.getVoices() ?? []].sort((left, right) => matches(left) - matches(right)).map((voice) => ({
  			name: voice.name,
  			lang: voice.lang,
  			default: voice.default,
  			localService: voice.localService
  		}));
  	}
  	speak(text) {
  		const synthesis = this.environment.synthesis;
  		if (!synthesis) return Promise.reject(/* @__PURE__ */ new Error("Speech synthesis is not supported in this browser."));
  		if (text.trim().length === 0) return Promise.resolve();
  		if (this.settings.voice.trim().length > 0 && synthesis.getVoices().length === 0) return this.voicesReady(this.voiceWaitMs).then(() => this.utter(text));
  		return this.utter(text);
  	}
  	utter(text) {
  		const synthesis = this.environment.synthesis;
  		if (!synthesis) return Promise.reject(/* @__PURE__ */ new Error("Speech synthesis is not supported in this browser."));
  		const utterance = this.environment.createUtterance(text);
  		utterance.lang = this.settings.lang;
  		utterance.voice = this.findVoice(synthesis.getVoices());
  		utterance.rate = this.settings.rate;
  		utterance.pitch = this.settings.pitch;
  		utterance.volume = this.settings.volume;
  		this.pending += 1;
  		return new Promise((resolve, reject) => {
  			const finish = (error) => {
  				this.pending = Math.max(0, this.pending - 1);
  				if (error) reject(error);
  				else resolve();
  			};
  			utterance.onend = () => finish();
  			utterance.onerror = (event) => {
  				if (event.error === "canceled" || event.error === "interrupted") finish();
  				else finish(/* @__PURE__ */ new Error(`Speech synthesis error: ${event.error}`));
  			};
  			synthesis.speak(utterance);
  		});
  	}
  	cancel() {
  		this.environment.synthesis?.cancel();
  	}
  	/** Resolves when the voice list is available, or after `timeoutMs`. */
  	voicesReady(timeoutMs) {
  		const synthesis = this.environment.synthesis;
  		if (!synthesis || synthesis.getVoices().length > 0 || !synthesis.addEventListener) return Promise.resolve();
  		return new Promise((resolve) => {
  			const timer = setTimeout(resolve, timeoutMs);
  			synthesis.addEventListener?.("voiceschanged", () => {
  				clearTimeout(timer);
  				resolve();
  			});
  		});
  	}
  	findVoice(voices) {
  		const name = this.settings.voice.trim();
  		if (name.length === 0) return null;
  		return voices.find((voice) => voice.name === name) ?? null;
  	}
  };
  function clamp(value, min, max, label) {
  	if (!Number.isFinite(value)) throw new TypeError(`${label} must be a number.`);
  	return Math.min(max, Math.max(min, value));
  }
  /**
  * Composition API: browser speech recognition and synthesis without TurboWarp block definitions.
  *
  * Importing this module does not register a TurboWarp extension and does not touch the `Scratch`
  * global. Everything runs in the browser; no API key or server of this package is involved.
  */
  function createWebSpeech(options = {}) {
  	return new WebSpeechImpl(options.environment ?? browserEnvironment());
  }
  var LANG_PATTERN = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/u;
  var WebSpeechImpl = class {
  	constructor(environment) {
  		this.listeners = /* @__PURE__ */ new Set();
  		this.lang = "ja-JP";
  		this.lastText = "";
  		this.interim = "";
  		this.confidence = 0;
  		this.error = "";
  		this.recognition = new RecognitionController(environment, (event) => this.onRecognition(event));
  		this.synthesis = new SynthesisController(environment);
  	}
  	isRecognitionSupported() {
  		return this.recognition.isSupported();
  	}
  	setRecognitionLanguage(lang) {
  		this.lang = normalizeLang(lang);
  	}
  	get recognitionLanguage() {
  		return this.lang;
  	}
  	startListening(mode) {
  		this.recognition.start({
  			lang: this.lang,
  			mode,
  			interimResults: true
  		});
  	}
  	stopListening() {
  		this.recognition.stop();
  	}
  	abortListening() {
  		this.recognition.abort();
  	}
  	get listening() {
  		return this.recognition.listening;
  	}
  	listenOnce() {
  		return new Promise((resolve, reject) => {
  			let result = null;
  			const unsubscribe = this.subscribe((event) => {
  				if (event.type === "final" && result === null) result = event.text;
  				if (event.type === "listening" && !event.listening) {
  					unsubscribe();
  					resolve(result ?? "");
  				}
  			});
  			try {
  				this.startListening("once");
  			} catch (error) {
  				unsubscribe();
  				reject(error);
  			}
  		});
  	}
  	get lastRecognizedText() {
  		return this.lastText;
  	}
  	get interimText() {
  		return this.interim;
  	}
  	get lastConfidence() {
  		return this.confidence;
  	}
  	isSynthesisSupported() {
  		return this.synthesis.isSupported();
  	}
  	configureSpeech(settings) {
  		const next = { ...settings };
  		if (next.lang !== void 0) next.lang = normalizeLang(next.lang);
  		this.synthesis.configure(next);
  	}
  	get speechSettings() {
  		return this.synthesis.currentSettings;
  	}
  	voices() {
  		return this.synthesis.voices();
  	}
  	async speak(text) {
  		this.emit({
  			type: "speaking",
  			speaking: true
  		});
  		try {
  			await this.synthesis.speak(text);
  		} catch (error) {
  			this.error = error instanceof Error ? error.message : String(error);
  			throw error;
  		} finally {
  			if (!this.synthesis.speaking) this.emit({
  				type: "speaking",
  				speaking: false
  			});
  		}
  	}
  	cancelSpeech() {
  		this.synthesis.cancel();
  	}
  	get speaking() {
  		return this.synthesis.speaking;
  	}
  	get lastError() {
  		return this.error;
  	}
  	subscribe(listener) {
  		this.listeners.add(listener);
  		return () => this.listeners.delete(listener);
  	}
  	release() {
  		this.recognition.abort();
  		this.synthesis.cancel();
  		this.listeners.clear();
  	}
  	onRecognition(event) {
  		if (event.type === "final") {
  			this.lastText = event.text;
  			this.confidence = event.confidence;
  			this.interim = "";
  		} else if (event.type === "interim") this.interim = event.text;
  		else if (event.type === "error") this.error = event.message;
  		this.emit(event);
  	}
  	emit(event) {
  		for (const listener of [...this.listeners]) listener(event);
  	}
  };
  function normalizeLang(value) {
  	const lang = value.trim();
  	if (!LANG_PATTERN.test(lang)) throw new TypeError("Language must be a tag such as ja-JP or en-US.");
  	return lang;
  }
  //#endregion
  //#region src/voice-chat.ts
  /**
  * Orchestrates one spoken conversation over the upstream capabilities:
  *
  * - `realtime` input/output uses the Realtime session's own microphone and audio.
  * - `browser` input uses Web Speech recognition and sends text; `browser` output speaks replies with
  *   Web Speech synthesis. Both need only text from the model, which is much cheaper.
  * - Browser input with Realtime audio output is refused: recognition would hear the assistant.
  *
  * With browser input and browser output, listening pauses while the assistant speaks (half duplex),
  * unless interruptions are allowed; then speech that starts during a reply cancels the reply.
  *
  * A forced coffee break ends the session after `talkSeconds` using the Realtime session time limit,
  * waits `breakSeconds`, and optionally resumes with a fresh session (and a fresh, cheaper context).
  */
  var VoiceChat = class {
  	constructor(options) {
  		this.options = options;
  		this.input = "realtime";
  		this.output = "realtime";
  		this.allowInterruptions = false;
  		this.coffeeBreak = {
  			talkSeconds: 0,
  			breakSeconds: 0,
  			autoResume: true
  		};
  		this.active = false;
  		this.onBreak = false;
  		this.breakEndsAt = null;
  		this.breakTimer = null;
  		this.statusValue = "idle";
  		this.lastUserText = "";
  		this.lastReplyText = "";
  		this.listeners = /* @__PURE__ */ new Set();
  		this.unsubscribes = [];
  		this.now = options.now ?? Date.now;
  		this.setTimer = options.setTimer ?? ((callback, ms) => setTimeout(callback, ms));
  		this.clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle));
  		this.unsubscribes.push(options.realtime.subscribe((event) => {
  			if (event.type === "response") this.handleReply(event.text);
  			else if (event.type === "sessionTimeLimitReached") this.startBreak();
  			else if (event.type === "error") this.emit({
  				type: "error",
  				message: event.message
  			});
  			else if (event.type === "state" && event.state === "failed" && this.active && !this.onBreak) {
  				this.active = false;
  				this.options.speech.abortListening();
  				this.setStatus("idle");
  			}
  		}), options.speech.subscribe((event) => {
  			if (event.type === "final") this.handleUserSpeech(event.text);
  			else if (event.type === "speechStart") this.handleSpeechStart();
  			else if (event.type === "error" && this.active) this.emit({
  				type: "error",
  				message: event.message
  			});
  		}));
  	}
  	setInput(input) {
  		this.input = input;
  	}
  	setOutput(output) {
  		this.output = output;
  	}
  	setAllowInterruptions(allow) {
  		this.allowInterruptions = allow;
  	}
  	setCoffeeBreak(settings) {
  		for (const [label, value] of [["Talk time", settings.talkSeconds], ["Break time", settings.breakSeconds]]) if (!Number.isFinite(value) || value < 0) throw new TypeError(`${label} must be zero or more.`);
  		this.coffeeBreak = { ...settings };
  	}
  	get settings() {
  		return {
  			input: this.input,
  			output: this.output,
  			allowInterruptions: this.allowInterruptions,
  			coffeeBreak: { ...this.coffeeBreak }
  		};
  	}
  	async start() {
  		if (this.input === "browser" && this.output === "realtime") throw new Error("Browser speech input cannot be combined with Realtime audio output. Use browser or text output.");
  		this.cancelBreakTimer();
  		this.onBreak = false;
  		this.breakEndsAt = null;
  		this.active = true;
  		this.setStatus("connecting");
  		const { realtime, speech } = this.options;
  		try {
  			realtime.setOutputMode(this.output === "realtime" ? "audio" : "text");
  			realtime.setSessionTimeLimit(this.coffeeBreak.talkSeconds);
  			await realtime.connect({ microphone: this.input === "realtime" });
  			if (!this.active) {
  				realtime.disconnect();
  				return;
  			}
  			if (this.input === "browser") speech.startListening("continuous");
  			this.setStatus("listening");
  		} catch (error) {
  			this.active = false;
  			this.setStatus("idle");
  			throw error;
  		}
  	}
  	end() {
  		this.active = false;
  		this.onBreak = false;
  		this.breakEndsAt = null;
  		this.cancelBreakTimer();
  		this.options.realtime.disconnect();
  		this.options.speech.abortListening();
  		this.options.speech.cancelSpeech();
  		this.setStatus("idle");
  	}
  	sendText(text) {
  		if (!this.active || this.onBreak) throw new Error("Start the conversation first.");
  		this.options.realtime.sendText(text);
  		this.setStatus("thinking");
  	}
  	get isActive() {
  		return this.active;
  	}
  	get status() {
  		return this.statusValue;
  	}
  	get userText() {
  		return this.lastUserText;
  	}
  	get replyText() {
  		return this.lastReplyText;
  	}
  	takeBreak() {
  		if (!this.active || this.onBreak) return;
  		this.options.realtime.disconnect();
  		this.startBreak();
  	}
  	endBreak() {
  		if (!this.onBreak) return;
  		this.cancelBreakTimer();
  		this.onBreak = false;
  		this.breakEndsAt = null;
  		this.emit({ type: "breakEnd" });
  		if (this.active && this.coffeeBreak.autoResume) this.start().catch((error) => this.emit({
  			type: "error",
  			message: messageOf$1(error)
  		}));
  		else {
  			this.active = false;
  			this.setStatus("idle");
  		}
  	}
  	get isOnBreak() {
  		return this.onBreak;
  	}
  	breakSecondsLeft() {
  		if (!this.onBreak || this.breakEndsAt === null) return 0;
  		return Math.max(0, Math.ceil((this.breakEndsAt - this.now()) / 1e3));
  	}
  	subscribe(listener) {
  		this.listeners.add(listener);
  		return () => this.listeners.delete(listener);
  	}
  	release() {
  		this.end();
  		for (const unsubscribe of this.unsubscribes.splice(0)) unsubscribe();
  		this.listeners.clear();
  	}
  	handleUserSpeech(text) {
  		if (!this.active || this.onBreak || this.input !== "browser" || text.trim().length === 0) return;
  		this.lastUserText = text;
  		this.emit({
  			type: "userSaid",
  			text
  		});
  		try {
  			this.sendText(text);
  		} catch (error) {
  			this.emit({
  				type: "error",
  				message: messageOf$1(error)
  			});
  		}
  	}
  	handleSpeechStart() {
  		if (this.active && this.allowInterruptions && this.options.speech.speaking) this.options.speech.cancelSpeech();
  	}
  	handleReply(text) {
  		if (!this.active || this.onBreak) return;
  		this.lastReplyText = text;
  		this.emit({
  			type: "reply",
  			text
  		});
  		if (this.output !== "browser") {
  			this.setStatus("listening");
  			return;
  		}
  		const halfDuplex = this.input === "browser" && !this.allowInterruptions;
  		if (halfDuplex) this.options.speech.abortListening();
  		this.setStatus("speaking");
  		this.options.speech.speak(text).catch((error) => this.emit({
  			type: "error",
  			message: messageOf$1(error)
  		})).finally(() => {
  			if (!this.active || this.onBreak) return;
  			if (halfDuplex && !this.options.speech.listening) this.options.speech.startListening("continuous");
  			if (this.statusValue === "speaking") this.setStatus("listening");
  		});
  	}
  	startBreak() {
  		if (!this.active || this.onBreak) return;
  		this.onBreak = true;
  		this.options.speech.abortListening();
  		this.options.speech.cancelSpeech();
  		this.setStatus("break");
  		this.emit({ type: "breakStart" });
  		if (this.coffeeBreak.breakSeconds > 0) {
  			this.breakEndsAt = this.now() + this.coffeeBreak.breakSeconds * 1e3;
  			this.breakTimer = this.setTimer(() => {
  				this.breakTimer = null;
  				this.endBreak();
  			}, this.coffeeBreak.breakSeconds * 1e3);
  		}
  	}
  	cancelBreakTimer() {
  		if (this.breakTimer !== null) this.clearTimer(this.breakTimer);
  		this.breakTimer = null;
  	}
  	setStatus(status) {
  		if (this.statusValue === status) return;
  		this.statusValue = status;
  		this.emit({
  			type: "status",
  			status
  		});
  	}
  	emit(event) {
  		for (const listener of [...this.listeners]) listener(event);
  	}
  };
  function messageOf$1(error) {
  	return error instanceof Error ? error.message : String(error);
  }
  //#endregion
  //#region src/composition.ts
  /**
  * Composition API: voice chat without TurboWarp block definitions.
  *
  * Wires one shared set of named functions into the Realtime composition (as tools) and combines it
  * with Web Speech. Importing this module does not register a TurboWarp extension.
  */
  function createVoiceChat(options) {
  	const functions = options.functions ?? createNamedFunctions({
  		runtime: options.runtime,
  		functionHatOpcode: options.functionHatOpcode
  	});
  	const realtime = options.realtime ?? createRealtimeComposition({
  		...options.realtimeOptions,
  		runtime: options.runtime,
  		functionHatOpcode: options.functionHatOpcode,
  		functions
  	});
  	const speech = options.speech ?? createWebSpeech();
  	const chat = new VoiceChat({
  		realtime,
  		speech,
  		...options.now ? { now: options.now } : {},
  		...options.setTimer ? { setTimer: options.setTimer } : {},
  		...options.clearTimer ? { clearTimer: options.clearTimer } : {}
  	});
  	return {
  		functions,
  		realtime,
  		speech,
  		chat,
  		release: () => {
  			chat.release();
  			realtime.release();
  			speech.release();
  			functions.release();
  		}
  	};
  }
  //#endregion
  //#region src/extension.ts
  var blockDefinitions = block_definitions_default.blocks;
  var menuDefinitions = block_definitions_default.menus;
  var hat = (name) => `${extensionConfig.id}_${name}`;
  var DEFINE_FUNCTION_OPCODE = hat("defineFunction");
  var HATS = {
  	userSays: hat("whenUserSays"),
  	aiReplies: hat("whenAiReplies"),
  	breakStarts: hat("whenBreakStarts"),
  	breakEnds: hat("whenBreakEnds")
  };
  var USAGE_FIELDS = {
  	costUSD: (usage) => Math.round(usage.estimatedCostUsd * 1e6) / 1e6,
  	responses: (usage) => usage.responses,
  	inputTokens: (usage) => usage.inputTokens,
  	outputTokens: (usage) => usage.outputTokens,
  	cachedInputTokens: (usage) => usage.cachedInputTokens,
  	textInputTokens: (usage) => usage.textInputTokens,
  	audioInputTokens: (usage) => usage.audioInputTokens,
  	textOutputTokens: (usage) => usage.textOutputTokens,
  	audioOutputTokens: (usage) => usage.audioOutputTokens
  };
  /** Block surface over the voice-chat composition. */
  var VoiceChatExtension = class {
  	constructor(deps) {
  		this.lastErrorMessage = "";
  		this.voice = createVoiceChat({
  			...deps,
  			functionHatOpcode: DEFINE_FUNCTION_OPCODE
  		});
  		const { runtime } = deps;
  		this.voice.chat.subscribe((event) => {
  			if (event.type === "userSaid") runtime.startHats(HATS.userSays);
  			else if (event.type === "reply") runtime.startHats(HATS.aiReplies);
  			else if (event.type === "breakStart") runtime.startHats(HATS.breakStarts);
  			else if (event.type === "breakEnd") runtime.startHats(HATS.breakEnds);
  			else if (event.type === "error") this.lastErrorMessage = event.message;
  		});
  		runtime.on("PROJECT_STOP_ALL", () => this.voice.chat.end());
  	}
  	getInfo() {
  		return {
  			id: extensionConfig.id,
  			name: Scratch.translate(block_definitions_default.extensionName),
  			docsURI: extensionConfig.docsURI,
  			blockIconURI: extensionConfig.blockIconURI,
  			blocks: blockDefinitions.map((block) => this.toScratchBlock(block)),
  			menus: Object.fromEntries(Object.entries(menuDefinitions).map(([id, menu]) => [id, {
  				acceptReporters: menu.acceptReporters,
  				items: [...menu.items]
  			}]))
  		};
  	}
  	configureRelay(args) {
  		this.record(() => this.voice.realtime.configureRelay(text(args.ENDPOINT)));
  	}
  	pairRelay(args) {
  		return this.recordAsync(() => this.voice.realtime.pairRelay(text(args.CODE)));
  	}
  	isRelayPaired() {
  		return this.voice.realtime.isRelayPaired();
  	}
  	setModel(args) {
  		this.record(() => this.voice.realtime.setModel(text(args.MODEL)));
  	}
  	setInstructions(args) {
  		this.record(() => this.voice.realtime.setInstructions(text(args.TEXT)));
  	}
  	setSpeechInput(args) {
  		const input = text(args.INPUT) === "browser" ? "browser" : "realtime";
  		this.voice.chat.setInput(input);
  	}
  	setSpeechOutput(args) {
  		const value = text(args.OUTPUT);
  		const output = value === "browser" || value === "text" ? value : "realtime";
  		this.voice.chat.setOutput(output);
  	}
  	setLanguage(args) {
  		this.record(() => {
  			const lang = text(args.LANG);
  			this.voice.speech.setRecognitionLanguage(lang);
  			this.voice.speech.configureSpeech({ lang });
  		});
  	}
  	setRealtimeVoice(args) {
  		this.record(() => this.voice.realtime.setVoice(text(args.VOICE)));
  	}
  	setAllowInterruptions(args) {
  		this.voice.chat.setAllowInterruptions(text(args.ONOFF) === "on");
  	}
  	setCoffeeBreak(args) {
  		this.record(() => this.voice.chat.setCoffeeBreak({
  			talkSeconds: Scratch.Cast.toNumber(args.TALK) * 60,
  			breakSeconds: Scratch.Cast.toNumber(args.BREAK) * 60,
  			autoResume: text(args.AFTER) !== "stop"
  		}));
  	}
  	takeBreakNow() {
  		this.voice.chat.takeBreak();
  	}
  	endBreakNow() {
  		this.voice.chat.endBreak();
  	}
  	whenBreakStarts() {
  		return true;
  	}
  	whenBreakEnds() {
  		return true;
  	}
  	isOnBreak() {
  		return this.voice.chat.isOnBreak;
  	}
  	breakSecondsLeft() {
  		return this.voice.chat.breakSecondsLeft();
  	}
  	startConversation() {
  		return this.recordAsync(() => this.voice.chat.start());
  	}
  	endConversation() {
  		this.voice.chat.end();
  	}
  	isActive() {
  		return this.voice.chat.isActive;
  	}
  	conversationStatus() {
  		return this.voice.chat.status;
  	}
  	sendText(args) {
  		this.record(() => this.voice.chat.sendText(text(args.TEXT)));
  	}
  	whenUserSays() {
  		return true;
  	}
  	userSaid() {
  		return this.voice.chat.userText;
  	}
  	whenAiReplies() {
  		return true;
  	}
  	aiReply() {
  		return this.voice.chat.replyText;
  	}
  	defineFunction(args, util) {
  		return this.voice.functions.matchHat(text(args.NAME), util?.thread);
  	}
  	functionArgument(args, util) {
  		try {
  			return toScratchValue(readArgumentPath(this.voice.functions.argumentsFor(util?.thread), text(args.PATH)));
  		} catch (error) {
  			this.lastErrorMessage = messageOf(error);
  			return "";
  		}
  	}
  	functionArgumentsJson(_args, util) {
  		try {
  			return JSON.stringify(this.voice.functions.argumentsFor(util?.thread) ?? null);
  		} catch (error) {
  			this.lastErrorMessage = messageOf(error);
  			return "";
  		}
  	}
  	returnValue(args, util) {
  		try {
  			this.voice.functions.returnFrom(util?.thread, parseJsonOrText(text(args.VALUE)));
  			util?.stopThisScript?.();
  		} catch (error) {
  			this.lastErrorMessage = messageOf(error);
  		}
  	}
  	usageValue(args) {
  		const read = USAGE_FIELDS[text(args.FIELD)];
  		return read ? read(this.voice.realtime.usage()) : "";
  	}
  	resetUsage() {
  		this.voice.realtime.resetUsage();
  	}
  	lastError() {
  		return this.lastErrorMessage;
  	}
  	record(action) {
  		try {
  			action();
  			this.lastErrorMessage = "";
  		} catch (error) {
  			this.lastErrorMessage = messageOf(error);
  		}
  	}
  	async recordAsync(action) {
  		try {
  			await action();
  			this.lastErrorMessage = "";
  		} catch (error) {
  			this.lastErrorMessage = messageOf(error);
  		}
  	}
  	toScratchBlock(block) {
  		const scratchBlock = {
  			opcode: block.opcode,
  			blockType: Scratch.BlockType[block.blockType],
  			text: Scratch.translate(block.text),
  			arguments: Object.fromEntries(Object.entries(block.arguments).map(([name, argument]) => [name, {
  				type: Scratch.ArgumentType[argument.type],
  				defaultValue: argument.defaultValue,
  				...argument.menu ? { menu: argument.menu } : {}
  			}]))
  		};
  		if (block.blockType === "HAT") scratchBlock.isEdgeActivated = false;
  		return scratchBlock;
  	}
  };
  function text(value) {
  	return Scratch.Cast.toString(value);
  }
  function messageOf(error) {
  	return error instanceof Error ? error.message : String(error);
  }
  //#endregion
  //#region src/index.ts
  if (extensionConfig.unsandboxed && !Scratch.extensions.unsandboxed) throw new Error(`${extensionConfig.name} must run unsandboxed.`);
  var runtime = Scratch.vm?.runtime;
  if (!runtime) throw new Error(`${extensionConfig.name} requires access to the TurboWarp VM runtime.`);
  Scratch.extensions.register(new VoiceChatExtension({ runtime }));
  //#endregion

})(Scratch);
