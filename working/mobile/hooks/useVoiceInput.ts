import { useState, useCallback, useRef, useEffect } from "react";
import { Alert } from "react-native";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";

interface UseVoiceInputProps {
  lang?: string;
  onResult: (transcript: string) => void;
}

export function useVoiceInput({
  lang = "en-US",
  onResult,
}: UseVoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const onResultRef = useRef(onResult);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useSpeechRecognitionEvent("start", () => setIsListening(true));
  useSpeechRecognitionEvent("end", () => setIsListening(false));
  useSpeechRecognitionEvent("error", (event) => {
    console.error("Speech recognition error:", event.error, event.message);
    setIsListening(false);
  });
  
  useSpeechRecognitionEvent("result", (event) => {
    // The final or most confident result is usually the first one.
    if (event.isFinal && event.results.length > 0) {
      const transcript = event.results[0]?.transcript;
      if (transcript && onResultRef.current) {
        onResultRef.current(transcript);
      }
    }
  });

  const startListening = useCallback(async () => {
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permission Required",
          "Voice input requires microphone and speech recognition permissions.",
        );
        return;
      }

      // Stop any existing session before starting a new one
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch (e) {
        // ignore
      }

      ExpoSpeechRecognitionModule.start({
        lang,
        interimResults: false,
        requiresOnDeviceRecognition: false,
      });
    } catch (e: any) {
      console.error("Failed to start speech recognition:", e);
      Alert.alert("Error", e.message || "Could not start voice recognition.");
      setIsListening(false);
    }
  }, [lang]);

  const stopListening = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch (e) {
      // Ignore
    }
    setIsListening(false);
  }, []);

  return { isListening, startListening, stopListening };
}
