import { INPUT_IDS, getScopeSteps, hardwareProfiles } from "../model.js";

export function createUIController({ ui, inputs, outputs, store, formatControlOutput, setActiveControlTab, toggleArchControls }) {
  function syncControlOutputs() {
    const { inputValues } = store.getState();
    for (const id of INPUT_IDS) {
      outputs[id].textContent = formatControlOutput(id, inputValues[id]);
    }
  }

  function setScope(scope) {
    store.setState((prev) => ({ ...prev, scope, focusStepIndex: 0 }));
    for (const button of ui.scopeButtons) {
      button.classList.toggle("is-active", button.dataset.scope === scope);
    }
  }

  function stepFocus(delta) {
    const { scope, focusStepIndex } = store.getState();
    const steps = getScopeSteps(scope);
    if (steps.length === 0) return;

    store.setState((prev) => ({
      ...prev,
      playback: { ...prev.playback, isPlaying: false },
      focusStepIndex: (focusStepIndex + delta + steps.length) % steps.length
    }));
  }

  function applyHardwareProfile(profileKey) {
    const profile = hardwareProfiles[profileKey];
    if (!profile) return;

    for (const [key, value] of Object.entries(profile)) {
      if (inputs[key]) {
        inputs[key].value = String(value);
      }
    }

    store.setState((prev) => ({
      ...prev,
      hardwareProfileKey: profileKey,
      inputValues: {
        ...prev.inputValues,
        ...Object.fromEntries(Object.entries(profile).map(([key, value]) => [key, Number(value)]))
      }
    }));
  }

  function bind() {
    for (const id of INPUT_IDS) {
      inputs[id].addEventListener("input", (event) => {
        const value = Number(event.target.value);
        store.setState((prev) => ({
          ...prev,
          hardwareProfileKey: null,
          inputValues: { ...prev.inputValues, [id]: value }
        }));
      });
    }

    for (const button of ui.scopeButtons) {
      button.addEventListener("click", () => {
        setScope(button.dataset.scope || "macro");
      });
    }

    ui.focusPrev.addEventListener("click", () => stepFocus(-1));
    ui.focusNext.addEventListener("click", () => stepFocus(1));

    ui.hardwareProfile?.addEventListener("change", (event) => {
      applyHardwareProfile(event.target.value);
    });

    for (const tab of ui.archTabs) {
      tab.addEventListener("click", () => {
        setActiveControlTab(tab.dataset.tab || "workload");
      });
    }

    ui.archControlsToggle?.addEventListener("click", () => {
      toggleArchControls();
    });

    if (ui.hardwareProfile?.value) {
      applyHardwareProfile(ui.hardwareProfile.value);
    } else {
      syncControlOutputs();
    }
  }

  return { bind, syncControlOutputs };
}
