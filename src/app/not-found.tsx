import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="text-8xl font-black tracking-tighter">404</div>
      <div className="mt-2 text-6xl" aria-hidden>
        🚗💨
      </div>
      <h1 className="mt-4 text-xl font-semibold">
        Cette page a pris la fuite
      </h1>
      <p className="mt-2 max-w-sm text-muted-foreground">
        Peut-être qu&apos;elle roule en Fiat Multipla et qu&apos;elle a
        honte d&apos;être vue.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/">
          <Button>Retour à l&apos;accueil</Button>
        </Link>
        <Link href="/marques">
          <Button variant="outline">Voir les marques</Button>
        </Link>
      </div>
      <p className="mt-12 text-xs text-muted-foreground/50">
        Si vous cherchiez la Fiat Multipla, elle non plus n&apos;est pas ici.
      </p>
    </div>
  );
}
