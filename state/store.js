import { INPUT_IDS } from "../model.js";

export function createStore({ inputs }) {
  const listeners = new Set();

  const initialInputValues = Object.fromEntries(
    INPUT_IDS.map((id) => [id, Number(inputs[id]?.value ?? 0)])
  );

  let state = {
    inputValues: initialInputValues,
    scope: "macro",
    focusStepIndex: 0,
    playback: {
      isPlaying: false
    },
    hardwareProfileKey: null
  };

  function getState() {
    return state;
  }

  function setState(updater) {
    const nextState = typeof updater === "function" ? updater(state) : { ...state, ...updater };
    state = nextState;
    listeners.forEach((listener) => listener(state));
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return { getState, setState, subscribe };
}
