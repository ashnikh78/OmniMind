import os
from typing import Optional, Callable

# Open-source TTS: Coqui TTS
try:
    from TTS.api import TTS as CoquiTTS
except ImportError:
    CoquiTTS = None

# Open-source STT: Vosk
try:
    from vosk import Model as VoskModel, KaldiRecognizer
    import wave
except ImportError:
    VoskModel = None
    KaldiRecognizer = None

# Language detection
try:
    from langdetect import detect as detect_lang
except ImportError:
    detect_lang = None

class VoiceInterface:
    def __init__(self, tts_model_name: str = "tts_models/multilingual/multi-dataset/your_tts", vosk_model_dir: str = "models/vosk-model-small-en-us-0.15"):
        self.tts = None
        self.stt_model = None
        self.tts_model_name = tts_model_name
        self.vosk_model_dir = vosk_model_dir
        self._init_tts()
        self._init_stt()

    def _init_tts(self):
        if CoquiTTS:
            self.tts = CoquiTTS(self.tts_model_name)
        else:
            print("[Voice] Coqui TTS not installed. TTS will not work.")

    def _init_stt(self):
        if VoskModel and os.path.exists(self.vosk_model_dir):
            self.stt_model = VoskModel(self.vosk_model_dir)
        else:
            print("[Voice] Vosk model not found or Vosk not installed. STT will not work.")

    def speak(self, text: str, lang: Optional[str] = None, output_path: Optional[str] = None):
        """Synthesize speech from text in the specified language."""
        if not self.tts:
            raise RuntimeError("TTS engine not available.")
        if not lang and detect_lang:
            lang = detect_lang(text)
        wav = self.tts.tts(text, speaker=None, language=lang)
        if output_path:
            self.tts.save_wav(wav, output_path)
        return wav

    def recognize(self, audio_path: str, lang: str = "en") -> str:
        """Recognize speech from an audio file in the specified language."""
        if not self.stt_model:
            raise RuntimeError("STT engine not available.")
        wf = wave.open(audio_path, "rb")
        rec = KaldiRecognizer(self.stt_model, wf.getframerate())
        result = ""
        while True:
            data = wf.readframes(4000)
            if len(data) == 0:
                break
            if rec.AcceptWaveform(data):
                part = rec.Result()
                result += part
        result += rec.FinalResult()
        return result

    def detect_language(self, text: str) -> Optional[str]:
        if detect_lang:
            return detect_lang(text)
        return None

    # Placeholder for future paid service integration
    def set_tts_engine(self, tts_callable: Callable):
        self.tts = tts_callable

    def set_stt_engine(self, stt_callable: Callable):
        self.stt_model = stt_callable

# Example usage:
# voice = VoiceInterface()
# voice.speak("Hello, world!", lang="en", output_path="hello.wav")
# print(voice.recognize("hello.wav")) 