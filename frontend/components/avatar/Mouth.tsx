"use client";

import { AvatarState } from "./Avatar";

/**
 * idle + happy — thin crescent = wide open beaming grin
 */
export const MouthSmiley = () => (
  <path
    d="M672.535 365.357C676.381 365.754 679.184 369.195 678.709 373.031C668.629 454.438 629.604 529.602 568.636 584.712C505.935 641.388 424.469 672.839 339.949 672.999C255.43 673.159 173.845 642.017 110.93 585.579C49.7535 530.7 10.4438 455.684 0.0557724 374.316C-0.433814 370.482 2.3565 367.03 6.20058 366.619L28 364C32 363.5 36 366 37 370C48 458 86 536 142 586C198 636 266 660 340 660C414 660 482 636 538 586C594 536 632 458 643 370C644 366 648 363.5 652 364L672.535 365.357Z"
    fill="white"
  />
);

/** frown crescent */
export const MouthSad = () => (
  <path d="M120 580Q339 400 558 580L536 610Q339 445 144 610Z" fill="white" />
);

/** open mouth "O" ring — less oval, slightly wider, reduced thickness, scaled up */
export const MouthWow = () => (
  <path
    fillRule="evenodd"
    clipRule="evenodd"
    d="M339 352C402 352 454 413 454 487C454 561 402 622 339 622C276 622 224 561 224 487C224 413 276 352 339 352ZM339 387C383 387 419 432 419 487C419 542 383 587 339 587C295 587 259 542 259 487C259 432 295 387 339 387Z"
    fill="white"
  />
);

/** tiny flat closed smirk "_" */
export const MouthSquinting = () => (
  <path d="M255 495 Q339 512 423 495 L420 516 Q339 536 258 516Z" fill="white" />
);

export function Mouth({ state }: { state: AvatarState }) {
  switch (state) {
    case "sad":
      return <MouthSad />;
    case "wow":
      return <MouthWow />;
    case "squinting":
      return <MouthSquinting />;
    default:
      return <MouthSmiley />;
  }
}
