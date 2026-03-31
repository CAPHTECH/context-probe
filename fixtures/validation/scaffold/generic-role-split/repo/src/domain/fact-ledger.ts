export interface FactLedgerEntry {
  id: string;
  payload: string;
}

export function appendFact(entry: FactLedgerEntry): FactLedgerEntry {
  return entry;
}
