/**
 * Job Leader Guard
 *
 * In PM2 cluster mode every worker runs server.ts, so without this gate every
 * worker would start its own SSE subscriber, pull-logs job, reconcile job, etc.
 * That produces N× duplicate SMS, N× polling, and broken Socket.IO real-time.
 *
 * PM2 sets NODE_APP_INSTANCE=0,1,2,... in cluster mode.
 * Only the instance with id "0" runs singleton jobs.
 * All workers still serve HTTP and Socket.IO.
 *
 * If the leader dies PM2 restarts it immediately and it re-acquires the role.
 * The 5-second pull-logs interval mitigates the <10s gap during restart.
 */
export const isJobLeader = (): boolean => {
  // NODE_APP_INSTANCE is set by PM2 cluster mode.
  // In fork mode or direct node execution it is undefined — treat as leader.
  const id = process.env.NODE_APP_INSTANCE ?? "0";
  return id === "0";
};
