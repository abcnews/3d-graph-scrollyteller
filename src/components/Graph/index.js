import React, { useRef, useEffect } from "react";
import styles from "./styles.scss";
import {
  Scene,
  PerspectiveCamera,
  BoxGeometry,
  WebGLRenderer,
  MeshBasicMaterial,
  Mesh
} from "three";

import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter
} from "d3-force-3d";
import { tsv } from "d3-fetch";

Promise.all([tsv("/data/edges.tsv"), tsv("/data/nodes.tsv")]).then(
  ([edges, nodes]) => {
    nodes = nodes.map(n => ({
      id: +n.ID - 1,
      label: n.Label,
      type: n.Category
    }));
    edges = edges.map(e => ({ source: +e.Source - 1, target: +e.Target - 1 }));

    const simulation = forceSimulation(nodes, 3)
      .force("link", forceLink(edges))
      .force("charge", forceManyBody())
      .force("center", forceCenter());
  }
);

const width = 500;
const height = 400;
const scene = new Scene();
const camera = new PerspectiveCamera(75, width / height, 0.1, 1000);
const geometry = new BoxGeometry(1, 1, 1);
const renderer = new WebGLRenderer();
const material = new MeshBasicMaterial({ color: 0x00ff00 });
const cube = new Mesh(geometry, material);

scene.add(cube);
camera.position.z = 5;
renderer.setSize(width, height);

let cam = 0;
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
  cube.rotation.x += 0.01;
  cube.rotation.y += 0.01;
  cam = (cam + 0.1) % 20;
  camera.position.z = Math.abs(cam - 10) + 3;
}

animate();

export default props => {
  const node = useRef();
  useEffect(() => {
    node.current.appendChild(renderer.domElement);
  }, [node.current]);

  return <div ref={node} />;
};
