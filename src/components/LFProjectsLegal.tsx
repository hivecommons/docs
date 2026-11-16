import type { CSSProperties } from "react";

export const LF_PROJECTS_POLICIES_URL = "https://lfprojects.org/policies/";
export const LF_PROJECTS_COPYRIGHT =
  "© Copyright Hive Commons Series of LF Projects, LLC";

interface LFProjectsLegalProps {
  className?: string;
  linkClassName?: string;
  style?: CSSProperties;
}

// The LF Projects legal footer required on every Hive Commons web page.
// Keep the wording exact: it is the text LF Projects asks hosted projects to show.
export default function LFProjectsLegal({
  className,
  linkClassName,
  style,
}: LFProjectsLegalProps) {
  return (
    <p className={className} style={style} data-testid="lf-projects-legal">
      {LF_PROJECTS_COPYRIGHT}
      <br />
      For website terms of use, trademark policy and other project policies
      please see{" "}
      <a
        href={LF_PROJECTS_POLICIES_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={linkClassName}
      >
        lfprojects.org/policies/
      </a>
      .
    </p>
  );
}
