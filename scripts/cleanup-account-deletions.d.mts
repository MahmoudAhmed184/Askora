export function cleanupExpiredAccountDeletions(options: {
  limit?: number;
  now?: Date;
  store: {
    findExpiredDeletionRequests(options: {
      limit: number;
      now: Date;
    }): Promise<unknown[]>;
    anonymizeDeletionRequest(options: {
      now: Date;
      request: unknown;
    }): Promise<{ status: string }>;
    cleanupRetentionData?: (options: { now: Date }) => Promise<unknown>;
  };
}): Promise<unknown>;

export function createPoolCleanupStore(pool: unknown): {
  findExpiredDeletionRequests(options: {
    limit: number;
    now: Date;
  }): Promise<unknown[]>;
  anonymizeDeletionRequest(options: {
    now: Date;
    request: unknown;
  }): Promise<{ status: string }>;
  cleanupRetentionData(options: { now: Date }): Promise<unknown>;
};
