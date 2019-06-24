import React, { useState } from "react";
import styles from "./styles.scss";
import worm from "./worm.svg";

import Graph from "../Graph";
import Scrollyteller from "@abcnews/scrollyteller";

export default ({ panels, projectName }) => {
  const [marker, setMarker] = useState();

  return (
    <Scrollyteller
      panels={panels}
      onMarker={marker => {
        setMarker(marker);
      }}
    >
      <div className={styles.root}>
        <img className={styles.worm} src={worm} />
        <h1>{projectName}</h1>
        <Graph />
      </div>
    </Scrollyteller>
  );
};
