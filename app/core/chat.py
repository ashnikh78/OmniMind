from typing import List, Optional, Dict, Any

try:
    from transformers import pipeline, AutoModelForCausalLM, AutoTokenizer
except ImportError:
    pipeline = None
    AutoModelForCausalLM = None
    AutoTokenizer = None

try:
    from langdetect import detect as detect_lang
except ImportError:
    detect_lang = None

try:
    from deep_translator import GoogleTranslator
except ImportError:
    GoogleTranslator = None

try:
    from textblob import TextBlob
except ImportError:
    TextBlob = None

class ChatInterface:
    def __init__(self, model_name: str = "microsoft/DialoGPT-medium"):
        self.model_name = model_name
        self.generator = None
        self.tokenizer = None
        self.context: List[str] = []
        self._init_model()

    def _init_model(self):
        if pipeline and AutoModelForCausalLM and AutoTokenizer:
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            model = AutoModelForCausalLM.from_pretrained(self.model_name)
            self.generator = pipeline("text-generation", model=model, tokenizer=self.tokenizer)
        else:
            print("[Chat] Transformers not installed. Chat will not work.")

    def detect_language(self, text: str) -> Optional[str]:
        if detect_lang:
            return detect_lang(text)
        return None

    def translate(self, text: str, target_lang: str) -> str:
        if GoogleTranslator:
            return GoogleTranslator(source='auto', target=target_lang).translate(text)
        return text

    def analyze_sentiment(self, text: str) -> Optional[str]:
        if TextBlob:
            blob = TextBlob(text)
            polarity = blob.sentiment.polarity
            if polarity > 0.2:
                return "positive"
            elif polarity < -0.2:
                return "negative"
            else:
                return "neutral"
        return None

    def set_tone(self, text: str, tone: str = "neutral") -> str:
        # Simple tone adjustment (placeholder for more advanced logic)
        if tone == "friendly":
            return f"😊 {text}"
        elif tone == "formal":
            return f"Dear user, {text}"
        return text

    def chat(self, user_input: str, user_lang: Optional[str] = None, tone: str = "neutral") -> Dict[str, Any]:
        # Detect language if not provided
        if not user_lang:
            user_lang = self.detect_language(user_input) or "en"
        # Translate to English for model if needed
        input_for_model = user_input
        if user_lang != "en":
            input_for_model = self.translate(user_input, "en")
        # Maintain context
        self.context.append(input_for_model)
        context_text = "\n".join(self.context[-5:])  # last 5 exchanges
        # Generate response
        if not self.generator:
            return {"error": "Chat model not available."}
        response = self.generator(context_text, max_length=256, num_return_sequences=1)[0]["generated_text"][len(context_text):].strip()
        # Sentiment analysis
        sentiment = self.analyze_sentiment(response)
        # Tone adjustment
        response_toned = self.set_tone(response, tone)
        # Translate back to user language if needed
        if user_lang != "en":
            response_toned = self.translate(response_toned, user_lang)
        # Update context
        self.context.append(response)
        return {
            "response": response_toned,
            "sentiment": sentiment,
            "language": user_lang
        }

    def reset_context(self):
        self.context = []

# Example usage:
# chat = ChatInterface()
# print(chat.chat("Bonjour, comment ça va?", tone="friendly")) 