import type { SVGProps } from 'react';

import { PATHS, type IconName } from './iconPaths';

export type { IconName };

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
  /** Fill the shape instead of stroking it (solid badges). */
  solid?: boolean;
}

export function Icon({ name, size = 16, solid = false, className, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={solid ? 'currentColor' : 'none'}
      fillOpacity={solid ? 0.28 : undefined}
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      className={className}
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Raw path data, for drawing glyphs inside a larger SVG (charts). */
export function iconPath(name: IconName): string {
  return PATHS[name];
}
