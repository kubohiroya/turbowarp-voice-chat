import type { RealtimeComposition } from '@kubohiroya/turbowarp-openai-realtime-api/composition';
import type { WebSpeech } from '@kubohiroya/turbowarp-web-speech/composition';
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
export type VoiceChatEvent = {
    type: 'status';
    status: ConversationStatus;
} | {
    type: 'userSaid';
    text: string;
} | {
    type: 'reply';
    text: string;
} | {
    type: 'breakStart';
} | {
    type: 'breakEnd';
} | {
    type: 'error';
    message: string;
};
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
export declare class VoiceChat {
    private readonly options;
    private input;
    private output;
    private allowInterruptions;
    private coffeeBreak;
    private active;
    private onBreak;
    private breakEndsAt;
    private breakTimer;
    private statusValue;
    private lastUserText;
    private lastReplyText;
    private readonly listeners;
    private readonly unsubscribes;
    private readonly now;
    private readonly setTimer;
    private readonly clearTimer;
    constructor(options: VoiceChatOptions);
    setInput(input: SpeechInput): void;
    setOutput(output: SpeechOutput): void;
    setAllowInterruptions(allow: boolean): void;
    setCoffeeBreak(settings: CoffeeBreakSettings): void;
    get settings(): {
        input: SpeechInput;
        output: SpeechOutput;
        allowInterruptions: boolean;
        coffeeBreak: {
            /** Seconds of conversation before a forced break; 0 disables forced breaks. */
            talkSeconds: number;
            /** Seconds the break lasts; 0 means the break lasts until `endBreak()`. */
            breakSeconds: number;
            /** Start a fresh session automatically when the break ends. */
            autoResume: boolean;
        };
    };
    start(): Promise<void>;
    end(): void;
    sendText(text: string): void;
    get isActive(): boolean;
    get status(): ConversationStatus;
    get userText(): string;
    get replyText(): string;
    takeBreak(): void;
    endBreak(): void;
    get isOnBreak(): boolean;
    breakSecondsLeft(): number;
    subscribe(listener: VoiceChatListener): () => void;
    release(): void;
    private handleUserSpeech;
    private handleSpeechStart;
    private handleReply;
    private startBreak;
    private cancelBreakTimer;
    private setStatus;
    private emit;
}
