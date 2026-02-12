# Kubernetes Newman Demo — Simulating Jenkins

This demo deploys a mock API service into a Kubernetes cluster, then runs a [Newman](https://github.com/postmanlabs/newman) collection inside a k8s Job — simulating how Jenkins (or any CI) would execute API tests against in-cluster services.

## What it does

1. Deploys a lightweight Python mock (`circles-service`) that implements:
   - `POST /oauth/token` — returns a bearer token (client credentials flow)
   - `GET /healthz` — health check
   - `GET /api/v1/circles` — returns sample data (requires bearer token)
   - `POST /api/v1/circles` — creates a resource (requires bearer token)
2. Creates a ConfigMap with the Postman collection and environment
3. Creates a Secret with `CLIENT_ID` / `CLIENT_SECRET` (simulating Jenkins credentials)
4. Launches a k8s Job running `postman/newman` that executes the collection
5. Streams job logs (like Jenkins console output)
6. Cleans up the Job, ConfigMap, and Secret (mock service stays for reuse)

## Prerequisites

| Binary | Required | Install |
|--------|----------|---------|
| `kubectl` | Always | https://kubernetes.io/docs/tasks/tools/ |
| `jq` | Always | `brew install jq` |
| `kind` | Only with `--create-cluster` | https://kind.sigs.k8s.io/ |
| `docker` | Only with `--create-cluster` | https://docs.docker.com/get-docker/ |

You need a running Kubernetes cluster accessible via `kubectl`. If you don't have one, use `--create-cluster` to spin up a local [kind](https://kind.sigs.k8s.io/) cluster.

## Quick start

```bash
# If you already have a k8s cluster:
npm run demo:k8

# If you need a local cluster (creates a kind cluster):
npm run demo:k8 -- --create-cluster

# Or run the script directly:
bash scripts/demo-k8-jenkins.sh --create-cluster
```

## Options

| Flag | Env Variable | Description |
|------|-------------|-------------|
| `--create-cluster` | `CREATE_CLUSTER=true` | Create a kind cluster before running |
| `--port-forward` | `PORT_FORWARD=true` | Port-forward mock to localhost after run |
| `--no-cleanup` | `NO_CLEANUP=true` | Keep Job/ConfigMap/Secret after run |
| `--help` | — | Show help text |

## Environment overrides

All defaults can be overridden via environment variables:

```bash
# Use custom credentials (simulating Jenkins secrets injection)
CLIENT_ID=my-app CLIENT_SECRET=s3cret npm run demo:k8

# Custom namespace and timeout
NAMESPACE=staging JOB_TIMEOUT=180s npm run demo:k8

# Custom Newman image version
NEWMAN_IMAGE=postman/newman:6.0.0 npm run demo:k8
```

| Variable | Default | Description |
|----------|---------|-------------|
| `NAMESPACE` | `default` | Kubernetes namespace |
| `JOB_NAME` | `newman-demo-job` | Job resource name |
| `CONFIGMAP_NAME` | `newman-assets` | ConfigMap name |
| `SECRET_NAME` | `newman-credentials` | Secret name |
| `SERVICE_NAME` | `circles-service` | Mock service name |
| `NEWMAN_IMAGE` | `postman/newman:5.3.3` | Newman container image |
| `LOCAL_PORT` | `31005` | Local port for port-forward |
| `CLIENT_ID` | `demo-client` | OAuth client ID |
| `CLIENT_SECRET` | `demo-secret` | OAuth client secret |
| `JOB_TIMEOUT` | `120s` | kubectl wait timeout |
| `KIND_CLUSTER_NAME` | `newman-demo` | kind cluster name |

## Port-forward for local development

After the demo runs (mock service stays deployed), you can port-forward it for local Newman runs:

```bash
# Start port-forward
kubectl port-forward svc/circles-service 31005:80 &

# Run Newman locally against the in-cluster mock
npx newman run postman/collections/circles-golden.collection.json \
  --environment postman/environments/cluster.json \
  --env-var base_url=http://localhost:31005

# Or use the built-in flag:
npm run demo:k8 -- --port-forward
```

## What the collection tests

| Request | Method | Tests |
|---------|--------|-------|
| Authenticate | `POST /oauth/token` | Status 200, has `access_token`, token type is Bearer |
| Verify Token | `GET /healthz` | Token variable is set |
| Protected Resource | `GET /api/v1/circles` | Status 200, response has data array, items have id/name |
| Create Resource | `POST /api/v1/circles` | Status 201, response contains created resource |

## Cleanup

By default, the script cleans up the Job, ConfigMap, and Secret after each run. The mock Deployment and Service are left running so you can re-run or port-forward.

To remove everything:

```bash
kubectl delete deployment circles-service
kubectl delete service circles-service

# If you created a kind cluster:
kind delete cluster --name newman-demo
```
