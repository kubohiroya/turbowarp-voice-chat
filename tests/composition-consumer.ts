// Type-checks the published composition API the way a downstream package imports it.
import {createVoiceChat, type VoiceChatComposition, type VoiceChatEvent} from '../dist/types/composition.js';

declare const runtime: Parameters<typeof createVoiceChat>[0]['runtime'];

const voice: VoiceChatComposition = createVoiceChat({runtime, functionHatOpcode: 'consumer_defineFunction'});
voice.chat.setInput('browser');
voice.chat.setOutput('browser');
voice.chat.setCoffeeBreak({talkSeconds: 600, breakSeconds: 300, autoResume: true});
voice.chat.subscribe((event: VoiceChatEvent) => {
  if (event.type === 'breakStart') void voice.speech.speak('Coffee break!');
});
void voice.chat.start();
voice.release();
