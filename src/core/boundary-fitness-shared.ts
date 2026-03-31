import { average, clamp01Finite as clamp01, unique } from "./shared-utils.js";

const SEPARATION_SIGNALS = [
  /ownership/u,
  /security/u,
  /team境界/u,
  /セキュリティ/u,
  /分離/u,
  /独立/u,
  /別(?:責務|所有|境界)/u,
  /\bseparate\b/i,
  /\bseparation\b/i,
  /\boundary\b/i,
];

export { average, clamp01, unique };

export function hasSeparationSignal(text: string): boolean {
  return SEPARATION_SIGNALS.some((pattern) => pattern.test(text));
}
