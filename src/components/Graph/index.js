import React, { useRef, useEffect, useState } from "react";
import PropTypes from "prop-types";
import styles from "./styles.scss";
import Canvas from "./canvas";

const Graph = ({ nodes, edges, panels }) => {
  const domNode = useRef();
  const canvas = useRef();

  const [isOrbital, setIsOrbital] = useState(false);

  console.info("Graph re-render");
  console.log("panels", panels);

  const toggleOrbital = () => {
    if (!isOrbital) setIsOrbital(true);
    else setIsOrbital(false);
  }

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
