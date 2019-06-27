import React, { useState, useEffect } from "react";
import styles from "./styles.scss";

import Graph from "../Graph";
import Scrollyteller from "@abcnews/scrollyteller";
import { tsv } from "d3-fetch";

export default ({ panels }) => {
  const [marker, setMarker] = useState();
  const [nodes, setNodes] = useState();
  const [edges, setEdges] = useState();

  useEffect(() => {
    Promise.all([tsv("/data/nodes.tsv"), tsv("/data/edges.tsv")]).then(
      ([nodes, edges]) => {
        setNodes(
          nodes.map(n => ({
            id: +n.ID - 1,
            label: n.Label,
            type: n.Category
          }))
        );
        setEdges(
          edges.map(e => ({ source: +e.Source - 1, target: +e.Target - 1 }))
        );
      }
    );
  }, []);

  return (
    <Scrollyteller
      panels={panels}
      onMarker={marker => {
        setMarker(marker);
      }}
    >
      {nodes && edges ? (
        <Graph nodes={nodes} edges={edges} waypoint={marker} />
      ) : null}
    </Scrollyteller>
  );
};
