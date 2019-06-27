import React, { useRef, useEffect } from "react";
import PropTypes from "prop-types";
import styles from "./styles.scss";
import Canvas from "./canvas";

const Graph = ({ nodes, edges, waypoint }) => {
  const domNode = useRef();
  const canvas = useRef();

  useEffect(() => {
    canvas.current = new Canvas(nodes, edges);
    return () => canvas.current.dispose();
  }, [nodes, edges, canvas]);

  useEffect(() => {
    domNode.current.appendChild(canvas.current.getRenderer().domElement);
    console.info("DOM node changed");
  }, [domNode.current, canvas]);

  return <div ref={domNode} />;
};

Graph.propTypes = {
  nodes: PropTypes.array.required,
  edges: PropTypes.array.required,
  waypoint: PropTypes.object
};

export default Graph;
