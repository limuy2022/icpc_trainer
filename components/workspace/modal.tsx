"use client"
import { X } from "lucide-react"
import type { ReactNode } from "react"

/** Shared modal shell: overlay click closes, close button labelled, dialog semantics. */
export default function Modal({
  label,
  closeLabel,
  onClose,
  className,
  children,
}: {
  label: string
  closeLabel?: string
  onClose: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className="modal-overlay"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <section
        className={className ? `modal ${className}` : "modal"}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="modal-close"
          aria-label={closeLabel || label}
          onClick={onClose}
        >
          <X size={20} />
        </button>
        {children}
      </section>
    </div>
  )
}
