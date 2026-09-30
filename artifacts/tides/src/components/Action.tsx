import "./Action.css";
import type { ButtonHTMLAttributes } from "react";

/** Shared actions; navigation and segmented selection retain their own states. */
export default function Action({ className = "", variant = "secondary", size = "standard", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { size?: "standard" | "compact"; variant?: "primary" | "secondary" | "text" | "icon" }) {
  return <button {...props} className={`compass-action compass-action--${variant} compass-action--${size} ${className}`} />;
}
