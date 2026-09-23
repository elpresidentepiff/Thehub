/** Lets the beat navigation move the reader without knowing about Lenis or ScrollTrigger. */

type Navigate = (progress: number) => void;

let navigate: Navigate | null = null;

export const sequenceNav = {
  register(fn: Navigate) {
    navigate = fn;
    return () => {
      if (navigate === fn) navigate = null;
    };
  },
  to(progress: number) {
    navigate?.(progress);
  },
};
