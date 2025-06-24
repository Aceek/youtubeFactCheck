import { useEffect } from 'react';

export function useKeyboard(key, callback, dependencies = []) {
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key === key) {
        callback(event);
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, dependencies);
}

export function useEscapeKey(callback, dependencies = []) {
  useKeyboard('Escape', callback, dependencies);
}