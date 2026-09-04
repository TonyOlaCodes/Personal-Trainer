/**
 * Same-tab autosave queue rules. The server still owns revision acceptance;
 * this only decides what the active logger sends next.
 */

export interface SaveQueueState {
    inFlight: boolean;
    pending: boolean;
    ackedRevision: number;
}

export function enqueueSave(state: SaveQueueState): { sendNow: boolean; next: SaveQueueState } {
    if (state.inFlight) {
        return { sendNow: false, next: { ...state, pending: true } };
    }
    return { sendNow: true, next: { ...state, inFlight: true, pending: false } };
}

export function acknowledgeSave(
    state: SaveQueueState,
    serverRevision: number
): { sendPending: boolean; next: SaveQueueState } {
    const next: SaveQueueState = {
        inFlight: false,
        pending: state.pending,
        ackedRevision: serverRevision,
    };
    if (next.pending) {
        return { sendPending: true, next: { ...next, inFlight: true, pending: false } };
    }
    return { sendPending: false, next };
}

export function rejectStaleSave(
    state: SaveQueueState,
    serverRevision: number
): { retryPending: boolean; next: SaveQueueState } {
    const next: SaveQueueState = {
        inFlight: false,
        pending: state.pending,
        ackedRevision: serverRevision,
    };
    if (next.pending) {
        return { retryPending: true, next: { ...next, inFlight: true, pending: false } };
    }
    return { retryPending: false, next };
}
