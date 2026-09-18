import {
  parseJsonOrText,
  readArgumentPath,
  toScratchValue,
  type BlockUtilityLike,
  type RuntimeLike
} from '@kubohiroya/turbowarp-named-functions/composition';
import type {UsageTotals} from '@kubohiroya/turbowarp-openai-realtime-api/composition';
import {extensionConfig} from './config';
import definitions from './block-definitions.json';
import {createVoiceChat, type VoiceChatComposition, type VoiceChatCompositionOptions} from './composition.js';
import type {SpeechInput, SpeechOutput} from './voice-chat.js';

type BlockTypeName = 'COMMAND' | 'REPORTER' | 'BOOLEAN' | 'HAT';
type ArgumentTypeName = 'STRING' | 'NUMBER' | 'BOOLEAN';

interface DefinitionArgument {
  type: ArgumentTypeName;
  defaultValue: string;
  menu?: string;
}

interface BlockDefinition {
  opcode: string;
  blockType: BlockTypeName;
  text: string;
  arguments: Record<string, DefinitionArgument>;
}

interface MenuDefinition {
  acceptReporters: boolean;
  items: string[];
}

const blockDefinitions = definitions.blocks as readonly BlockDefinition[];
const menuDefinitions = definitions.menus as Record<string, MenuDefinition>;

const hat = (name: string) => `${extensionConfig.id}_${name}`;
export const DEFINE_FUNCTION_OPCODE = hat('defineFunction');
export const HATS = {
  userSays: hat('whenUserSays'),
  aiReplies: hat('whenAiReplies'),
  breakStarts: hat('whenBreakStarts'),
  breakEnds: hat('whenBreakEnds')
} as const;

export type VoiceChatExtensionDependencies = Omit<VoiceChatCompositionOptions, 'functionHatOpcode'>;

type Args = Record<string, unknown>;
type Util = BlockUtilityLike & {stopThisScript?: () => void};

const USAGE_FIELDS: Record<string, (usage: UsageTotals) => number> = {
  costUSD: (usage) => Math.round(usage.estimatedCostUsd * 1_000_000) / 1_000_000,
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
export class VoiceChatExtension implements TurboWarpExtension {
  private lastErrorMessage = '';
  private readonly voice: VoiceChatComposition;

  public constructor(deps: VoiceChatExtensionDependencies & {runtime: RuntimeLike}) {
    this.voice = createVoiceChat({...deps, functionHatOpcode: DEFINE_FUNCTION_OPCODE});
    const {runtime} = deps;
    this.voice.chat.subscribe((event) => {
      if (event.type === 'userSaid') runtime.startHats(HATS.userSays);
      else if (event.type === 'reply') runtime.startHats(HATS.aiReplies);
      else if (event.type === 'breakStart') runtime.startHats(HATS.breakStarts);
      else if (event.type === 'breakEnd') runtime.startHats(HATS.breakEnds);
      else if (event.type === 'error') this.lastErrorMessage = event.message;
    });
    // The stop button ends the conversation so a forgotten session does not keep costing money.
    runtime.on('PROJECT_STOP_ALL', () => this.voice.chat.end());
  }

  public getInfo(): Record<string, unknown> {
    return {
      id: extensionConfig.id,
      name: Scratch.translate(definitions.extensionName),
      docsURI: extensionConfig.docsURI,
      blockIconURI: extensionConfig.blockIconURI,
      blocks: blockDefinitions.map((block) => this.toScratchBlock(block)),
      menus: Object.fromEntries(
        Object.entries(menuDefinitions).map(([id, menu]) => [
          id,
          {acceptReporters: menu.acceptReporters, items: [...menu.items]}
        ])
      )
    };
  }

  // ---- setup --------------------------------------------------------------------------------

  public configureRelay(args: Args): void {
    this.record(() => this.voice.realtime.configureRelay(text(args.ENDPOINT)));
  }

  public pairRelay(args: Args): Promise<void> {
    return this.recordAsync(() => this.voice.realtime.pairRelay(text(args.CODE)));
  }

  public isRelayPaired(): boolean {
    return this.voice.realtime.isRelayPaired();
  }

  public setModel(args: Args): void {
    this.record(() => this.voice.realtime.setModel(text(args.MODEL)));
  }

  public setInstructions(args: Args): void {
    this.record(() => this.voice.realtime.setInstructions(text(args.TEXT)));
  }

  public setSpeechInput(args: Args): void {
    const input: SpeechInput = text(args.INPUT) === 'browser' ? 'browser' : 'realtime';
    this.voice.chat.setInput(input);
  }

  public setSpeechOutput(args: Args): void {
    const value = text(args.OUTPUT);
    const output: SpeechOutput = value === 'browser' || value === 'text' ? value : 'realtime';
    this.voice.chat.setOutput(output);
  }

  public setLanguage(args: Args): void {
    this.record(() => {
      const lang = text(args.LANG);
      this.voice.speech.setRecognitionLanguage(lang);
      this.voice.speech.configureSpeech({lang});
    });
  }

  public setRealtimeVoice(args: Args): void {
    this.record(() => this.voice.realtime.setVoice(text(args.VOICE)));
  }

  public setAllowInterruptions(args: Args): void {
    this.voice.chat.setAllowInterruptions(text(args.ONOFF) === 'on');
  }

  // ---- coffee break -------------------------------------------------------------------------

  public setCoffeeBreak(args: Args): void {
    this.record(() =>
      this.voice.chat.setCoffeeBreak({
        talkSeconds: Scratch.Cast.toNumber(args.TALK) * 60,
        breakSeconds: Scratch.Cast.toNumber(args.BREAK) * 60,
        autoResume: text(args.AFTER) !== 'stop'
      })
    );
  }

  public takeBreakNow(): void {
    this.voice.chat.takeBreak();
  }

  public endBreakNow(): void {
    this.voice.chat.endBreak();
  }

  public whenBreakStarts(): boolean {
    return true;
  }

  public whenBreakEnds(): boolean {
    return true;
  }

  public isOnBreak(): boolean {
    return this.voice.chat.isOnBreak;
  }

  public breakSecondsLeft(): number {
    return this.voice.chat.breakSecondsLeft();
  }

  // ---- conversation -------------------------------------------------------------------------

  public startConversation(): Promise<void> {
    return this.recordAsync(() => this.voice.chat.start());
  }

  public endConversation(): void {
    this.voice.chat.end();
  }

  public isActive(): boolean {
    return this.voice.chat.isActive;
  }

  public conversationStatus(): string {
    return this.voice.chat.status;
  }

  public sendText(args: Args): void {
    this.record(() => this.voice.chat.sendText(text(args.TEXT)));
  }

  public whenUserSays(): boolean {
    return true;
  }

  public userSaid(): string {
    return this.voice.chat.userText;
  }

  public whenAiReplies(): boolean {
    return true;
  }

  public aiReply(): string {
    return this.voice.chat.replyText;
  }

  // ---- functions ----------------------------------------------------------------------------

  public defineFunction(args: Args, util?: Util): boolean {
    return this.voice.functions.matchHat(text(args.NAME), util?.thread);
  }

  public functionArgument(args: Args, util?: Util): string | number | boolean {
    try {
      return toScratchValue(readArgumentPath(this.voice.functions.argumentsFor(util?.thread), text(args.PATH)));
    } catch (error) {
      this.lastErrorMessage = messageOf(error);
      return '';
    }
  }

  public functionArgumentsJson(_args: Args, util?: Util): string {
    try {
      return JSON.stringify(this.voice.functions.argumentsFor(util?.thread) ?? null);
    } catch (error) {
      this.lastErrorMessage = messageOf(error);
      return '';
    }
  }

  public returnValue(args: Args, util?: Util): void {
    try {
      this.voice.functions.returnFrom(util?.thread, parseJsonOrText(text(args.VALUE)));
      util?.stopThisScript?.();
    } catch (error) {
      this.lastErrorMessage = messageOf(error);
    }
  }

  // ---- usage and errors ---------------------------------------------------------------------

  public usageValue(args: Args): number | string {
    const read = USAGE_FIELDS[text(args.FIELD)];
    return read ? read(this.voice.realtime.usage()) : '';
  }

  public resetUsage(): void {
    this.voice.realtime.resetUsage();
  }

  public lastError(): string {
    return this.lastErrorMessage;
  }

  // ---- internals ----------------------------------------------------------------------------

  private record(action: () => void): void {
    try {
      action();
      this.lastErrorMessage = '';
    } catch (error) {
      this.lastErrorMessage = messageOf(error);
    }
  }

  private async recordAsync(action: () => Promise<void>): Promise<void> {
    try {
      await action();
      this.lastErrorMessage = '';
    } catch (error) {
      this.lastErrorMessage = messageOf(error);
    }
  }

  private toScratchBlock(block: BlockDefinition): Record<string, unknown> {
    const scratchBlock: Record<string, unknown> = {
      opcode: block.opcode,
      blockType: Scratch.BlockType[block.blockType],
      text: Scratch.translate(block.text),
      arguments: Object.fromEntries(
        Object.entries(block.arguments).map(([name, argument]) => [
          name,
          {
            type: Scratch.ArgumentType[argument.type],
            defaultValue: argument.defaultValue,
            ...(argument.menu ? {menu: argument.menu} : {})
          }
        ])
      )
    };
    if (block.blockType === 'HAT') scratchBlock.isEdgeActivated = false;
    return scratchBlock;
  }
}

function text(value: unknown): string {
  return Scratch.Cast.toString(value);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
