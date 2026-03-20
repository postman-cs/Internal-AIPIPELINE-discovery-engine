/**
 * Task: monitor.evaluateSignals (DEPRECATED)
 *
 * Monitoring phase has been removed from the pipeline.
 * This task is a no-op kept for backward compatibility with task registrations.
 */

import type { Task } from "graphile-worker";

const task: Task = async (_payload, helpers) => {
  helpers.logger.info("monitor.evaluateSignals: no-op (monitoring phase removed)");
};

export default task;
