export interface PublishedAnswerControlState {
  canManage: boolean;
  disabled: boolean;
}

export const hiddenPublishedAnswerControls = {
  canManage: false,
  disabled: false,
} satisfies PublishedAnswerControlState;
