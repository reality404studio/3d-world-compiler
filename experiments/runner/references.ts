import { readFile } from "node:fs/promises";
import path from "node:path";
import { EXPERIMENTS_ROOT } from "./config";
import { ExperimentFailure } from "./failures";

const ASSET_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/;

export interface ReferenceRegistration {
  version: "reference-registration-v1";
  asset_id: string;
  expected_filename: string;
  expected_sha256: string;
  status: "approved";
  purpose: "calibration";
}

export const REFERENCE_REGISTRY_DIRECTORY = path.join(
  EXPERIMENTS_ROOT,
  "references",
  "registry",
);

function isApprovedRegistration(value: unknown): value is ReferenceRegistration {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.version === "reference-registration-v1" &&
    typeof record.asset_id === "string" &&
    typeof record.expected_filename === "string" &&
    typeof record.expected_sha256 === "string" &&
    /^[a-f0-9]{64}$/.test(record.expected_sha256) &&
    record.status === "approved" &&
    record.purpose === "calibration"
  );
}

export async function requireRegisteredReference(
  assetId: string,
  referenceSha256: string,
  registryDirectory = REFERENCE_REGISTRY_DIRECTORY,
): Promise<ReferenceRegistration> {
  if (!ASSET_ID_PATTERN.test(assetId)) {
    throw new ExperimentFailure(
      "REFERENCE_NOT_REGISTERED",
      `Reference asset is not registered: ${assetId}`,
    );
  }

  let registration: unknown;
  try {
    registration = JSON.parse(
      await readFile(path.join(registryDirectory, `${assetId}.json`), "utf8"),
    );
  } catch (error) {
    throw new ExperimentFailure(
      "REFERENCE_NOT_REGISTERED",
      `Reference asset is not registered: ${assetId}`,
      error,
    );
  }

  if (!isApprovedRegistration(registration) || registration.asset_id !== assetId) {
    throw new ExperimentFailure(
      "REFERENCE_NOT_REGISTERED",
      `Reference asset does not have a matching approved registration: ${assetId}`,
    );
  }
  if (registration.expected_sha256 !== referenceSha256) {
    throw new ExperimentFailure(
      "REFERENCE_HASH_MISMATCH",
      `Reference SHA-256 does not match the approved registration: ${assetId}`,
      {
        asset_id: assetId,
        expected_sha256: registration.expected_sha256,
        actual_sha256: referenceSha256,
      },
    );
  }
  return registration;
}
