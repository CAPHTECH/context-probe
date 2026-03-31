export interface FactLedger {
  id: string;
  payload: string;
}

export function appendFact(entry: FactLedger): FactLedger {
  return entry;
}
