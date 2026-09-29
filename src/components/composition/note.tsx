import { parseColor, type TextChunk } from "@opentui/core";
import { Marker, RailRow } from "../../primitives/rail.js";
import { useTheme } from "../../theme/context.js";
import type { StatusState } from "../../theme/state.js";
import { paint, styled } from "../../utils/style.js";
import { stringWidth, wrapToWidth } from "../../utils/text.js";

export interface NoteProps {
  /** Body text. `\n` starts a new line. */
  children: string;
  /** Heading rendered into the frame's top edge. */
  title?: string;
  /** Available width in cells. The frame sizes itself to the body. */
  availableWidth?: number;
  /** Paint the marker in this status's colors. */
  tone?: StatusState;
}

/**
 * A framed aside.
 *
 * The one place the grammar uses a frame, because free-form multi-line text has
 * no natural rail representation. It is a blockquote, not a panel: the marker
 * still occupies column 0, and the body keeps the standard 2-column indent, so
 * a note sits inside the grammar rather than beside it.
 *
 * Each row is one pre-composed text run inside a box of a *computed* width.
 * A frame is a fixed-width diagram whose width is known before it renders, so
 * negotiating its columns through flex is strictly worse: the corners land a
 * cell apart, the right-hand bar drifts, and a frame that does not close reads
 * as broken. Composing the rows as text makes closure arithmetic, which is
 * testable — see `tests/unit/note.test.tsx`.
 */
export function Note({ children, title, availableWidth, tone = "success" }: NoteProps) {
  const { theme } = useTheme();
  const f = theme.note;

  // Pay for the rail, the note's indent, the frame's two bars, and one pad
  // column before deciding how wide the body may be.
  const outer = availableWidth ?? 60;
  const maxBody = Math.max(8, outer - theme.spacing.railWidth - theme.spacing.bodyIndent - 4);
  const body = wrapToWidth(children, maxBody);

  const titleText = title ?? "";
  const titleCells = titleText === "" ? 0 : stringWidth(titleText) + 1;
  const bodyCells = body.reduce((max, line) => Math.max(max, stringWidth(line)), 0);

  // Column accounting, shared by all three edges. Every row starts its content
  // Column accounting. Every row's content starts at `lead` columns and every
  // row's right-hand edge must land at `lead + frameWidth`:
  //
  //   top    marker + labelGap + title + rule(frameWidth - titleCells) + corner
  //   body   rail    + indent    + | + " " + line + pad + |
  //   bottom corner  + indent    + rule(frameWidth) + corner
  //
  // A frame is wide enough for whichever is larger - the body or the title -
  // plus the two frame columns. Solving for one `frameWidth` is what makes the
  // three edges agree; deriving each rule independently is how a corner ends up
  // two cells to the right of the bar beneath it.
  const frameWidth = Math.max(bodyCells, titleCells, 1) + 2;
  // Padding is per line, not global: only the widest line is full, so every
  // shorter line needs its own run of spaces to reach the right-hand bar.
  const padFor = (line: string) => " ".repeat(Math.max(0, frameWidth - stringWidth(line) - 2));

  const bar = (ch: string): TextChunk => ({
    __isChunk: true,
    text: ch,
    fg: parseColor(theme.railStyles.bar.color),
  });
  const rule = (n: number): TextChunk => bar(f.horizontal.char.repeat(Math.max(0, n)));

  return (
    <box flexDirection="column" width="100%">
      {/* Top edge: a message row, so the marker owns column 0 exactly as a
          prompt question's does. */}
      <box flexDirection="row" width="100%" minWidth={0}>
        <Marker state={tone} />
        <box flexDirection="row" flexGrow={1} minWidth={0} paddingLeft={theme.spacing.labelGap}>
          <text
            content={styled([
              ...(titleCells > 0 ? paint(`${titleText} `, theme.text.label).chunks : []),
              rule(frameWidth - titleCells),
              bar(f.topRight.char),
            ])}
            wrapMode="none"
            truncate={availableWidth !== undefined}
          />
        </box>
      </box>

      {body.map((bodyLine, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: each row is one fixed line of the body; the order is the identity
        <RailRow key={`note-${i}`}>
          <text
            content={styled([
              bar(f.vertical.char),
              ...paint(` ${bodyLine}${padFor(bodyLine)}`, theme.text.label).chunks,
              bar(f.vertical.char),
            ])}
            wrapMode="none"
            truncate={availableWidth !== undefined}
          />
        </RailRow>
      ))}

      <box flexDirection="row" width="100%" minWidth={0}>
        <text content={styled([bar(f.bottomLeft.char)])} wrapMode="none" />
        <box flexDirection="row" flexGrow={1} minWidth={0} paddingLeft={theme.spacing.bodyIndent}>
          <text
            content={styled([rule(frameWidth), bar(f.bottomRight.char)])}
            wrapMode="none"
            truncate={availableWidth !== undefined}
          />
        </box>
      </box>
    </box>
  );
}
