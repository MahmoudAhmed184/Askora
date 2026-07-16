export type ThreadPublicationStatus =
  | "draft"
  | "published"
  | "unpublished"
  | "deleted";

export interface PublicThreadItemVisibilityState {
  threadStatus: ThreadPublicationStatus;
  initialItemStatus: ThreadPublicationStatus;
  initialItemDeletedAt: Date | null;
  itemStatus: ThreadPublicationStatus;
  itemDeletedAt: Date | null;
}

/**
 * A follow-up can be public only while the thread's initial answer remains
 * public. Keeping this invariant in one predicate prevents feed and mutation
 * surfaces from drifting away from the canonical thread page.
 */
export function isPublicThreadItemVisible(
  state: PublicThreadItemVisibilityState,
) {
  return (
    state.threadStatus === "published" &&
    state.initialItemStatus === "published" &&
    state.initialItemDeletedAt === null &&
    state.itemStatus === "published" &&
    state.itemDeletedAt === null
  );
}
