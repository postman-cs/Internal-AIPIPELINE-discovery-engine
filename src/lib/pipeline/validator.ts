/**
 * Pipeline Config Syntax Validation (Feature #4)
 *
 * Validates AI-generated CI/CD pipeline configs for syntax correctness.
 * Technology-agnostic: supports YAML, JSON, Groovy (basic), HCL (basic).
 */

import { logger } from "@/lib/logger";

const log = logger.child("pipeline.validator");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ValidationSeverity = "pass" | "warning" | "error";

export interface ValidationResult {
  status: ValidationSeverity;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface ValidationIssue {
  line?: number;
  column?: number;
  message: string;
  rule: string;
}

// ---------------------------------------------------------------------------
// YAML Validation
// ---------------------------------------------------------------------------

function validateYaml(content: string): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // Basic YAML validation checks
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Check for tab characters (YAML forbids tabs for indentation)
    if (/^\t/.test(line)) {
      errors.push({
        line: lineNum,
        message: "YAML does not allow tab characters for indentation. Use spaces instead.",
        rule: "no-tabs",
      });
    }

    // Check for trailing whitespace (warning)
    if (/\S\s+$/.test(line)) {
      warnings.push({
        line: lineNum,
        message: "Trailing whitespace detected.",
        rule: "no-trailing-spaces",
      });
    }

    // Check for common YAML key issues
    if (/^\s*-\s*$/.test(line) && i < lines.length - 1) {
      const nextLine = lines[i + 1];
      if (nextLine && !/^\s+/.test(nextLine)) {
        warnings.push({
          line: lineNum,
          message: "Empty list item followed by non-indented content.",
          rule: "empty-list-item",
        });
      }
    }
  }

  // Check for basic structure (should have at least one key)
  const hasKeys = lines.some((l) => /^[a-zA-Z_][\w.-]*\s*:/.test(l));
  if (!hasKeys && content.trim().length > 0) {
    warnings.push({
      message: "No top-level YAML keys found. File may not be valid YAML.",
      rule: "has-structure",
    });
  }

  // Check balanced braces and brackets
  const openBraces = (content.match(/\{/g) || []).length;
  const closeBraces = (content.match(/\}/g) || []).length;
  if (openBraces !== closeBraces) {
    errors.push({
      message: `Unbalanced curly braces: ${openBraces} opening vs ${closeBraces} closing.`,
      rule: "balanced-braces",
    });
  }

  const openBrackets = (content.match(/\[/g) || []).length;
  const closeBrackets = (content.match(/\]/g) || []).length;
  if (openBrackets !== closeBrackets) {
    errors.push({
      message: `Unbalanced square brackets: ${openBrackets} opening vs ${closeBrackets} closing.`,
      rule: "balanced-brackets",
    });
  }

  return {
    status: errors.length > 0 ? "error" : warnings.length > 0 ? "warning" : "pass",
    errors,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// JSON Validation
// ---------------------------------------------------------------------------

function validateJson(content: string): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  try {
    JSON.parse(content);
  } catch (err) {
    const message = err instanceof SyntaxError ? err.message : "Invalid JSON";
    errors.push({ message, rule: "valid-json" });
  }

  return {
    status: errors.length > 0 ? "error" : "pass",
    errors,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Groovy / Jenkinsfile Validation (basic)
// ---------------------------------------------------------------------------

function validateGroovy(content: string): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // Check balanced braces
  let braceDepth = 0;
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip strings and comments
    const stripped = line.replace(/'[^']*'/g, "").replace(/"[^"]*"/g, "").replace(/\/\/.*$/, "");
    braceDepth += (stripped.match(/\{/g) || []).length;
    braceDepth -= (stripped.match(/\}/g) || []).length;

    if (braceDepth < 0) {
      errors.push({
        line: i + 1,
        message: "Unexpected closing brace — more closing braces than opening.",
        rule: "balanced-braces",
      });
    }
  }

  if (braceDepth !== 0) {
    errors.push({
      message: `Unbalanced braces: ${braceDepth > 0 ? `${braceDepth} unclosed` : `${-braceDepth} extra closing`}.`,
      rule: "balanced-braces",
    });
  }

  // Check for pipeline { ... } block in Jenkinsfile
  if (!content.includes("pipeline") && !content.includes("node")) {
    warnings.push({
      message: "Jenkinsfile should contain a 'pipeline' or 'node' block.",
      rule: "has-pipeline-block",
    });
  }

  // Check balanced parentheses
  const openParens = (content.match(/\(/g) || []).length;
  const closeParens = (content.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    errors.push({
      message: `Unbalanced parentheses: ${openParens} opening vs ${closeParens} closing.`,
      rule: "balanced-parens",
    });
  }

  return {
    status: errors.length > 0 ? "error" : warnings.length > 0 ? "warning" : "pass",
    errors,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// HCL / Terraform Validation (basic)
// ---------------------------------------------------------------------------

function validateHcl(content: string): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // Check balanced braces
  let braceDepth = 0;
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const stripped = line.replace(/#.*$/, "").replace(/\/\/.*$/, "");
    braceDepth += (stripped.match(/\{/g) || []).length;
    braceDepth -= (stripped.match(/\}/g) || []).length;
  }

  if (braceDepth !== 0) {
    errors.push({
      message: `Unbalanced braces in HCL: expected 0, got depth ${braceDepth}.`,
      rule: "balanced-braces",
    });
  }

  // Check for resource/data/variable blocks
  const hasBlocks = /^(resource|data|variable|output|provider|terraform|locals|module)\s/m.test(content);
  if (!hasBlocks && content.trim().length > 0) {
    warnings.push({
      message: "No HCL resource/data/variable blocks found.",
      rule: "has-blocks",
    });
  }

  return {
    status: errors.length > 0 ? "error" : warnings.length > 0 ? "warning" : "pass",
    errors,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// TOML Validation (basic)
// ---------------------------------------------------------------------------

function validateToml(content: string): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;

    // Section headers
    if (line.startsWith("[")) {
      if (!line.endsWith("]")) {
        errors.push({
          line: i + 1,
          message: "Unclosed section header bracket.",
          rule: "valid-section",
        });
      }
      continue;
    }

    // Key-value pairs should contain =
    if (!line.includes("=") && !line.startsWith("[")) {
      warnings.push({
        line: i + 1,
        message: "Line does not appear to be a valid TOML key=value pair or section.",
        rule: "valid-pair",
      });
    }
  }

  return {
    status: errors.length > 0 ? "error" : warnings.length > 0 ? "warning" : "pass",
    errors,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Generic / fallback validation
// ---------------------------------------------------------------------------

function validateGeneric(content: string): ValidationResult {
  const warnings: ValidationIssue[] = [];

  if (content.trim().length === 0) {
    warnings.push({ message: "Config content is empty.", rule: "non-empty" });
  }

  return { status: warnings.length > 0 ? "warning" : "pass", errors: [], warnings };
}

// ---------------------------------------------------------------------------
// Platform-specific validation (GitHub Actions schema, etc.)
// ---------------------------------------------------------------------------

function validateGitHubActions(content: string): ValidationIssue[] {
  const warnings: ValidationIssue[] = [];

  // Must have 'on:' trigger
  if (!/^on:/m.test(content) && !/^"on":/m.test(content) && !/^'on':/m.test(content)) {
    warnings.push({
      message: "GitHub Actions workflow should have an 'on:' trigger definition.",
      rule: "gh-has-trigger",
    });
  }

  // Must have 'jobs:' section
  if (!/^jobs:/m.test(content)) {
    warnings.push({
      message: "GitHub Actions workflow should have a 'jobs:' section.",
      rule: "gh-has-jobs",
    });
  }

  return warnings;
}

function validateGitLabCi(content: string): ValidationIssue[] {
  const warnings: ValidationIssue[] = [];

  // Should have stages or at least one job with script
  if (!/^stages:/m.test(content) && !/script:/m.test(content)) {
    warnings.push({
      message: "GitLab CI config should have 'stages:' or jobs with 'script:' blocks.",
      rule: "gl-has-structure",
    });
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate a pipeline config based on its language and platform.
 */
export function validatePipelineConfig(
  configContent: string,
  configLanguage: string,
  platform?: string
): ValidationResult {
  log.info("Validating pipeline config", { language: configLanguage, platform });

  // Language-level validation
  let result: ValidationResult;
  const lang = configLanguage.toLowerCase();

  switch (lang) {
    case "yaml":
    case "yml":
      result = validateYaml(configContent);
      break;
    case "json":
      result = validateJson(configContent);
      break;
    case "groovy":
      result = validateGroovy(configContent);
      break;
    case "hcl":
    case "terraform":
      result = validateHcl(configContent);
      break;
    case "toml":
      result = validateToml(configContent);
      break;
    default:
      result = validateGeneric(configContent);
  }

  // Platform-specific validation
  if (platform) {
    const slug = platform.toLowerCase();
    if (slug === "github_actions" || slug.includes("github")) {
      result.warnings.push(...validateGitHubActions(configContent));
    } else if (slug === "gitlab_ci" || slug.includes("gitlab")) {
      result.warnings.push(...validateGitLabCi(configContent));
    }

    // Recalculate status
    if (result.errors.length > 0) result.status = "error";
    else if (result.warnings.length > 0) result.status = "warning";
  }

  return result;
}

/**
 * Validate all pipelines in a batch.
 */
export function validateAllPipelines(
  pipelines: Array<{
    platform: string;
    configContent: string;
    configLanguage: string;
  }>
): Map<string, ValidationResult> {
  const results = new Map<string, ValidationResult>();

  for (const p of pipelines) {
    results.set(p.platform, validatePipelineConfig(p.configContent, p.configLanguage, p.platform));
  }

  return results;
}
