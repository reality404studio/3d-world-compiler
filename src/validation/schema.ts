import Ajv, { type ErrorObject, type ValidateFunction } from "ajv";
import assemblySchema from "../../protocol/assembly.schema.json";
import worldSchema from "../../protocol/world.schema.json";
import type { ValidationIssue, ValidationResult } from "../types";

const ajv = new Ajv({
  allErrors: true,
  strict: true,
  strictNumbers: false,
});

const assemblyValidator = ajv.compile(assemblySchema) as ValidateFunction;
const worldValidator = ajv.compile(worldSchema) as ValidateFunction;

function formatErrors(errors: ErrorObject[] | null | undefined): ValidationIssue[] {
  return (errors ?? []).map((error) => ({
    code: "SCHEMA_INVALID",
    path: error.instancePath || "/",
    message: error.message ?? "Document does not match its JSON schema.",
    details: {
      keyword: error.keyword,
      params: error.params,
      schemaPath: error.schemaPath,
    },
  }));
}

function runSchemaValidator(
  validator: ValidateFunction,
  data: unknown,
): ValidationResult {
  const valid = validator(data);
  return {
    valid,
    phase: "schema",
    errors: valid ? [] : formatErrors(validator.errors),
  };
}

export function validateAssemblySyntax(data: unknown): ValidationResult {
  return runSchemaValidator(assemblyValidator, data);
}

export function validateWorldSyntax(data: unknown): ValidationResult {
  return runSchemaValidator(worldValidator, data);
}
