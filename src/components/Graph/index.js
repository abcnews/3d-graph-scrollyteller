import React, { useRef, useEffect } from "react";
import styles from "./styles.scss";
import {
  Scene,
  PerspectiveCamera,
  CircleGeometry,
  Line,
  WebGLRenderer,
  MeshBasicMaterial,
  LineBasicMaterial,
  Vector3,
  Mesh,
  Geometry
} from "three";

import * as THREE from "three";

import { OrbitControls } from "../../lib/OrbitControls";

import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide
} from "d3-force-3d";

import { tsv } from "d3-fetch";

const width = window.innerWidth;
const height = window.innerHeight;

const scene = new Scene();
const camera = new PerspectiveCamera(75, width / height, 0.1, 1000);
const renderer = new WebGLRenderer();
// const controls = new OrbitControls(camera, renderer.domElement);
const origin = new Vector3();

camera.position.z = 500;
renderer.setSize(width, height);
renderer.setPixelRatio(window.devicePixelRatio);

const linkForce = forceLink();
const simulation = forceSimulation([], 3)
  .force("link", linkForce.distance(30))
  .force("charge", forceManyBody().strength(-30))
  .force("center", forceCenter())
  .force("colide", forceCollide(10))
  .stop();

Promise.all([tsv("/data/edges.tsv"), tsv("/data/nodes.tsv")]).then(
  ([edges, nodes]) => {
    nodes = nodes.map(n => ({
      id: +n.ID - 1,
      label: n.Label,
      type: n.Category
    }));
    edges = edges.map(e => ({ source: +e.Source - 1, target: +e.Target - 1 }));

    simulation.nodes(nodes);
    linkForce.links(edges);

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

    edges.forEach(edge => {
      const geometry = new Geometry();
      const material = new LineBasicMaterial({
        color: 0x00ff00,
        linewidth: 100
      });

      geometry.vertices.push(
        new Vector3(edge.source.x, edge.source.y, edge.source.z),
        new Vector3(edge.target.x, edge.target.y, edge.target.z)
      );

      const line = new Line(geometry, material);

      scene.add(line);

      edge.obj = line;
      edge.material = material;
      edge.geometry = geometry;
    });

    animate(nodes, edges);
  }
);

function animate(nodes, edges) {
  let rafRef;
  let lastScrollPct = null;

  const node1 = nodes[Math.floor(nodes.length * Math.random())];
  const node2 = nodes[Math.floor(nodes.length * Math.random())];

  const initialBearing = {
    origin: node1.obj.position,
    angle: 180,
    distance: 500
  };
  const targetBearing = {
    origin: node2.obj.position,
    angle: 20,
    distance: 200
  };

  let linesDrawn = false;

  const loop = () => {
    // TODO: replace this abomination with the proper scroll checking from Odyssey/Scrollyteller
    const scrollPercent =
      window.scrollY /
      (document.documentElement.scrollHeight - window.innerHeight);

    // Don't re-render on every frame, you fool.
    if (
      lastScrollPct === scrollPercent &&
      simulation.alpha() <= simulation.alphaMin()
    ) {
      rafRef = requestAnimationFrame(loop);
      return;
    }

    if (simulation.alpha() > simulation.alphaMin()) {
      simulation.tick();
    }

    lastScrollPct = scrollPercent;

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
      n.obj.position.set(n.x, n.y, n.z);
    });

    edges.forEach(e => {
      e.geometry.vertices = [
        new Vector3(e.source.x, e.source.y, e.source.z),
        new Vector3(e.target.x, e.target.y, e.target.z)
      ];
      e.geometry.verticesNeedUpdate = true;
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
