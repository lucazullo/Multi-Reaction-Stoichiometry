"use client";

import { useState } from "react";
import { TermsModal } from "./TermsModal";

interface TermsLinkProps {
  className?: string;
  children?: React.ReactNode;
}

/** Inline link that opens the Terms of Use modal. */
export function TermsLink({ className = "", children = "Terms of Use" }: TermsLinkProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      {open && <TermsModal onClose={() => setOpen(false)} />}
    </>
  );
}
