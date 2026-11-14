import clsx from "clsx";
import { InstagramIcon } from "@/components/icons";

export function ChannelIcon({ dim, size = 32 }: { dim?: boolean; size?: number }) {
  return (
    <span
      className={clsx(
        "grid shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#fdda75,#fa7e1e_35%,#d62976_65%,#962fbf)]",
        dim && "opacity-40",
      )}
      style={{ width: size, height: size }}
    >
      <InstagramIcon className="text-white" style={{ width: size * 0.56, height: size * 0.56 }} />
    </span>
  );
}
