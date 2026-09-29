import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { Workbench } from "./app/workbench.js";

/**
 * Launch the Workbench.
 *
 * Uses the same `createCliRenderer` a consumer's app would, so the explorer is
 * running inside the real renderer with real key handling. A Workbench built on
 * anything else would be a preview of the library rather than an instance of
 * it.
 */
const renderer = await createCliRenderer({
  exitOnCtrlC: true,
  useKittyKeyboard: { disambiguate: true },
  targetFps: 30,
});

createRoot(renderer).render(<Workbench />);
