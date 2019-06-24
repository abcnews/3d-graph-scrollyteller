import React, { useState } from "react";
import styles from "./styles.scss";

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
      <Graph />
    </Scrollyteller>
  );
};
