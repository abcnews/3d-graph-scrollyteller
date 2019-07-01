import React, { useState, useEffect } from "react";
import styles from "./styles.scss";

import Graph from "../Graph";
import Scrollyteller from "@abcnews/scrollyteller";
import { tsv } from "d3-fetch";

export default ({ panels, nodeData, edgeData, groupData }) => {
  const [marker, setMarker] = useState();
  const [nodes, setNodes] = useState();
  const [edges, setEdges] = useState();

  useEffect(() => {
    Promise.all([tsv(nodeData), tsv(edgeData), tsv(groupData)])
      .then(([nodes, edges, groups]) => {
        setNodes(
          nodes.map(n => ({
            id: +n.ID - 1,
            label: n.Label,
            type: n.Category,
            groups: groups.map(group => {
              return group.membership
                .split(",")
                .map(m => m.trim())
                .includes(n.Label)
                ? group.name.toLowerCase()
                : undefined;
            })
          }))
        );
        setEdges(
          edges.map(e => ({ source: +e.Source - 1, target: +e.Target - 1 }))
        );
      })
      .catch(console.error);
  }, []);

  return (
    <Scrollyteller
      panels={panels}
      onMarker={marker => {
        setMarker(marker);
      }}
      scrollTween={(progress, panel, px) => {
        // console.log("progress", progress);
        // console.log("panel", panel);
        // console.log("px", px);
      }}
    >
      {nodes && edges ? (
        <Graph nodes={nodes} edges={edges} panels={panels} />
      ) : null}
    </Scrollyteller>
  );
};
