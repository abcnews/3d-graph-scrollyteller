import React, { useState, useEffect } from "react";
import styles from "./styles.scss";

export default ({ canvas }) => {
  const [data, setData] = useState();
  const [isOrbitalMode, setIsOrbitalMode] = useState(canvas.isOrbital);
  const [isExploreMode, setIsExploreMode] = useState(canvas.isExplore);

  useEffect(() => {
    canvas.onRender(setData);
  }, canvas);

  if (!data) return null;

  return (
    <div className={styles.root}>
      <button onClick={() => canvas.toggleAxesHelper()}>
        Toggle Axes Helper
      </button>
      <button onClick={() => canvas.toggleOriginHelper()}>
        Toggle Origin Helper
      </button>
      <button
        onClick={() => {
          setIsOrbitalMode(canvas.toggleOrbitalMode());
          setIsExploreMode(canvas.isExplore);
        }}
      >
        {isOrbitalMode ? "Disable" : "Enable"} Orbit
      </button>
      <button
        onClick={() => {
          setIsExploreMode(canvas.toggleExploreMode());
          setIsOrbitalMode(canvas.isOrbital);
        }}
      >
        {isExploreMode ? "Disable" : "Enable"} Explore
      </button>
      <span>angle: {Math.round(data.bearing.angle)}</span>
      <span>elevation: {Math.round(data.bearing.elevation)}</span>
      <span>distance: {Math.round(data.bearing.distance)}</span>
      <span>
        origin: {Math.round(data.bearing.origin.x)},
        {Math.round(data.bearing.origin.y)},{Math.round(data.bearing.origin.z)}
      </span>
      <span>
        camera: {Math.round(data.camera.position.x)},
        {Math.round(data.camera.position.y)},
        {Math.round(data.camera.position.z)}
      </span>
    </div>
  );
};
