export default function build(THREE) {
  const root = new THREE.Group();
  root.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x777777 }),
    ),
  );
  return root;
}
