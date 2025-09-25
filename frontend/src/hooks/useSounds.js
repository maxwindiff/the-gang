import { useCallback, useRef } from 'react';

export const useSounds = () => {
  const audioContextRef = useRef(null);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  const playTone = useCallback((frequency, duration, type = 'sine', volume = 0.1) => {
    try {
      const audioContext = getAudioContext();
      
      // Resume context if suspended (required for user interaction)
      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      oscillator.type = type;

      gainNode.gain.setValueAtTime(0, audioContext.currentTime);
      gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
    } catch (error) {
      console.warn('Could not play sound:', error);
    }
  }, [getAudioContext]);

  const playChipTaken = useCallback(() => {
    // Pleasant ascending chime - increased by 30%
    playTone(523.25, 0.1, 'sine', 0.195); // C5 (0.15 * 1.3)
    setTimeout(() => playTone(659.25, 0.15, 'sine', 0.156), 80); // E5 (0.12 * 1.3)
  }, [playTone]);

  const playChipStolen = useCallback(() => {
    // Sharp descending sound - increased by 10%
    playTone(880, 0.08, 'square', 0.11); // A5 (0.1 * 1.1)
    setTimeout(() => playTone(659.25, 0.12, 'square', 0.088), 60); // E5 (0.08 * 1.1)
    setTimeout(() => playTone(523.25, 0.15, 'square', 0.066), 120); // C5 (0.06 * 1.1)
  }, [playTone]);

  const playNextRound = useCallback(() => {
    // Triumphant fanfare-like sound
    playTone(261.63, 0.2, 'triangle', 0.08); // C4
    setTimeout(() => playTone(329.63, 0.2, 'triangle', 0.08), 150); // E4
    setTimeout(() => playTone(392.00, 0.3, 'triangle', 0.1), 300); // G4
  }, [playTone]);

  return {
    playChipTaken,
    playChipStolen,
    playNextRound
  };
};