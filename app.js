const state = {
  activeStage: null,
};

const sections = document.querySelectorAll(".content-section");
const steps = document.querySelectorAll(".progress-step");
const flowBars = document.querySelectorAll("#flowBars .flow-bar");
const cacheRows = document.querySelectorAll("#cacheTableBody tr");

function setActiveStage(nextStage) {
  if (!nextStage || state.activeStage === nextStage) return;
  state.activeStage = nextStage;

  steps.forEach((step) => {
    step.classList.toggle("active", step.dataset.stage === state.activeStage);
  });

  flowBars.forEach((bar) => {
    bar.classList.toggle("highlight-item", state.activeStage === "pipeline");
  });

  cacheRows.forEach((row) => {
    row.classList.toggle("highlight-item", state.activeStage === "stats");
  });
}

const observer = new IntersectionObserver(
  (entries) => {
    const visibleEntries = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

    if (visibleEntries.length > 0) {
      setActiveStage(visibleEntries[0].target.dataset.stage);
    }
  },
  {
    root: null,
    threshold: [0.3, 0.6, 0.8],
    rootMargin: "-10% 0px -30% 0px",
  }
);

sections.forEach((section) => observer.observe(section));
setActiveStage(sections[0]?.dataset.stage);
