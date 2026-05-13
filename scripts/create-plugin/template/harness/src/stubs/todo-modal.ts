// Stub for @/stores/todo-modal — MyHub-internal zustand store that opens a
// todo modal. The harness doesn't model todos; this is a no-op so any
// transitive import doesn't fail.
export const useTodoModalStore = Object.assign(
  () => ({ open: () => {}, close: () => {} }),
  { getState: () => ({ open: () => {}, close: () => {} }) },
);
