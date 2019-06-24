import React, { useRef, useEffect } from "react";
import styles from "./styles.scss";
import {
  Scene,
  PerspectiveCamera,
  CircleGeometry,
  WebGLRenderer,
  MeshBasicMaterial,
  Vector3,
  Mesh
} from "three";

import * as THREE from "three";

import { OrbitControls } from "../../lib/OrbitControls";

import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter
} from "d3-force-3d";

import { tsv } from "d3-fetch";

const width = window.innerWidth;
const height = window.innerHeight;

const scene = new Scene();
const camera = new PerspectiveCamera(75, width / height, 0.1, 1000);
const renderer = new WebGLRenderer();
// const controls = new OrbitControls(camera, renderer.domElement);
const origin = new Vector3();

camera.position.z = 5;
renderer.setSize(width, height);
renderer.setPixelRatio(window.devicePixelRatio);

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

    nodes.forEach(node => {
      const geometry = new CircleGeometry(5, 32);
      const material = new MeshBasicMaterial({ color: 0xffff00 });
      const circle = new Mesh(geometry, material);

      material.transparent = true;
      material.opacity = 0.2;

      circle.translateX(node.x);
      circle.translateY(node.y);
      circle.translateZ(node.z);

      scene.add(circle);

      node.obj = circle;
      node.material = material;
    });

    animate(nodes);
  }
);

function animate(nodes) {
  let rafRef;

  const node1 = nodes[Math.floor(nodes.length * Math.random())];
  const node2 = nodes[Math.floor(nodes.length * Math.random())];

  const initialBearing = {
    origin: node1.obj.position,
    angle: 180,
    distance: 200
  };
  const targetBearing = {
    origin: node2.obj.position,
    angle: 20,
    distance: 150
  };

  const loop = () => {
    // TODO: replace this abomination with the proper scroll checking from Odyssey/Scrollyteller
    const scrollPercent =
      window.scrollY /
      (document.documentElement.scrollHeight - window.innerHeight);

    // Calculate our lerped bearing
    const bearing = {
      origin: new Vector3(
        initialBearing.origin.x +
          (targetBearing.origin.x - initialBearing.origin.x) * scrollPercent,
        initialBearing.origin.y +
          (targetBearing.origin.y - initialBearing.origin.y) * scrollPercent,
        initialBearing.origin.z +
          (targetBearing.origin.z - initialBearing.origin.z) * scrollPercent
      ),
      angle:
        initialBearing.angle +
        (targetBearing.angle - initialBearing.angle) * scrollPercent,
      distance:
        initialBearing.distance +
        (targetBearing.distance - initialBearing.distance) * scrollPercent
    };

    const rad = (bearing.angle * Math.PI) / 180;
    const distance = bearing.distance;

    node1.material.opacity = 1 - scrollPercent;
    node2.material.opacity = scrollPercent;

    camera.position.x = bearing.origin.x + Math.cos(rad) * distance;
    camera.position.z = bearing.origin.z + Math.sin(rad) * distance;
    camera.position.y = bearing.origin.y + distance / 2;
    camera.lookAt(bearing.origin);

    // Make sure the nodes face the camera
    nodes.forEach(n => {
      n.obj.lookAt(camera.position);
    });

    renderer.render(scene, camera);
    rafRef = requestAnimationFrame(loop);
  };

  loop.stop = () => {
    cancelAnimationFrame(rafRef);
  };

  loop();

  return loop;
}

export default props => {
  const node = useRef();
  useEffect(() => {
    node.current.appendChild(renderer.domElement);
  }, [node.current]);

  return <div ref={node} />;
};
