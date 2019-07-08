import React, { useState, useEffect } from "react";
import styles from "./styles.scss";

import Graph from "../Graph";
import Scrollyteller from "@abcnews/scrollyteller";

export default ({ panels, data }) => {
  const [nodes, setNodes] = useState();
  const [edges, setEdges] = useState();

  useEffect(() => {
    fetch(data)
      .then(res => res.json())
      .then(({ nodes, edges, groups }) => {
        setNodes(
          nodes.map((n, i) => ({
            label: n[1],
            shortLabel: n[3] || n[1],
            highlightColor: n[2],
            groups: groups.map(([name, membership]) => {
              return membership.includes(i) ? name : undefined;
            })
          }))
        );
        setEdges(edges.map(e => ({ source: e[0], target: e[1] })));
      })
      .catch(console.error);
  }, []);

  // TODO: Add loading indicator
  return (
    <Scrollyteller panels={panels} onMarker={() => {}}>
      {nodes && edges ? (
        <Graph nodes={nodes} edges={edges} panels={panels} />
      ) : null}
    </Scrollyteller>
  );
};
