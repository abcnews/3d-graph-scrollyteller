import React, { useState, useEffect } from "react";
import styles from "./styles.scss";

export default ({ canvas }) => {
  const [data, setData] = useState();

  useEffect(() => {
    canvas.onRender(setData);
  }, canvas);

  if (!data) return null;

  return (
    <div className={styles.root}>
      <button onClick={() => canvas.toggleAxesHelper()}>
        Toggle Axes Helper
      </button>
      <button onClick={() => canvas.toggleOrbitalMode()}>
        Toggle Orbit
      </button>
      <button onClick={() => canvas.toggleExploreMode()}>
        Toggle Explore
      </button>
      <span>angle: {Math.round(data.bearing.angle)}; </span>
      <span>distance: {Math.round(data.bearing.distance)}; </span>
      <span>phi: {Math.round(data.bearing.phi)}; </span>
      <span>origin.x: {Math.round(data.bearing.origin.x)}; </span>
      <span>origin.y: {Math.round(data.bearing.origin.y)}; </span>
      <span>origin.z: {Math.round(data.bearing.origin.z)}</span>
    </div>
  );
};
