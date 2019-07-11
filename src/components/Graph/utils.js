export const getKeyframePanels = (panels, fold) => {
  const panelsAboveTheFold = panels.filter(panel => {
    if (!panel.element) return false;
    const box = panel.element.getBoundingClientRect();
    return box.height !== 0 && box.top < fold;
  });

  const prevPanelIndex = panelsAboveTheFold.length - 1;
  const prevPanel = panels[prevPanelIndex];
  const nextPanel = panels[prevPanelIndex + 1];

  return [prevPanel, nextPanel];
};

export const getProgressBetween = (
  panelA,
  panelB,
  fold,
  panelSeparation = 0
) => {
  // If we have a panelA we want percentage of that panel which is above the fold
  if (panelA) {
    const panelABounds = panelA.element.getBoundingClientRect();
    return (
      Math.ceil(fold + panelABounds.height - panelABounds.bottom) /
      (panelSeparation + panelABounds.height)
    );
  }

  // If there is no panelA, panelB is the first panel
  // For a 'fold' length transition to the first keyframePanel we want
  // the inverse of the percentage of fold distance away from the top of the panel
  if (panelB) {
    const panelBBounds = panelB.element.getBoundingClientRect();
    return Math.max(0, 1 - Math.ceil(panelBBounds.top - fold) / fold);
  }

  // If there are no panels, assume a complete transition.
  return 1;
};
