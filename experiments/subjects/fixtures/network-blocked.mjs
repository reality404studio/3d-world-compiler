export default async function build(THREE) {
  let networkWasBlocked = false;
  try {
    await fetch("https://example.com", {
      signal: AbortSignal.timeout(1_000),
    });
  } catch {
    networkWasBlocked = true;
  }
  if (!networkWasBlocked) {
    throw new Error("Subject container unexpectedly reached the network.");
  }
  return new THREE.Group();
}
