import type {RealtimeComposition} from '@kubohiroya/turbowarp-openai-realtime-api/composition';
import type {WebSpeech} from '@kubohiroya/turbowarp-web-speech/composition';

/** Where the user's speech is turned into input for the model. */
export type SpeechInput = 'realtime' | 'browser';
/** How the assistant's reply reaches the user. */
export type SpeechOutput = 'realtime' | 'browser' | 'text';

export type ConversationStatus = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'break';

export interface CoffeeBreakSettings {
  /** Seconds of conversation before a forced break; 0 disables forced breaks. */
  talkSeconds: number;
  /** Seconds the break lasts; 0 means the break lasts until `endBreak()`. */
  breakSeconds: number;
  /** Start a fresh session automatically when the break ends. */
  autoResume: boolean;
}

export type VoiceChatEvent =
  | {type: 'status'; status: ConversationStatus}
  | {type: 'userSaid'; text: string}
  | {type: 'reply'; text: string}
  | {type: 'breakStart'}
  | {type: 'breakEnd'}
  | {type: 'error'; message: string};

export type VoiceChatListener = (event: VoiceChatEvent) => void;

export interface VoiceChatOptions {
  realtime: RealtimeComposition;
  speech: WebSpeech;
  now?: () => number;
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

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
export class VoiceChat {
  private input: SpeechInput = 'realtime';
  private output: SpeechOutput = 'realtime';
  private allowInterruptions = false;
  private coffeeBreak: CoffeeBreakSettings = {talkSeconds: 0, breakSeconds: 0, autoResume: true};
  private active = false;
  private onBreak = false;
  private breakEndsAt: number | null = null;
  private breakTimer: unknown = null;
  private statusValue: ConversationStatus = 'idle';
  private lastUserText = '';
  private lastReplyText = '';
  private readonly listeners = new Set<VoiceChatListener>();
  private readonly unsubscribes: Array<() => void> = [];
  private readonly now: () => number;
  private readonly setTimer: (callback: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;

  public constructor(private readonly options: VoiceChatOptions) {
    this.now = options.now ?? Date.now;
    this.setTimer = options.setTimer ?? ((callback, ms) => setTimeout(callback, ms));
    this.clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
    this.unsubscribes.push(
      options.realtime.subscribe((event) => {
        if (event.type === 'response') this.handleReply(event.text);
        else if (event.type === 'sessionTimeLimitReached') this.startBreak();
        else if (event.type === 'error') this.emit({type: 'error', message: event.message});
        else if (event.type === 'state' && event.state === 'failed' && this.active && !this.onBreak) {
          this.active = false;
          this.options.speech.abortListening();
          this.setStatus('idle');
        }
      }),
      options.speech.subscribe((event) => {
        if (event.type === 'final') this.handleUserSpeech(event.text);
        else if (event.type === 'speechStart') this.handleSpeechStart();
        else if (event.type === 'error' && this.active) this.emit({type: 'error', message: event.message});
      })
    );
  }

  // ---- settings -----------------------------------------------------------------------------

  public setInput(input: SpeechInput): void {
    this.input = input;
  }

  public setOutput(output: SpeechOutput): void {
    this.output = output;
  }

  public setAllowInterruptions(allow: boolean): void {
    this.allowInterruptions = allow;
  }

  public setCoffeeBreak(settings: CoffeeBreakSettings): void {
    for (const [label, value] of [
      ['Talk time', settings.talkSeconds],
      ['Break time', settings.breakSeconds]
    ] as const) {
      if (!Number.isFinite(value) || value < 0) throw new TypeError(`${label} must be zero or more.`);
    }
    this.coffeeBreak = {...settings};
  }

  public get settings() {
    return {
      input: this.input,
      output: this.output,
      allowInterruptions: this.allowInterruptions,
      coffeeBreak: {...this.coffeeBreak}
    };
  }

  // ---- conversation -------------------------------------------------------------------------

  public async start(): Promise<void> {
    if (this.input === 'browser' && this.output === 'realtime') {
      throw new Error('Browser speech input cannot be combined with Realtime audio output. Use browser or text output.');
    }
    this.cancelBreakTimer();
    this.onBreak = false;
    this.breakEndsAt = null;
    this.active = true;
    this.setStatus('connecting');
    const {realtime, speech} = this.options;
    try {
      realtime.setOutputMode(this.output === 'realtime' ? 'audio' : 'text');
      realtime.setSessionTimeLimit(this.coffeeBreak.talkSeconds);
      await realtime.connect({microphone: this.input === 'realtime'});
      if (!this.active) {
        realtime.disconnect();
        return;
      }
      if (this.input === 'browser') speech.startListening('continuous');
      this.setStatus('listening');
    } catch (error) {
      this.active = false;
      this.setStatus('idle');
      throw error;
    }
  }

  public end(): void {
    this.active = false;
    this.onBreak = false;
    this.breakEndsAt = null;
    this.cancelBreakTimer();
    this.options.realtime.disconnect();
    this.options.speech.abortListening();
    this.options.speech.cancelSpeech();
    this.setStatus('idle');
  }

  public sendText(text: string): void {
    if (!this.active || this.onBreak) throw new Error('Start the conversation first.');
    this.options.realtime.sendText(text);
    this.setStatus('thinking');
  }

  public get isActive(): boolean {
    return this.active;
  }

  public get status(): ConversationStatus {
    return this.statusValue;
  }

  public get userText(): string {
    return this.lastUserText;
  }

  public get replyText(): string {
    return this.lastReplyText;
  }

  // ---- coffee break -------------------------------------------------------------------------

  public takeBreak(): void {
    if (!this.active || this.onBreak) return;
    this.options.realtime.disconnect();
    this.startBreak();
  }

  public endBreak(): void {
    if (!this.onBreak) return;
    this.cancelBreakTimer();
    this.onBreak = false;
    this.breakEndsAt = null;
    this.emit({type: 'breakEnd'});
    if (this.active && this.coffeeBreak.autoResume) {
      this.start().catch((error: unknown) => this.emit({type: 'error', message: messageOf(error)}));
    } else {
      this.active = false;
      this.setStatus('idle');
    }
  }

  public get isOnBreak(): boolean {
    return this.onBreak;
  }

  public breakSecondsLeft(): number {
    if (!this.onBreak || this.breakEndsAt === null) return 0;
    return Math.max(0, Math.ceil((this.breakEndsAt - this.now()) / 1000));
  }

  // ---- events -------------------------------------------------------------------------------

  public subscribe(listener: VoiceChatListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public release(): void {
    this.end();
    for (const unsubscribe of this.unsubscribes.splice(0)) unsubscribe();
    this.listeners.clear();
  }

  // ---- internals ----------------------------------------------------------------------------

  private handleUserSpeech(text: string): void {
    if (!this.active || this.onBreak || this.input !== 'browser' || text.trim().length === 0) return;
    this.lastUserText = text;
    this.emit({type: 'userSaid', text});
    try {
      this.sendText(text);
    } catch (error) {
      this.emit({type: 'error', message: messageOf(error)});
    }
  }

  private handleSpeechStart(): void {
    // Barge-in: the user started talking over the assistant.
    if (this.active && this.allowInterruptions && this.options.speech.speaking) this.options.speech.cancelSpeech();
  }

  private handleReply(text: string): void {
    if (!this.active || this.onBreak) return;
    this.lastReplyText = text;
    this.emit({type: 'reply', text});
    if (this.output !== 'browser') {
      this.setStatus('listening');
      return;
    }
    const halfDuplex = this.input === 'browser' && !this.allowInterruptions;
    if (halfDuplex) this.options.speech.abortListening();
    this.setStatus('speaking');
    this.options.speech
      .speak(text)
      .catch((error: unknown) => this.emit({type: 'error', message: messageOf(error)}))
      .finally(() => {
        if (!this.active || this.onBreak) return;
        if (halfDuplex && !this.options.speech.listening) this.options.speech.startListening('continuous');
        if (this.statusValue === 'speaking') this.setStatus('listening');
      });
  }

  private startBreak(): void {
    if (!this.active || this.onBreak) return;
    this.onBreak = true;
    this.options.speech.abortListening();
    this.options.speech.cancelSpeech();
    this.setStatus('break');
    this.emit({type: 'breakStart'});
    if (this.coffeeBreak.breakSeconds > 0) {
      this.breakEndsAt = this.now() + this.coffeeBreak.breakSeconds * 1000;
      this.breakTimer = this.setTimer(() => {
        this.breakTimer = null;
        this.endBreak();
      }, this.coffeeBreak.breakSeconds * 1000);
    }
  }

  private cancelBreakTimer(): void {
    if (this.breakTimer !== null) this.clearTimer(this.breakTimer);
    this.breakTimer = null;
  }

  private setStatus(status: ConversationStatus): void {
    if (this.statusValue === status) return;
    this.statusValue = status;
    this.emit({type: 'status', status});
  }

  private emit(event: VoiceChatEvent): void {
    for (const listener of [...this.listeners]) listener(event);
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
