import { type BlockUtilityLike, type RuntimeLike } from '@kubohiroya/turbowarp-named-functions/composition';
import { type VoiceChatCompositionOptions } from './composition.js';
export declare const DEFINE_FUNCTION_OPCODE: string;
export declare const HATS: {
    readonly userSays: string;
    readonly aiReplies: string;
    readonly breakStarts: string;
    readonly breakEnds: string;
};
export type VoiceChatExtensionDependencies = Omit<VoiceChatCompositionOptions, 'functionHatOpcode'>;
type Args = Record<string, unknown>;
type Util = BlockUtilityLike & {
    stopThisScript?: () => void;
};
/** Block surface over the voice-chat composition. */
export declare class VoiceChatExtension implements TurboWarpExtension {
    private lastErrorMessage;
    private readonly voice;
    constructor(deps: VoiceChatExtensionDependencies & {
        runtime: RuntimeLike;
    });
    getInfo(): Record<string, unknown>;
    configureRelay(args: Args): void;
    pairRelay(args: Args): Promise<void>;
    isRelayPaired(): boolean;
    setModel(args: Args): void;
    setInstructions(args: Args): void;
    setSpeechInput(args: Args): void;
    setSpeechOutput(args: Args): void;
    setLanguage(args: Args): void;
    setRealtimeVoice(args: Args): void;
    setAllowInterruptions(args: Args): void;
    setCoffeeBreak(args: Args): void;
    takeBreakNow(): void;
    endBreakNow(): void;
    whenBreakStarts(): boolean;
    whenBreakEnds(): boolean;
    isOnBreak(): boolean;
    breakSecondsLeft(): number;
    startConversation(): Promise<void>;
    endConversation(): void;
    isActive(): boolean;
    conversationStatus(): string;
    sendText(args: Args): void;
    whenUserSays(): boolean;
    userSaid(): string;
    whenAiReplies(): boolean;
    aiReply(): string;
    defineFunction(args: Args, util?: Util): boolean;
    functionArgument(args: Args, util?: Util): string | number | boolean;
    functionArgumentsJson(_args: Args, util?: Util): string;
    returnValue(args: Args, util?: Util): void;
    usageValue(args: Args): number | string;
    resetUsage(): void;
    lastError(): string;
    private record;
    private recordAsync;
    private toScratchBlock;
}
export {};
