import clsx from "clsx";
import Image from "next/image";

/** Mascote Nooi (pose "Pensando") dos estados de erro e vazio. Figma: 140 px na tela cheia. */
export function EmptyIllustration({ className }: { className?: string }) {
  return <Image src="/marca/nooi-pensando.png" alt="" width={140} height={140} className={clsx("size-[104px] object-contain md:size-[140px]", className)} />;
}
