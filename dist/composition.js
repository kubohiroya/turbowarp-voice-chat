import { createNamedFunctions } from "@kubohiroya/turbowarp-named-functions/composition";
import { createRealtimeComposition } from "@kubohiroya/turbowarp-openai-realtime-api/composition";
import { createWebSpeech } from "@kubohiroya/turbowarp-web-speech/composition";
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
			message: messageOf(error)
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
				message: messageOf(error)
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
			message: messageOf(error)
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
function messageOf(error) {
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
export { VoiceChat, createVoiceChat };
