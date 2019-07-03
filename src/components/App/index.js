import React, { useState, useEffect } from "react";
import styles from "./styles.scss";

import Graph from "../Graph";
import Scrollyteller from "@abcnews/scrollyteller";
import { csv } from "d3-fetch";

export default ({ panels, nodeData, edgeData, groupData }) => {
  const [nodes, setNodes] = useState();
  const [edges, setEdges] = useState();

  useEffect(() => {
    Promise.all([csv(nodeData), csv(edgeData), csv(groupData)])
      .then(([nodes, edges, groups]) => {
        setNodes(
          nodes.map(n => ({
            id: +n.ID - 1,
            label: n.Label,
            type: n.Category,
            groups: groups.map(({ membership, name }) => {
              return membership
                .split(",")
                .map(m => m.trim())
                .includes(n.Label)
                ? name.toLowerCase()
                : undefined;
            })
          }))
        );
        setEdges(
          edges
            .filter(e => e.Source !== "#N/A" && e.Target !== "#N/A")
            .map(e => ({ source: +e.Source - 1, target: +e.Target - 1 }))
        );
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
