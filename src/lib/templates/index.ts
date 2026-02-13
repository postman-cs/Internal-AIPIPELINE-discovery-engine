/**
 * Pipeline Template Library (Feature #7)
 *
 * Curated, parameterized CI/CD pipeline templates for common patterns.
 * Templates are technology-agnostic and use Mustache-style placeholders.
 *
 * Patterns:
 * - basic-newman: Basic Newman collection run
 * - multi-env-promotion: Multi-environment promotion with gates
 * - contract-test-gate: Contract testing as a deployment gate
 * - canary-deploy: Canary deployment with Postman monitor checks
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PipelineTemplate {
  id: string;
  name: string;
  description: string;
  platform: string;        // slug
  platformLabel: string;   // human-readable
  configLanguage: string;  // syntax hint
  filename: string;        // target file path
  pattern: string;         // basic-newman | multi-env-promotion | contract-test-gate | canary-deploy
  template: string;        // parameterized config content
  parameters: TemplateParameter[];
}

export interface TemplateParameter {
  key: string;
  label: string;
  description: string;
  default: string;
  type: "string" | "number" | "boolean" | "select";
  options?: string[];      // for select type
  required: boolean;
}

// ---------------------------------------------------------------------------
// Parameter substitution
// ---------------------------------------------------------------------------

export function renderTemplate(template: string, params: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Template Registry
// ---------------------------------------------------------------------------

export const PIPELINE_TEMPLATES: PipelineTemplate[] = [
  // =========================================================================
  // GitHub Actions Templates
  // =========================================================================
  {
    id: "gh-basic-newman",
    name: "Basic Newman Test Run",
    description: "Run Postman collections via Newman on push/PR. Uploads JUnit results as artifacts.",
    platform: "github_actions",
    platformLabel: "GitHub Actions",
    configLanguage: "yaml",
    filename: ".github/workflows/postman-tests.yml",
    pattern: "basic-newman",
    parameters: [
      { key: "NODE_VERSION", label: "Node.js Version", description: "Node.js version for Newman", default: "20", type: "string", required: true },
      { key: "COLLECTION_PATH", label: "Collection Path", description: "Path to Postman collection JSON", default: "postman/collection.json", type: "string", required: true },
      { key: "ENVIRONMENT_PATH", label: "Environment Path", description: "Path to Postman environment JSON", default: "postman/env-staging.json", type: "string", required: false },
      { key: "BRANCH_TRIGGER", label: "Branch Trigger", description: "Branch(es) to trigger on", default: "main", type: "string", required: true },
    ],
    template: `name: Postman API Tests

on:
  push:
    branches: [{{BRANCH_TRIGGER}}]
  pull_request:
    branches: [{{BRANCH_TRIGGER}}]

jobs:
  api-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '{{NODE_VERSION}}'

      - name: Install Newman
        run: npm install -g newman newman-reporter-htmlextra newman-reporter-junit

      - name: Run Postman Collection
        run: |
          newman run {{COLLECTION_PATH}} \\
            -e {{ENVIRONMENT_PATH}} \\
            --reporters cli,junit,htmlextra \\
            --reporter-junit-export results/junit-report.xml \\
            --reporter-htmlextra-export results/html-report.html

      - name: Upload Test Results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: newman-results
          path: results/

      - name: Publish Test Report
        uses: mikepenz/action-junit-report@v4
        if: always()
        with:
          report_paths: results/junit-report.xml
`,
  },
  {
    id: "gh-multi-env",
    name: "Multi-Environment Promotion",
    description: "Staged deployment with Newman gates: dev -> staging -> production with approval gates.",
    platform: "github_actions",
    platformLabel: "GitHub Actions",
    configLanguage: "yaml",
    filename: ".github/workflows/postman-promotion.yml",
    pattern: "multi-env-promotion",
    parameters: [
      { key: "NODE_VERSION", label: "Node.js Version", description: "Node.js version for Newman", default: "20", type: "string", required: true },
      { key: "COLLECTION_PATH", label: "Collection Path", description: "Path to Postman collection JSON", default: "postman/collection.json", type: "string", required: true },
      { key: "DEV_ENV_PATH", label: "Dev Environment", description: "Path to dev environment JSON", default: "postman/env-dev.json", type: "string", required: true },
      { key: "STAGING_ENV_PATH", label: "Staging Environment", description: "Path to staging environment JSON", default: "postman/env-staging.json", type: "string", required: true },
      { key: "PROD_ENV_PATH", label: "Production Environment", description: "Path to production environment JSON", default: "postman/env-production.json", type: "string", required: true },
    ],
    template: `name: Postman Environment Promotion

on:
  push:
    branches: [main]

jobs:
  test-dev:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '{{NODE_VERSION}}'
      - run: npm install -g newman newman-reporter-junit
      - name: Run Dev Tests
        run: |
          newman run {{COLLECTION_PATH}} \\
            -e {{DEV_ENV_PATH}} \\
            --reporters cli,junit \\
            --reporter-junit-export results/dev-junit.xml \\
            --bail
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: dev-results
          path: results/

  test-staging:
    needs: test-dev
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '{{NODE_VERSION}}'
      - run: npm install -g newman newman-reporter-junit
      - name: Run Staging Tests
        run: |
          newman run {{COLLECTION_PATH}} \\
            -e {{STAGING_ENV_PATH}} \\
            --reporters cli,junit \\
            --reporter-junit-export results/staging-junit.xml \\
            --bail
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: staging-results
          path: results/

  deploy-production:
    needs: test-staging
    runs-on: ubuntu-latest
    environment: production  # Requires manual approval
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '{{NODE_VERSION}}'
      - run: npm install -g newman newman-reporter-junit newman-reporter-htmlextra
      - name: Run Production Smoke Tests
        run: |
          newman run {{COLLECTION_PATH}} \\
            -e {{PROD_ENV_PATH}} \\
            --reporters cli,junit,htmlextra \\
            --reporter-junit-export results/prod-junit.xml \\
            --reporter-htmlextra-export results/prod-report.html
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: production-results
          path: results/
`,
  },
  {
    id: "gh-contract-gate",
    name: "Contract Test Gate",
    description: "Block merges unless API contract tests pass. Validates response schemas against expectations.",
    platform: "github_actions",
    platformLabel: "GitHub Actions",
    configLanguage: "yaml",
    filename: ".github/workflows/contract-tests.yml",
    pattern: "contract-test-gate",
    parameters: [
      { key: "NODE_VERSION", label: "Node.js Version", description: "Node.js version for Newman", default: "20", type: "string", required: true },
      { key: "CONTRACT_COLLECTION", label: "Contract Collection", description: "Path to contract test collection", default: "postman/contract-tests.json", type: "string", required: true },
      { key: "ENVIRONMENT_PATH", label: "Environment Path", description: "Path to environment JSON", default: "postman/env-staging.json", type: "string", required: true },
    ],
    template: `name: API Contract Tests

on:
  pull_request:
    branches: [main, develop]

jobs:
  contract-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '{{NODE_VERSION}}'
      - run: npm install -g newman newman-reporter-junit

      - name: Run Contract Tests
        run: |
          newman run {{CONTRACT_COLLECTION}} \\
            -e {{ENVIRONMENT_PATH}} \\
            --reporters cli,junit \\
            --reporter-junit-export results/contract-junit.xml \\
            --bail

      - name: Upload Contract Results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: contract-results
          path: results/

      - name: Publish Contract Report
        uses: mikepenz/action-junit-report@v4
        if: always()
        with:
          report_paths: results/contract-junit.xml
          check_name: API Contract Compliance
`,
  },

  // =========================================================================
  // GitLab CI Templates
  // =========================================================================
  {
    id: "gl-basic-newman",
    name: "Basic Newman Test Run",
    description: "Run Postman collections via Newman in GitLab CI. Stores JUnit artifacts for test reporting.",
    platform: "gitlab_ci",
    platformLabel: "GitLab CI",
    configLanguage: "yaml",
    filename: ".gitlab-ci.yml",
    pattern: "basic-newman",
    parameters: [
      { key: "NODE_IMAGE", label: "Node Docker Image", description: "Docker image for Node.js", default: "node:20-alpine", type: "string", required: true },
      { key: "COLLECTION_PATH", label: "Collection Path", description: "Path to Postman collection JSON", default: "postman/collection.json", type: "string", required: true },
      { key: "ENVIRONMENT_PATH", label: "Environment Path", description: "Path to Postman environment JSON", default: "postman/env-staging.json", type: "string", required: false },
    ],
    template: `stages:
  - test

postman-api-tests:
  stage: test
  image: {{NODE_IMAGE}}
  before_script:
    - npm install -g newman newman-reporter-htmlextra newman-reporter-junit
  script:
    - |
      newman run {{COLLECTION_PATH}} \\
        -e {{ENVIRONMENT_PATH}} \\
        --reporters cli,junit,htmlextra \\
        --reporter-junit-export results/junit-report.xml \\
        --reporter-htmlextra-export results/html-report.html
  artifacts:
    when: always
    paths:
      - results/
    reports:
      junit: results/junit-report.xml
    expire_in: 30 days
`,
  },
  {
    id: "gl-multi-env",
    name: "Multi-Environment Promotion",
    description: "Staged pipeline: dev -> staging -> production with manual gates and Newman tests.",
    platform: "gitlab_ci",
    platformLabel: "GitLab CI",
    configLanguage: "yaml",
    filename: ".gitlab-ci.yml",
    pattern: "multi-env-promotion",
    parameters: [
      { key: "NODE_IMAGE", label: "Node Docker Image", description: "Docker image for Node.js", default: "node:20-alpine", type: "string", required: true },
      { key: "COLLECTION_PATH", label: "Collection Path", description: "Path to Postman collection", default: "postman/collection.json", type: "string", required: true },
      { key: "DEV_ENV_PATH", label: "Dev Environment", description: "Path to dev env JSON", default: "postman/env-dev.json", type: "string", required: true },
      { key: "STAGING_ENV_PATH", label: "Staging Environment", description: "Path to staging env JSON", default: "postman/env-staging.json", type: "string", required: true },
      { key: "PROD_ENV_PATH", label: "Production Environment", description: "Path to prod env JSON", default: "postman/env-production.json", type: "string", required: true },
    ],
    template: `stages:
  - test-dev
  - test-staging
  - deploy-production

.newman-base:
  image: {{NODE_IMAGE}}
  before_script:
    - npm install -g newman newman-reporter-junit
  artifacts:
    when: always
    reports:
      junit: results/*.xml
    expire_in: 30 days

test-dev:
  extends: .newman-base
  stage: test-dev
  script:
    - newman run {{COLLECTION_PATH}} -e {{DEV_ENV_PATH}} --reporters cli,junit --reporter-junit-export results/dev-junit.xml --bail

test-staging:
  extends: .newman-base
  stage: test-staging
  script:
    - newman run {{COLLECTION_PATH}} -e {{STAGING_ENV_PATH}} --reporters cli,junit --reporter-junit-export results/staging-junit.xml --bail

deploy-production:
  extends: .newman-base
  stage: deploy-production
  when: manual  # Manual approval gate
  script:
    - newman run {{COLLECTION_PATH}} -e {{PROD_ENV_PATH}} --reporters cli,junit --reporter-junit-export results/prod-junit.xml
  environment:
    name: production
`,
  },

  // =========================================================================
  // Jenkins Templates
  // =========================================================================
  {
    id: "jk-basic-newman",
    name: "Basic Newman Test Run",
    description: "Jenkinsfile pipeline for running Postman collections with Newman. Publishes JUnit results.",
    platform: "jenkins",
    platformLabel: "Jenkins",
    configLanguage: "groovy",
    filename: "Jenkinsfile",
    pattern: "basic-newman",
    parameters: [
      { key: "NODE_VERSION", label: "Node.js Version", description: "Node.js tool installation name", default: "NodeJS-20", type: "string", required: true },
      { key: "COLLECTION_PATH", label: "Collection Path", description: "Path to Postman collection JSON", default: "postman/collection.json", type: "string", required: true },
      { key: "ENVIRONMENT_PATH", label: "Environment Path", description: "Path to Postman environment JSON", default: "postman/env-staging.json", type: "string", required: false },
    ],
    template: `pipeline {
    agent any

    tools {
        nodejs '{{NODE_VERSION}}'
    }

    stages {
        stage('Install Newman') {
            steps {
                sh 'npm install -g newman newman-reporter-junit newman-reporter-htmlextra'
            }
        }

        stage('Run API Tests') {
            steps {
                sh """
                    newman run {{COLLECTION_PATH}} \\\\
                        -e {{ENVIRONMENT_PATH}} \\\\
                        --reporters cli,junit,htmlextra \\\\
                        --reporter-junit-export results/junit-report.xml \\\\
                        --reporter-htmlextra-export results/html-report.html
                """
            }
        }
    }

    post {
        always {
            junit 'results/junit-report.xml'
            archiveArtifacts artifacts: 'results/**', allowEmptyArchive: true
        }
    }
}
`,
  },

  // =========================================================================
  // Azure DevOps Templates
  // =========================================================================
  {
    id: "az-basic-newman",
    name: "Basic Newman Test Run",
    description: "Azure Pipelines YAML for running Postman collections. Publishes test results to Azure DevOps.",
    platform: "azure_devops",
    platformLabel: "Azure DevOps",
    configLanguage: "yaml",
    filename: "azure-pipelines.yml",
    pattern: "basic-newman",
    parameters: [
      { key: "VM_IMAGE", label: "VM Image", description: "Agent VM image", default: "ubuntu-latest", type: "string", required: true },
      { key: "NODE_VERSION", label: "Node.js Version", description: "Node.js version", default: "20.x", type: "string", required: true },
      { key: "COLLECTION_PATH", label: "Collection Path", description: "Path to collection JSON", default: "postman/collection.json", type: "string", required: true },
      { key: "ENVIRONMENT_PATH", label: "Environment Path", description: "Path to environment JSON", default: "postman/env-staging.json", type: "string", required: false },
    ],
    template: `trigger:
  branches:
    include:
      - main

pool:
  vmImage: '{{VM_IMAGE}}'

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '{{NODE_VERSION}}'
    displayName: 'Install Node.js'

  - script: npm install -g newman newman-reporter-junit
    displayName: 'Install Newman'

  - script: |
      newman run {{COLLECTION_PATH}} \\
        -e {{ENVIRONMENT_PATH}} \\
        --reporters cli,junit \\
        --reporter-junit-export $(System.DefaultWorkingDirectory)/results/junit-report.xml
    displayName: 'Run Postman Tests'

  - task: PublishTestResults@2
    condition: always()
    inputs:
      testResultsFormat: 'JUnit'
      testResultsFiles: '**/junit-report.xml'
      mergeTestResults: true
      testRunTitle: 'Postman API Tests'
`,
  },

  // =========================================================================
  // CircleCI Templates
  // =========================================================================
  {
    id: "ci-basic-newman",
    name: "Basic Newman Test Run",
    description: "CircleCI config for running Postman collections. Stores JUnit results for CircleCI test insights.",
    platform: "circleci",
    platformLabel: "CircleCI",
    configLanguage: "yaml",
    filename: ".circleci/config.yml",
    pattern: "basic-newman",
    parameters: [
      { key: "NODE_IMAGE", label: "Docker Image", description: "CircleCI Docker image", default: "cimg/node:20.0", type: "string", required: true },
      { key: "COLLECTION_PATH", label: "Collection Path", description: "Path to collection JSON", default: "postman/collection.json", type: "string", required: true },
      { key: "ENVIRONMENT_PATH", label: "Environment Path", description: "Path to environment JSON", default: "postman/env-staging.json", type: "string", required: false },
    ],
    template: `version: 2.1

jobs:
  api-tests:
    docker:
      - image: {{NODE_IMAGE}}
    steps:
      - checkout
      - run:
          name: Install Newman
          command: npm install -g newman newman-reporter-junit
      - run:
          name: Run Postman Tests
          command: |
            mkdir -p results
            newman run {{COLLECTION_PATH}} \\
              -e {{ENVIRONMENT_PATH}} \\
              --reporters cli,junit \\
              --reporter-junit-export results/junit-report.xml
      - store_test_results:
          path: results
      - store_artifacts:
          path: results

workflows:
  test:
    jobs:
      - api-tests
`,
  },

  // =========================================================================
  // AWS CodeBuild Templates
  // =========================================================================
  {
    id: "aws-basic-newman",
    name: "Basic Newman Test Run",
    description: "AWS CodeBuild buildspec for running Postman collections via Newman.",
    platform: "aws_codebuild",
    platformLabel: "AWS CodeBuild",
    configLanguage: "yaml",
    filename: "buildspec.yml",
    pattern: "basic-newman",
    parameters: [
      { key: "NODE_VERSION", label: "Node.js Version", description: "Node.js version", default: "20", type: "string", required: true },
      { key: "COLLECTION_PATH", label: "Collection Path", description: "Path to collection JSON", default: "postman/collection.json", type: "string", required: true },
      { key: "ENVIRONMENT_PATH", label: "Environment Path", description: "Path to environment JSON", default: "postman/env-staging.json", type: "string", required: false },
    ],
    template: `version: 0.2

phases:
  install:
    runtime-versions:
      nodejs: {{NODE_VERSION}}
    commands:
      - npm install -g newman newman-reporter-junit
  build:
    commands:
      - |
        newman run {{COLLECTION_PATH}} \\
          -e {{ENVIRONMENT_PATH}} \\
          --reporters cli,junit \\
          --reporter-junit-export results/junit-report.xml

reports:
  postman-tests:
    files:
      - 'results/junit-report.xml'
    file-format: JUNITXML

artifacts:
  files:
    - 'results/**/*'
`,
  },

  // =========================================================================
  // Bitbucket Pipelines Templates
  // =========================================================================
  {
    id: "bb-basic-newman",
    name: "Basic Newman Test Run",
    description: "Bitbucket Pipelines config for running Postman collections via Newman.",
    platform: "bitbucket_pipelines",
    platformLabel: "Bitbucket Pipelines",
    configLanguage: "yaml",
    filename: "bitbucket-pipelines.yml",
    pattern: "basic-newman",
    parameters: [
      { key: "NODE_IMAGE", label: "Docker Image", description: "Docker image", default: "node:20", type: "string", required: true },
      { key: "COLLECTION_PATH", label: "Collection Path", description: "Path to collection JSON", default: "postman/collection.json", type: "string", required: true },
      { key: "ENVIRONMENT_PATH", label: "Environment Path", description: "Path to environment JSON", default: "postman/env-staging.json", type: "string", required: false },
    ],
    template: `image: {{NODE_IMAGE}}

pipelines:
  default:
    - step:
        name: Postman API Tests
        script:
          - npm install -g newman newman-reporter-junit
          - mkdir -p results
          - >
            newman run {{COLLECTION_PATH}}
            -e {{ENVIRONMENT_PATH}}
            --reporters cli,junit
            --reporter-junit-export results/junit-report.xml
        artifacts:
          - results/**
`,
  },
];

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export function getTemplatesByPlatform(platform: string): PipelineTemplate[] {
  return PIPELINE_TEMPLATES.filter((t) => t.platform === platform);
}

export function getTemplatesByPattern(pattern: string): PipelineTemplate[] {
  return PIPELINE_TEMPLATES.filter((t) => t.pattern === pattern);
}

export function getTemplateById(id: string): PipelineTemplate | undefined {
  return PIPELINE_TEMPLATES.find((t) => t.id === id);
}

export function getAvailablePlatforms(): Array<{ platform: string; label: string; templateCount: number }> {
  const platformMap = new Map<string, { label: string; count: number }>();

  for (const t of PIPELINE_TEMPLATES) {
    const existing = platformMap.get(t.platform);
    if (existing) {
      existing.count++;
    } else {
      platformMap.set(t.platform, { label: t.platformLabel, count: 1 });
    }
  }

  return Array.from(platformMap.entries()).map(([platform, { label, count }]) => ({
    platform,
    label,
    templateCount: count,
  }));
}

export function getAvailablePatterns(): string[] {
  return [...new Set(PIPELINE_TEMPLATES.map((t) => t.pattern))];
}
