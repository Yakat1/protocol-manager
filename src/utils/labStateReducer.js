// Pure state reducer for the lab context.
// `SET` replaces state wholesale; `FUNC` applies an updater function (used by
// callers who need the latest state without a stale closure).
export function labStateReducer(prevState, action) {
  switch (action.type) {
    case 'SET':
      return action.payload;
    case 'FUNC':
      return action.updater(prevState);
    default:
      return prevState;
  }
}