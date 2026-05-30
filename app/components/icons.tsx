import type { SVGProps } from "react";

function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  );
}

export function HomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
    </Icon>
  );
}

export function LiveIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M6.5 7.5a7 7 0 0 0 0 9" />
      <path d="M17.5 7.5a7 7 0 0 1 0 9" />
      <path d="M9 10a3.5 3.5 0 0 0 0 4" />
      <path d="M15 10a3.5 3.5 0 0 1 0 4" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function BallIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18" />
      <path d="M3 12h18" />
    </Icon>
  );
}

export function ChartIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 19V5" />
      <path d="M8 19V11" />
      <path d="M12 19V7" />
      <path d="M16 19V9" />
      <path d="M20 19V4" />
    </Icon>
  );
}

export function TicketIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V7z" />
      <path d="M10 8v8" />
    </Icon>
  );
}

export function UserIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M20 21a8 8 0 1 0-16 0" />
      <circle cx="12" cy="8" r="4" />
    </Icon>
  );
}

export function PlusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </Icon>
  );
}

export function ChevronRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M9 18l6-6-6-6" />
    </Icon>
  );
}

export function FlameIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M13 3s.5 2-1 4-4 3-4 7a4 4 0 0 0 8 0c0-2-1-3.5-2-5s-1-6-1-6z" />
    </Icon>
  );
}

export function TennisIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M7 7c5 2 5 8 10 10" />
      <path d="M17 7C12 9 12 15 7 17" />
    </Icon>
  );
}

export function BasketballIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c3 3 3 15 0 18" />
      <path d="M12 3c-3 3-3 15 0 18" />
    </Icon>
  );
}

export function HockeyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M7 4l-2 16" />
      <path d="M17 4l2 16" />
      <path d="M6 16h5" />
      <path d="M13 16h5" />
      <circle cx="12" cy="18" r="1" fill="currentColor" stroke="none" />
    </Icon>
  );
}

export function StarIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M12 3l2.6 5.7 6.2.6-4.7 4.1 1.4 6.1L12 16.9 6.5 19.5 7.9 13.4 3.2 9.3l6.2-.6L12 3z" />
    </Icon>
  );
}

export function TrophyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M8 4h8v3a4 4 0 0 1-8 0V4z" />
      <path d="M6 7H4a2 2 0 0 0 2 2" />
      <path d="M18 7h2a2 2 0 0 1-2 2" />
      <path d="M12 11v4" />
      <path d="M9 19h6" />
      <path d="M10 15h4" />
    </Icon>
  );
}
