import React, { useState, useEffect, useCallback, useRef } from "react";

export interface UseModuleFullscreenOptions {
  moduleId?: string;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  preferNative?: boolean;
}

export interface UseModuleFullscreenReturn {
  isFullscreen: boolean;
  isNativeFullscreen: boolean;
  toggleFullscreen: () => void;
  enterFullscreen: () => void;
  exitFullscreen: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function useModuleFullscreen(
  options: UseModuleFullscreenOptions = {}
): UseModuleFullscreenReturn {
  const { moduleId, onFullscreenChange, preferNative = true } = options;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState<boolean>(false);

  // Sync state changes with callback and document body class
  const updateFullscreenState = useCallback(
    (active: boolean, isNative: boolean) => {
      setIsFullscreen(active);
      setIsNativeFullscreen(isNative);
      if (active) {
        document.body.classList.add("bioazucar-module-fullscreen-active");
      } else {
        document.body.classList.remove("bioazucar-module-fullscreen-active");
      }
      onFullscreenChange?.(active);
    },
    [onFullscreenChange]
  );

  const enterFullscreen = useCallback(async () => {
    if (preferNative && typeof document !== "undefined") {
      const targetElement = containerRef.current || document.documentElement;
      if (targetElement && targetElement.requestFullscreen && !document.fullscreenElement) {
        try {
          await targetElement.requestFullscreen();
          updateFullscreenState(true, true);
          return;
        } catch {
          // Native fullscreen failed (e.g. iframe permissions), fallback to pure CSS viewport fullscreen
        }
      }
    }
    // Safe visual CSS fallback
    updateFullscreenState(true, false);
  }, [preferNative, updateFullscreenState]);

  const exitFullscreen = useCallback(async () => {
    if (typeof document !== "undefined" && document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // Ignored, fallback handling below
      }
    }
    updateFullscreenState(false, false);
  }, [updateFullscreenState]);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  // Listen to native fullscreen changes
  useEffect(() => {
    const handleNativeChange = () => {
      if (typeof document === "undefined") return;
      const isNative = Boolean(document.fullscreenElement);
      if (isNative) {
        updateFullscreenState(true, true);
      } else if (isNativeFullscreen) {
        // Native was exited (e.g. user pressed Esc in browser)
        updateFullscreenState(false, false);
      }
    };

    document.addEventListener("fullscreenchange", handleNativeChange);
    document.addEventListener("webkitfullscreenchange", handleNativeChange as any);

    return () => {
      document.removeEventListener("fullscreenchange", handleNativeChange);
      document.removeEventListener("webkitfullscreenchange", handleNativeChange as any);
    };
  }, [isNativeFullscreen, updateFullscreenState]);

  // Handle ESC key for visual fallback mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        exitFullscreen();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, exitFullscreen]);

  // Clean up on unmount or module transition
  useEffect(() => {
    return () => {
      document.body.classList.remove("bioazucar-module-fullscreen-active");
    };
  }, [moduleId]);

  return {
    isFullscreen,
    isNativeFullscreen,
    toggleFullscreen,
    enterFullscreen,
    exitFullscreen,
    containerRef,
  };
}
