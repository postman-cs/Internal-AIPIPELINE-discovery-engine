#!/usr/bin/env bash
# =============================================================================
# demo-k8-jenkins.sh — Newman-in-cluster demo simulating Jenkins
#
# Deploys a mock service, creates k8s resources, runs Newman inside a Job,
# streams logs, then cleans up. Safe, idempotent, non-destructive by default.
#
# Usage:
#   bash scripts/demo-k8-jenkins.sh [OPTIONS]
#
# Options:
#   --create-cluster   Create a kind cluster before running (or CREATE_CLUSTER=true)
#   --port-forward     Port-forward the mock service after run (or PORT_FORWARD=true)
#   --no-cleanup       Keep Job/ConfigMap/Secret after run
#   --help             Show this help
#
# Environment overrides:
#   NAMESPACE          k8s namespace           (default: default)
#   JOB_NAME           Job name                (default: newman-demo-job)
#   CONFIGMAP_NAME     ConfigMap name           (default: newman-assets)
#   SECRET_NAME        Secret name              (default: newman-credentials)
#   SERVICE_NAME       Mock service name        (default: circles-service)
#   NEWMAN_IMAGE       Newman container image   (default: postman/newman:5.3.3)
#   LOCAL_PORT         Port-forward local port  (default: 31005)
#   CLIENT_ID          OAuth client ID          (default: demo-client)
#   CLIENT_SECRET      OAuth client secret      (default: demo-secret)
#   JOB_TIMEOUT        Job wait timeout         (default: 120s)
#   KIND_CLUSTER_NAME  kind cluster name        (default: newman-demo)
#   CREATE_CLUSTER     Create kind cluster      (default: false)
#   PORT_FORWARD       Start port-forward       (default: false)
#   NO_CLEANUP         Skip cleanup             (default: false)
# =============================================================================
set -euo pipefail

# ─── Defaults ────────────────────────────────────────────────────────────────
NAMESPACE="${NAMESPACE:-default}"
JOB_NAME="${JOB_NAME:-newman-demo-job}"
CONFIGMAP_NAME="${CONFIGMAP_NAME:-newman-assets}"
SECRET_NAME="${SECRET_NAME:-newman-credentials}"
SERVICE_NAME="${SERVICE_NAME:-circles-service}"
NEWMAN_IMAGE="${NEWMAN_IMAGE:-postman/newman:5.3.3}"
LOCAL_PORT="${LOCAL_PORT:-31005}"
CLIENT_ID="${CLIENT_ID:-demo-client}"
CLIENT_SECRET="${CLIENT_SECRET:-demo-secret}"
JOB_TIMEOUT="${JOB_TIMEOUT:-120s}"
KIND_CLUSTER_NAME="${KIND_CLUSTER_NAME:-newman-demo}"
CREATE_CLUSTER="${CREATE_CLUSTER:-false}"
PORT_FORWARD="${PORT_FORWARD:-false}"
NO_CLEANUP="${NO_CLEANUP:-false}"

# ─── Repo root (script lives in scripts/) ────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COLLECTION="$REPO_ROOT/postman/collections/circles-golden.collection.json"
ENVIRONMENT="$REPO_ROOT/postman/environments/cluster.json"

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
fatal() { err "$@"; exit 1; }

# ─── Parse flags ─────────────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --create-cluster) CREATE_CLUSTER=true ;;
    --port-forward)   PORT_FORWARD=true ;;
    --no-cleanup)     NO_CLEANUP=true ;;
    --help|-h)
      sed -n '2,/^# =====/p' "$0" | sed 's/^# \?//' | head -n -1
      exit 0
      ;;
    *) warn "Unknown flag: $arg (ignored)" ;;
  esac
done

# ─── Trap: cleanup on error ─────────────────────────────────────────────────
cleanup_on_error() {
  local exit_code=$?
  if [[ $exit_code -ne 0 ]]; then
    warn "Script exited with code $exit_code — cleaning up resources..."
    kubectl delete job "$JOB_NAME"        -n "$NAMESPACE" --ignore-not-found 2>/dev/null || true
    kubectl delete configmap "$CONFIGMAP_NAME" -n "$NAMESPACE" --ignore-not-found 2>/dev/null || true
    kubectl delete secret "$SECRET_NAME"  -n "$NAMESPACE" --ignore-not-found 2>/dev/null || true
  fi
}
trap cleanup_on_error EXIT

# =============================================================================
# 1. Preflight checks
# =============================================================================
info "Running preflight checks..."

check_bin() {
  if ! command -v "$1" &>/dev/null; then
    fatal "'$1' not found. $2"
  fi
  ok "$1 found ($(command -v "$1"))"
}

check_bin kubectl "Install: https://kubernetes.io/docs/tasks/tools/"
check_bin jq      "Install: brew install jq  (or apt-get install jq)"

if [[ "$CREATE_CLUSTER" == "true" ]]; then
  check_bin kind   "Install: https://kind.sigs.k8s.io/docs/user/quick-start/#installation"
  check_bin docker "Install: https://docs.docker.com/get-docker/"
fi

# Validate collection and environment files
if [[ ! -f "$COLLECTION" ]]; then
  fatal "Collection not found: $COLLECTION\n       Expected at: postman/collections/circles-golden.collection.json"
fi
if [[ ! -f "$ENVIRONMENT" ]]; then
  fatal "Environment not found: $ENVIRONMENT\n       Expected at: postman/environments/cluster.json"
fi

# Quick JSON validation
jq empty "$COLLECTION"  2>/dev/null || fatal "Invalid JSON: $COLLECTION"
jq empty "$ENVIRONMENT" 2>/dev/null || fatal "Invalid JSON: $ENVIRONMENT"
ok "Collection and environment JSON validated"

# =============================================================================
# 2. Optionally create kind cluster
# =============================================================================
if [[ "$CREATE_CLUSTER" == "true" ]]; then
  if kind get clusters 2>/dev/null | grep -qx "$KIND_CLUSTER_NAME"; then
    info "kind cluster '$KIND_CLUSTER_NAME' already exists — reusing"
    kubectl cluster-info --context "kind-$KIND_CLUSTER_NAME" &>/dev/null || \
      fatal "Cluster exists but kubectl context 'kind-$KIND_CLUSTER_NAME' is unreachable"
  else
    info "Creating kind cluster '$KIND_CLUSTER_NAME'..."
    kind create cluster --name "$KIND_CLUSTER_NAME" --wait 60s
    ok "kind cluster '$KIND_CLUSTER_NAME' created"
  fi
  kubectl config use-context "kind-$KIND_CLUSTER_NAME" &>/dev/null
fi

# Verify cluster is reachable
kubectl cluster-info &>/dev/null || fatal "Cannot reach Kubernetes cluster. Is kubectl configured?"
ok "Kubernetes cluster reachable"

# =============================================================================
# 3. Create namespace if needed
# =============================================================================
if [[ "$NAMESPACE" != "default" ]]; then
  if ! kubectl get namespace "$NAMESPACE" &>/dev/null; then
    info "Creating namespace '$NAMESPACE'..."
    kubectl create namespace "$NAMESPACE"
    ok "Namespace '$NAMESPACE' created"
  else
    ok "Namespace '$NAMESPACE' exists"
  fi
fi

# =============================================================================
# 4. Deploy the mock service (circles-service)
# =============================================================================
info "Deploying mock service '$SERVICE_NAME'..."

# Inline Python mock server — handles all endpoints the collection needs
MOCK_SERVER_PY=$(cat <<'PYEOF'
import json, http.server, uuid, sys

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        sys.stderr.write("[mock] %s\n" % (fmt % args))

    def _send(self, code, body):
        payload = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        if self.path == "/healthz":
            self._send(200, {"status": "ok"})
        elif self.path == "/api/v1/circles":
            self._send(200, {"data": [
                {"id": "c1", "name": "Platform Engineering"},
                {"id": "c2", "name": "API Gateway"},
                {"id": "c3", "name": "Identity & Access"},
            ]})
        else:
            self._send(404, {"error": "not found", "path": self.path})

    def do_POST(self):
        if self.path == "/oauth/token":
            self._send(200, {
                "access_token": "demo-jwt-" + uuid.uuid4().hex[:16],
                "token_type": "Bearer",
                "expires_in": 3600,
                "scope": "read write"
            })
        elif self.path == "/api/v1/circles":
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length)) if length else {}
            self._send(201, {"id": "c-" + uuid.uuid4().hex[:8], **body})
        else:
            self._send(404, {"error": "not found", "path": self.path})

http.server.HTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
PYEOF
)

# Apply Deployment
kubectl apply -n "$NAMESPACE" -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${SERVICE_NAME}
  labels:
    app: ${SERVICE_NAME}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ${SERVICE_NAME}
  template:
    metadata:
      labels:
        app: ${SERVICE_NAME}
    spec:
      containers:
      - name: mock
        image: python:3.12-alpine
        command: ["python3", "-c", $(echo "$MOCK_SERVER_PY" | jq -Rs .)]
        ports:
        - containerPort: 8080
        readinessProbe:
          httpGet:
            path: /healthz
            port: 8080
          initialDelaySeconds: 2
          periodSeconds: 3
        resources:
          requests:
            cpu: 50m
            memory: 32Mi
          limits:
            cpu: 100m
            memory: 64Mi
EOF

# Apply Service
kubectl apply -n "$NAMESPACE" -f - <<EOF
apiVersion: v1
kind: Service
metadata:
  name: ${SERVICE_NAME}
spec:
  selector:
    app: ${SERVICE_NAME}
  ports:
  - port: 80
    targetPort: 8080
    protocol: TCP
EOF

ok "Mock Deployment + Service applied"

# Wait for mock to be ready
info "Waiting for mock service to be ready..."
kubectl rollout status deployment/"$SERVICE_NAME" -n "$NAMESPACE" --timeout=60s
ok "Mock service is ready"

# =============================================================================
# 5. Create ConfigMap with collection + environment
# =============================================================================
info "Creating ConfigMap '$CONFIGMAP_NAME' with collection and environment..."

kubectl create configmap "$CONFIGMAP_NAME" \
  --from-file=collection.json="$COLLECTION" \
  --from-file=environment.json="$ENVIRONMENT" \
  -n "$NAMESPACE" \
  --dry-run=client -o yaml | kubectl apply -f -

ok "ConfigMap '$CONFIGMAP_NAME' applied"

# =============================================================================
# 6. Create Secret with credentials
# =============================================================================
info "Creating Secret '$SECRET_NAME' (CLIENT_ID / CLIENT_SECRET)..."

kubectl create secret generic "$SECRET_NAME" \
  --from-literal=CLIENT_ID="$CLIENT_ID" \
  --from-literal=CLIENT_SECRET="$CLIENT_SECRET" \
  -n "$NAMESPACE" \
  --dry-run=client -o yaml | kubectl apply -f -

ok "Secret '$SECRET_NAME' applied"

# =============================================================================
# 7. Delete prior Job if it exists (Jobs are immutable)
# =============================================================================
kubectl delete job "$JOB_NAME" -n "$NAMESPACE" --ignore-not-found 2>/dev/null

# =============================================================================
# 8. Create and apply the Newman Job
# =============================================================================
info "Launching Newman Job '$JOB_NAME'..."

kubectl apply -n "$NAMESPACE" -f - <<EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: ${JOB_NAME}
  labels:
    app: newman-demo
    simulates: jenkins
spec:
  backoffLimit: 0
  ttlSecondsAfterFinished: 600
  template:
    metadata:
      labels:
        app: newman-demo
    spec:
      restartPolicy: Never
      containers:
      - name: newman
        image: ${NEWMAN_IMAGE}
        command:
        - newman
        - run
        - /etc/newman/collection.json
        - --environment
        - /etc/newman/environment.json
        - --env-var
        - client_id=\$(CLIENT_ID)
        - --env-var
        - client_secret=\$(CLIENT_SECRET)
        - --reporters
        - cli,junit
        - --reporter-junit-export
        - /tmp/newman-results.xml
        - --color
        - "on"
        - --verbose
        env:
        - name: CLIENT_ID
          valueFrom:
            secretKeyRef:
              name: ${SECRET_NAME}
              key: CLIENT_ID
        - name: CLIENT_SECRET
          valueFrom:
            secretKeyRef:
              name: ${SECRET_NAME}
              key: CLIENT_SECRET
        volumeMounts:
        - name: newman-assets
          mountPath: /etc/newman
          readOnly: true
      volumes:
      - name: newman-assets
        configMap:
          name: ${CONFIGMAP_NAME}
EOF

ok "Job '$JOB_NAME' created"

# =============================================================================
# 9. Wait for completion and stream logs
# =============================================================================
info "Waiting for Job to complete (timeout: $JOB_TIMEOUT)..."

# Wait for the pod to be created first
for i in $(seq 1 30); do
  POD_NAME=$(kubectl get pods -n "$NAMESPACE" -l "job-name=$JOB_NAME" -o jsonpath='{.items[0].metadata.name}' 2>/dev/null) && break
  sleep 1
done

if [[ -z "${POD_NAME:-}" ]]; then
  fatal "Timed out waiting for Job pod to appear"
fi

info "Pod created: $POD_NAME"

# Wait for container to start (not just pending)
kubectl wait pod "$POD_NAME" -n "$NAMESPACE" --for=condition=Ready --timeout=60s 2>/dev/null || \
  kubectl wait pod "$POD_NAME" -n "$NAMESPACE" --for=jsonpath='{.status.phase}'=Running --timeout=60s 2>/dev/null || \
  true  # Pod may finish before Ready is set

# Stream logs
echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Newman Job Logs (simulating Jenkins console output)${NC}"
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo ""

kubectl logs -n "$NAMESPACE" "$POD_NAME" -f 2>/dev/null || \
  kubectl logs -n "$NAMESPACE" "$POD_NAME" 2>/dev/null || \
  warn "Could not retrieve pod logs"

echo ""
echo -e "${CYAN}════════════════════════════════════════════════════════════════${NC}"
echo ""

# Wait for job to fully complete
kubectl wait job "$JOB_NAME" -n "$NAMESPACE" \
  --for=condition=complete --timeout="$JOB_TIMEOUT" 2>/dev/null && JOB_OK=true || JOB_OK=false

# =============================================================================
# 10. Summary
# =============================================================================
JOB_STATUS=$(kubectl get job "$JOB_NAME" -n "$NAMESPACE" -o jsonpath='{.status.conditions[0].type}' 2>/dev/null || echo "Unknown")
POD_EXIT=$(kubectl get pod "$POD_NAME" -n "$NAMESPACE" -o jsonpath='{.status.containerStatuses[0].state.terminated.exitCode}' 2>/dev/null || echo "?")
SUCCEEDED=$(kubectl get job "$JOB_NAME" -n "$NAMESPACE" -o jsonpath='{.status.succeeded}' 2>/dev/null || echo "0")
FAILED=$(kubectl get job "$JOB_NAME" -n "$NAMESPACE" -o jsonpath='{.status.failed}' 2>/dev/null || echo "0")

echo -e "${CYAN}──── Summary ────${NC}"
echo "  Job:          $JOB_NAME"
echo "  Pod:          $POD_NAME"
echo "  Status:       $JOB_STATUS"
echo "  Pod exit:     $POD_EXIT"
echo "  Succeeded:    ${SUCCEEDED:-0}"
echo "  Failed:       ${FAILED:-0}"
echo ""

if [[ "$JOB_OK" == "true" && "$POD_EXIT" == "0" ]]; then
  ok "Newman job finished successfully — all requests passed. See logs above."
else
  err "Newman job finished with failures (exit code: $POD_EXIT). Review logs above."
fi

# =============================================================================
# 11. Cleanup (default: remove Job, ConfigMap, Secret; keep mock + service)
# =============================================================================
if [[ "$NO_CLEANUP" != "true" ]]; then
  info "Cleaning up Job, ConfigMap, Secret (mock service left running)..."
  kubectl delete job "$JOB_NAME"            -n "$NAMESPACE" --ignore-not-found
  kubectl delete configmap "$CONFIGMAP_NAME" -n "$NAMESPACE" --ignore-not-found
  kubectl delete secret "$SECRET_NAME"       -n "$NAMESPACE" --ignore-not-found
  ok "Cleanup complete. Mock service '$SERVICE_NAME' still running."
else
  warn "Skipping cleanup (--no-cleanup). Resources left in namespace '$NAMESPACE'."
fi

# =============================================================================
# 12. Optional port-forward
# =============================================================================
if [[ "$PORT_FORWARD" == "true" ]]; then
  echo ""
  info "Starting port-forward: localhost:$LOCAL_PORT → $SERVICE_NAME:80"
  kubectl port-forward "svc/$SERVICE_NAME" "$LOCAL_PORT:80" -n "$NAMESPACE" &
  PF_PID=$!
  sleep 1
  if kill -0 "$PF_PID" 2>/dev/null; then
    ok "Port-forward running (PID: $PF_PID)"
    echo ""
    echo "  Local mock:  http://localhost:$LOCAL_PORT"
    echo "  OAuth token: curl -s -X POST http://localhost:$LOCAL_PORT/oauth/token"
    echo "  Stop:        kill $PF_PID"
    echo ""
    echo "  Run Newman locally:"
    echo "    npx newman run postman/collections/circles-golden.collection.json \\"
    echo "      --environment postman/environments/cluster.json \\"
    echo "      --env-var base_url=http://localhost:$LOCAL_PORT"
    echo ""
    # Keep script alive while port-forward runs
    wait "$PF_PID" 2>/dev/null || true
  else
    warn "Port-forward process exited unexpectedly"
  fi
fi

# ─── Final exit code ─────────────────────────────────────────────────────────
# Disable the error trap since we're exiting intentionally
trap - EXIT

if [[ "$JOB_OK" == "true" && "$POD_EXIT" == "0" ]]; then
  exit 0
else
  exit 1
fi
