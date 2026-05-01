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
        await ExpoSpeechRecognitionModule.stop();
      } catch (e: unknown) {
        console.warn("Failed to cleanly stop speech recognition module:", e);
      }

      ExpoSpeechRecognitionModule.start({
        lang,
        interimResults: false,
        requiresOnDeviceRecognition: false,
      });
    } catch (e: unknown) {
      console.error("Failed to start speech recognition:", e);
      const errorMessage = e instanceof Error ? e.message : "Could not start voice recognition.";
      Alert.alert("Error", errorMessage);
      setIsListening(false);
    }
  }, [lang]);

  const stopListening = useCallback(async () => {
    try {
      await ExpoSpeechRecognitionModule.stop();
    } catch (e: unknown) {
      console.warn("Failed to cleanly stop speech recognition module:", e);
    }
    setIsListening(false);
  }, []);

  return { isListening, startListening, stopListening };
}
