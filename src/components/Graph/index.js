import React, { useRef, useEffect } from "react";
import PropTypes from "prop-types";
import styles from "./styles.scss";
import Canvas from "./canvas";

const Graph = ({ nodes, edges, panels }) => {
  const domNode = useRef();
  const canvas = useRef();

  console.info("Graph re-render");
  console.log("panels", panels);

  useEffect(() => {
    console.info("Creating canvas");
    canvas.current = new Canvas(nodes, edges, panels);
    window.toggleAxesHelper = () => {
      canvas.current.toggleAxesHelper();
    };
    return () => canvas.current.dispose();
  }, [nodes, edges, canvas]);

  useEffect(() => {
    domNode.current.appendChild(canvas.current.getRenderer().domElement);
    console.info("DOM node changed");
  }, [domNode.current, canvas]);

  useEffect(() => {
    const resize = () => {
      canvas.current.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  });

  return <div ref={domNode} />;
};

Graph.propTypes = {
  nodes: PropTypes.array.isRequired,
  edges: PropTypes.array.isRequired,
  panels: PropTypes.array.isRequired
};

export default Graph;
