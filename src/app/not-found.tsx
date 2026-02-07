import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-bold">404</h1>
      <p className="mt-4 text-lg text-muted-foreground">
        Cette page n&apos;existe pas.
      </p>
      <Link href="/">
        <Button className="mt-6">Retour &agrave; l&apos;accueil</Button>
      </Link>
    </div>
  );
}
