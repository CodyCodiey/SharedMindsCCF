/**
 * Speech input with a keyboard fallback. Both paths call the same
 * onPhrase(text, isFinal) callback, so nothing downstream can tell them apart.
 */
const MAX_NETWORK_RETRIES = 4;

export function createSpeech({ onPhrase, onStatus }) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const supported = Boolean(Recognition);
  let recognition = null;
  let wanted = false;   // user intent, so an auto-end can be distinguished
  let networkFails = 0; // consecutive 'network' errors, for backoff
  let restartTimer = null;

  if (supported) {
    recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) onPhrase(text, true);
        else interim += text;
      }
      onPhrase(interim, false);
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return;

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        wanted = false;
        onStatus('mic blocked — type instead', false);
        return;
      }

      // 'network' means the browser could not reach its speech backend.
      // It is often transient, so back off and retry a few times before
      // giving up and handing the user to the keyboard.
      if (event.error === 'network') {
        networkFails++;
        if (networkFails > MAX_NETWORK_RETRIES) {
          wanted = false;
          onStatus('speech offline — use Chrome, or type', false);
        } else {
          onStatus(`reconnecting (${networkFails}/${MAX_NETWORK_RETRIES})`, true);
        }
        return;
      }

      onStatus(`mic error: ${event.error}`, wanted);
    };

    // Chrome ends the session on silence; restart while the user still wants
    // it. After a network failure the restart is delayed, so a dead backend
    // is not hammered several times a second.
    recognition.onend = () => {
      clearTimeout(restartTimer);
      if (!wanted) {
        onStatus('paused', false);
        return;
      }
      const delay = networkFails ? Math.min(800 * 2 ** (networkFails - 1), 8000) : 0;
      restartTimer = setTimeout(() => {
        if (!wanted) return;
        try {
          recognition.start();
        } catch {
          wanted = false;
          onStatus('paused', false);
        }
      }, delay);
    };

    // A clean session means whatever was wrong has cleared.
    recognition.onresult = ((inner) => (event) => {
      networkFails = 0;
      inner(event);
    })(recognition.onresult);
  }

  return {
    supported,
    get active() { return wanted; },
    start() {
      if (!supported) {
        onStatus('no speech api — type instead', false);
        return false;
      }
      wanted = true;
      networkFails = 0;
      try {
        recognition.start();
      } catch {
        // start() throws if already running; that is fine.
      }
      onStatus('listening', true);
      return true;
    },
    stop() {
      wanted = false;
      clearTimeout(restartTimer);
      if (supported) recognition.stop();
      onStatus('paused', false);
    },
    toggle() {
      return wanted ? (this.stop(), false) : this.start();
    },
  };
}
