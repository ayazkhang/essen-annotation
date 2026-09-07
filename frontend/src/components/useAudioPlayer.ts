import { computed, onMounted, onUnmounted, ref, toRef, watch } from 'vue';

export const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

export function useAudioPlayer(
  props: {
    src: string;
    tokens: string[];
    durationHint?: number | null;
  },
  emit: (event: 'seekToToken', index: number) => void,
) {
  const audioEl = ref<HTMLAudioElement | null>(null);
  const playing = ref(false);
  const current = ref(0);
  const duration = ref(0);
  const rate = ref(1);
  const showHelp = ref(true);
  const tokenList = toRef(props, 'tokens');

  const progress = computed(() =>
    duration.value > 0 ? Math.min(100, (current.value / duration.value) * 100) : 0,
  );

  function effectiveDuration(): number {
    const el = audioEl.value;
    const fromEl = el && Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 0;
    if (fromEl > 0) return fromEl;
    if (duration.value > 0) return duration.value;
    if (props.durationHint != null && props.durationHint > 0) return props.durationHint;
    return 0;
  }

  function toggle() {
    const el = audioEl.value;
    if (!el) return;
    if (el.paused) {
      void el.play();
    } else {
      el.pause();
    }
  }

  function seek(delta: number) {
    const el = audioEl.value;
    if (!el) return;
    const total = effectiveDuration() || el.currentTime + Math.abs(delta);
    el.currentTime = Math.max(0, Math.min(total, el.currentTime + delta));
    current.value = el.currentTime;
  }

  function onSeekBar(ev: Event) {
    const el = audioEl.value;
    const total = effectiveDuration();
    if (!el || !total) return;
    const value = Number((ev.target as HTMLInputElement).value);
    el.currentTime = (value / 100) * total;
    current.value = el.currentTime;
  }

  function setRate(r: number) {
    rate.value = r;
    if (audioEl.value) audioEl.value.playbackRate = r;
  }

  function onRateChange(ev: Event) {
    setRate(Number((ev.target as HTMLSelectElement).value));
  }

  function onPlay() {
    playing.value = true;
  }

  function onPause() {
    playing.value = false;
  }

  function onTimeUpdate() {
    current.value = audioEl.value?.currentTime ?? 0;
  }

  function onLoadedMetadata() {
    const el = audioEl.value;
    duration.value =
      (el && Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 0) ||
      props.durationHint ||
      0;
  }

  function toggleHelp(ev: Event) {
    ev.preventDefault();
    showHelp.value = !showHelp.value;
  }

  /** Equal share of duration per token (AI JSON has no word timings). */
  function timeForToken(index: number): number {
    const total = effectiveDuration();
    const count = tokenList.value.length;
    if (total <= 0 || count <= 0) return 0;
    const clamped = Math.max(0, Math.min(index, count - 1));
    return (clamped / count) * total;
  }

  function seekToToken(index: number) {
    const el = audioEl.value;
    if (!el) return;

    if (!(duration.value > 0) && props.durationHint != null && props.durationHint > 0) {
      duration.value = props.durationHint;
    }

    const t = timeForToken(index);
    el.currentTime = t;
    current.value = t;
    emit('seekToToken', index);

    if (el.paused) {
      void el.play().catch(() => undefined);
    }
  }

  function onKey(ev: KeyboardEvent) {
    const tag = (ev.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    switch (ev.key.toLowerCase()) {
      case ' ':
        ev.preventDefault();
        toggle();
        break;
      case 'arrowleft':
        ev.preventDefault();
        seek(ev.shiftKey ? -5 : -2);
        break;
      case 'arrowright':
        ev.preventDefault();
        seek(ev.shiftKey ? 5 : 2);
        break;
      case '[':
        setRate(Math.max(0.5, Math.round((rate.value - 0.25) * 100) / 100));
        break;
      case ']':
        setRate(Math.min(2, Math.round((rate.value + 0.25) * 100) / 100));
        break;
      case 'j':
        seek(-2);
        break;
      case 'l':
        seek(2);
        break;
      case 'k':
        toggle();
        break;
      default:
        break;
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', onKey);
    if (props.durationHint != null && props.durationHint > 0) {
      duration.value = props.durationHint;
    }
  });

  onUnmounted(() => {
    window.removeEventListener('keydown', onKey);
  });

  watch(
    () => props.src,
    () => {
      current.value = 0;
      playing.value = false;
      if (props.durationHint != null && props.durationHint > 0) {
        duration.value = props.durationHint;
      }
    },
  );

  return {
    SPEED_OPTIONS,
    audioEl,
    playing,
    current,
    duration,
    rate,
    showHelp,
    progress,
    toggle,
    seek,
    onSeekBar,
    onRateChange,
    onPlay,
    onPause,
    onTimeUpdate,
    onLoadedMetadata,
    toggleHelp,
    seekToToken,
    timeForToken,
  };
}
