import React, { useRef, useEffect } from 'react';
import styles from './styles.scss';
import { Scene, PerspectiveCamera, BoxGeometry, WebGLRenderer, MeshBasicMaterial, Mesh, Vector3 } from 'three';

import { forceSimulation, forceLink, forceManyBody, forceCenter } from 'd3-force-3d';
import { tsv } from 'd3-fetch';

Promise.all([tsv('/data/edges.tsv'), tsv('/data/nodes.tsv')]).then(([edges, nodes]) => {
  nodes = nodes.map(n => ({
    id: +n.ID - 1,
    label: n.Label,
    type: n.Category
  }));
  edges = edges.map(e => ({ source: +e.Source - 1, target: +e.Target - 1 }));

  const simulation = forceSimulation(nodes, 3)
    .force('link', forceLink(edges))
    .force('charge', forceManyBody())
    .force('center', forceCenter());
});

const width = 500;
const height = 400;
const scene = new Scene();
const camera = new PerspectiveCamera(75, width / height, 0.1, 1000);
const renderer = new WebGLRenderer();

const geometry = new BoxGeometry(1, 1, 1);
const material = new MeshBasicMaterial({ color: 0x00ff00 });
const cube = new Mesh(geometry, material);

const geometry2 = new BoxGeometry(1, 1, 1);
const material2 = new MeshBasicMaterial({ color: 0xff6633 });
const cube2 = new Mesh(geometry2, material2);
cube2.position.x = 10;

scene.add(cube);
scene.add(cube2);
renderer.setSize(width, height);

const initialBearing = { origin: cube.position, angle: 180, distance: 4 };
const targetBearing = { origin: cube2.position, angle: 20, distance: 3 };

// let theta = 0;
function animate() {
  // TODO: replace this abomination with the proper scroll checking from Odyssey/Scrollyteller
  const scrollPercent = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);

  // Calculate our lerped bearing
  const bearing = {
    origin: new Vector3(
      initialBearing.origin.x + (targetBearing.origin.x - initialBearing.origin.x) * scrollPercent,
      initialBearing.origin.y + (targetBearing.origin.y - initialBearing.origin.y) * scrollPercent,
      initialBearing.origin.z + (targetBearing.origin.z - initialBearing.origin.z) * scrollPercent
    ),
    angle: initialBearing.angle + (targetBearing.angle - initialBearing.angle) * scrollPercent,
    distance: initialBearing.distance + (targetBearing.distance - initialBearing.distance) * scrollPercent
  };

  const rad = (bearing.angle * Math.PI) / 180;
  const distance = bearing.distance;

  camera.position.x = bearing.origin.x + Math.cos(rad) * distance;
  camera.position.z = bearing.origin.z + Math.sin(rad) * distance;
  camera.position.y = bearing.origin.y + distance / 2;
  camera.lookAt(bearing.origin);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

animate();

export default props => {
  const node = useRef();
  useEffect(() => {
    node.current.appendChild(renderer.domElement);
  }, [node.current]);

  return <div ref={node} />;
};
